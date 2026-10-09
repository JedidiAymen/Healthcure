#!/usr/bin/env python3
"""Run the published CVS-AdaptNet model on an installed Endoscapes split.

This isolated worker reports research metrics and per-frame scores. It never
turns the three CVS dimensions into a surgical clearance decision.
"""

from __future__ import annotations

import argparse
from collections import defaultdict
import hashlib
import json
import os
import runpy
import sys
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CVS_SOURCE = PROJECT_ROOT / "references/upstream/CVS-AdaptNet"
MODEL_DIR = PROJECT_ROOT / "data/models/cvs-adaptnet"
CHECKPOINT = MODEL_DIR / "CVSAdaptNet.pth"
TEXT_MODEL_DIR = PROJECT_ROOT / "data/models/bioclinicalbert"
PROMPTS = CVS_SOURCE / "class_prompts/class_prompt_endoscapes_manual.txt"
UPSTREAM_CONFIG = CVS_SOURCE / "configs/config_cvsadaptnet.py"
COCO_CATEGORY_NAMES = (
    "seeing_two_structures",
    "clear_dissection_of_triangle",
    "cystic_plate_visualization",
)


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(8 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--split", choices=("train", "val", "test"), default="val")
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--limit", type=int, help="Optional smoke-run cap; never a validation result")
    parser.add_argument("--case-id", help="Run the installed official image matching endoscapes:<split>:<frame>")
    args = parser.parse_args()
    if args.case_id and args.limit is not None:
        parser.error("--case-id and --limit cannot be combined")
    if args.output is not None and not args.output.is_absolute():
        args.output = PROJECT_ROOT / args.output
    return args


def endoscapes_root() -> Path:
    configured = os.environ.get("MEDFORGE_ENDOSCAPES_ROOT", "").strip()
    return Path(configured).expanduser().resolve() if configured else PROJECT_ROOT / "data/endoscapes"


def load_runtime() -> tuple[Any, Any, Any, Any, dict[str, Any]]:
    if not CHECKPOINT.is_file():
        raise FileNotFoundError(f"Missing official CVS-AdaptNet checkpoint: {CHECKPOINT}")
    if not (TEXT_MODEL_DIR / "pytorch_model.bin").is_file():
        raise FileNotFoundError("Missing pinned Bio_ClinicalBERT files; run scripts/acquire_bioclinicalbert.py")
    if not PROMPTS.is_file() or not UPSTREAM_CONFIG.is_file():
        raise FileNotFoundError("The pinned CVS-AdaptNet source checkout is incomplete")

    sys.path.insert(0, str(CVS_SOURCE))
    os.chdir(CVS_SOURCE)

    import torch
    from mmengine.config import Config
    from torchvision import transforms
    from codes.models.builder import build_algorithm

    config = Config.fromfile(str(UPSTREAM_CONFIG)).config
    config.model_config.backbone_img.pretrained = "random"
    # The published checkpoint supplies trained BERT weights. Its tokenizer
    # and architecture use the canonical public Bio_ClinicalBERT repository.
    config.model_config.backbone_text.text_bert_type = str(TEXT_MODEL_DIR)
    model = build_algorithm(config.model_config)
    payload = torch.load(CHECKPOINT, map_location="cpu", weights_only=True)
    source_state = payload.get("model_state_dict")
    if not isinstance(source_state, dict):
        raise ValueError("The published checkpoint has no model_state_dict")

    mapped_state = {
        key.replace("model.backbone_img.model.", "backbone_img.model.")
        .replace("model.backbone_text.model.", "backbone_text.model.")
        .replace("model.backbone_img.global_embedder", "backbone_img.global_embedder"): value
        for key, value in source_state.items()
    }
    load_result = model.load_state_dict(mapped_state, strict=False)
    if load_result.missing_keys:
        preview = ", ".join(load_result.missing_keys[:12])
        raise ValueError(f"Checkpoint did not populate model parameters: {preview}")
    # The pinned upstream test builds SurgVLP directly and ignores the training wrapper's logit_scale key.
    unexpected = set(load_result.unexpected_keys) - {"logit_scale"}
    if unexpected:
        preview = ", ".join(sorted(unexpected)[:12])
        raise ValueError(f"Checkpoint has unexpected parameters for the official inference model: {preview}")
    del payload, source_state, mapped_state

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device).eval()
    preprocess = transforms.Compose(
        [
            transforms.Resize((360, 640)),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225],
            ),
        ]
    )
    return torch, model, preprocess, device, {
        "missing_keys": load_result.missing_keys,
        "unexpected_keys": load_result.unexpected_keys,
    }


def source_records(split: str, limit: int | None, case_id: str | None = None) -> tuple[Path, list[dict[str, Any]]]:
    split_dir = endoscapes_root() / split
    annotation_path = split_dir / "annotation_coco.json"
    payload = json.loads(annotation_path.read_text(encoding="utf-8"))
    records = payload.get("images")
    if not isinstance(records, list) or not records:
        raise ValueError(f"No official COCO image records in {annotation_path}")
    if case_id is not None:
        matching = [
            record for record in records
            if isinstance(record.get("file_name"), str)
            and case_id == f"endoscapes:{split}:{Path(record['file_name']).stem}"
        ]
        if len(matching) != 1:
            raise ValueError(f"No unique official {split} frame matches case ID {case_id!r}")
        records = matching
    if limit is not None:
        if limit < 1:
            raise ValueError("--limit must be positive")
        records = records[:limit]
    return annotation_path, records


def evaluate(args: argparse.Namespace) -> dict[str, Any]:
    from PIL import Image
    from torchmetrics import AveragePrecision

    torch, model, preprocess, device, checkpoint_load = load_runtime()
    split_dir = endoscapes_root() / args.split
    annotation_path, records = source_records(args.split, args.limit, args.case_id)
    prompts = [line.strip() for line in PROMPTS.read_text(encoding="utf-8").splitlines() if line.strip()]
    tokenizer = model.backbone_text.tokenizer
    token_batch = tokenizer(
        prompts,
        return_tensors="pt",
        truncation=True,
        padding="max_length",
        max_length=77,
    )
    # The pinned upstream test tokenizes each prompt separately in
    # CVS_AdaptNet.process_text(), stacks the resulting tensors, then feeds
    # input_ids/attention_mask/token_type_ids to SurgVLP. Confirm this batched
    # equivalent before recording any validation scores.
    token_keys = ("input_ids", "attention_mask", "token_type_ids")
    per_prompt_tokens = [
        tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            padding="max_length",
            max_length=77,
        )
        for prompt in prompts
    ]
    for key in token_keys:
        upstream_stacked = torch.cat([item[key] for item in per_prompt_tokens], dim=0)
        if not torch.equal(token_batch[key], upstream_stacked):
            raise ValueError(f"Batched text tokenization differs from upstream process_text(): {key}")
    text_inputs = {
        key: token_batch[key].to(device)
        for key in token_keys
    }
    token_tensor_sha256 = hashlib.sha256(
        b"".join(token_batch[key].contiguous().numpy().tobytes() for key in token_keys)
    ).hexdigest()

    labels: list[list[float]] = []
    predictions: list[list[float]] = []
    identities: list[dict[str, Any]] = []
    with torch.inference_mode():
        text_features = model(None, text_inputs, mode="text")["text_emb"]
        text_features = text_features / text_features.norm(dim=-1, keepdim=True)
        for offset in range(0, len(records), args.batch_size):
            batch = records[offset : offset + args.batch_size]
            tensors = []
            for record in batch:
                filename = Path(record["file_name"])
                if filename.name != record["file_name"] or filename.suffix.lower() != ".jpg":
                    raise ValueError(f"Unsafe COCO frame path: {record['file_name']!r}")
                image_path = split_dir / filename
                if not image_path.is_file():
                    raise FileNotFoundError(image_path)
                if record.get("height") != 480 or record.get("width") != 854:
                    raise ValueError(f"Unexpected source dimensions for {filename}")
                with Image.open(image_path) as image:
                    rgb_image = image.convert("RGB")
                    pixel_extrema = rgb_image.getextrema()
                    all_black_pixels = all(low == 0 and high == 0 for low, high in pixel_extrema)
                    tensors.append(preprocess(rgb_image))
                labels.append([float(value) for value in record["ds"]])
                identities.append(
                    {
                        "case_id": f"endoscapes:{args.split}:{filename.stem}",
                        "image_sha256": file_sha256(image_path),
                        "image_is_all_black_pixels": all_black_pixels,
                        "ds_reference": record["ds"],
                    }
                )
            images = torch.stack(tensors).to(device)
            image_features = model(images, None, mode="video")["img_emb"]
            image_features = image_features / image_features.norm(dim=-1, keepdim=True)
            scores = (image_features @ text_features.T).sigmoid().cpu()
            predictions.extend(scores.tolist())

    label_tensor = torch.tensor(labels).round().long()
    prediction_tensor = torch.tensor(predictions, dtype=torch.float32)
    metric = AveragePrecision(task="multilabel", num_labels=3, average="none")
    class_ap = metric(prediction_tensor, label_tensor)
    class_ap_values = [
        float(value) if torch.isfinite(value).item() else None
        for value in class_ap
    ]
    undefined_ap_classes = [
        class_name
        for class_name, score in zip(COCO_CATEGORY_NAMES, class_ap_values, strict=True)
        if score is None
    ]
    indices_by_content_hash: dict[str, list[int]] = defaultdict(list)
    for index, identity in enumerate(identities):
        indices_by_content_hash[identity["image_sha256"]].append(index)
    unique_content_indices = [indices[0] for indices in indices_by_content_hash.values()]
    unique_content_ap = AveragePrecision(task="multilabel", num_labels=3, average="none")(
        prediction_tensor[unique_content_indices], label_tensor[unique_content_indices]
    )
    unique_content_ap_values = [
        float(value) if torch.isfinite(value).item() else None
        for value in unique_content_ap
    ]
    duplicate_content_groups = [
        {
            "image_sha256": image_sha256,
            "frame_count": len(indices),
            "case_ids": [identities[index]["case_id"] for index in indices],
            "all_black_pixels": all(identities[index]["image_is_all_black_pixels"] for index in indices),
            "reference_labels": sorted(
                {tuple(labels[index]) for index in indices}
            ),
        }
        for image_sha256, indices in indices_by_content_hash.items()
        if len(indices) > 1
    ]
    dataset_license = "CC BY-NC-SA 4.0; local non-commercial scientific research and education only"
    return {
        "schema": "medforge.cvs-adaptnet-validation.v2",
        "model": "CVS-AdaptNet",
        "model_revision": "bb21ffbd781b6f943be0daaeeccf1567c21e691d",
        "checkpoint_file": CHECKPOINT.name,
        "checkpoint_sha256": file_sha256(CHECKPOINT),
        "text_backbone_revision": "d5892b39a4adaed74b92212a44081509db72f87b",
        "text_backbone_manifest_sha256": file_sha256(TEXT_MODEL_DIR / "medforge-manifest.json"),
        "checkpoint_load": checkpoint_load,
        "device": str(device),
        "torch_version": torch.__version__,
        "dataset": "Endoscapes-BBox201",
        "split": args.split,
        "case_id": args.case_id,
        "source_revision": "a8bd4f9b783308f783cca5943c31ff95317b8256",
        "annotation_file": f"Endoscapes-BBox201/{args.split}/annotation_coco.json",
        "annotation_sha256": file_sha256(annotation_path),
        "annotation_count": len(records),
        "prompt_file": str(PROMPTS.relative_to(PROJECT_ROOT)),
        "prompt_sha256": file_sha256(PROMPTS),
        "text_preprocessing": {
            "tokenizer_class": type(tokenizer).__name__,
            "tokenizer_vocab_size": len(tokenizer.get_vocab()),
            "max_length": 77,
            "truncation": True,
            "padding": "max_length",
            "upstream_process_text_tensor_parity": True,
            "compared_tensors": list(token_keys),
            "token_tensors_sha256": token_tensor_sha256,
            "cap_lens": "Upstream computes cap_lens as auxiliary metadata; SurgVLP.forward(mode='text') does not consume it.",
        },
        "preprocessing": "CVS-AdaptNet official evaluation transform: resize 360x640, center crop 224, ImageNet normalization",
        "metric": "TorchMetrics multilabel AveragePrecision with the official source test convention of rounding image-level ds labels",
        "class_names": list(COCO_CATEGORY_NAMES),
        "average_precision_by_class": class_ap_values,
        "undefined_average_precision_classes": undefined_ap_classes,
        "source_data_quality": {
            "unique_image_content_count": len(unique_content_indices),
            "duplicate_content_group_count": len(duplicate_content_groups),
            "duplicate_content_extra_frame_count": len(records) - len(unique_content_indices),
            "duplicate_content_groups": duplicate_content_groups,
            "average_precision_unique_content_once": unique_content_ap_values,
            "official_split_policy": "Retain every official COCO record; no byte-identical image deduplication or blank-frame filtering is applied to the primary metric.",
        },
        "labels_and_scores": [
            {
                **identity,
                "reference_label_rounded_for_metric": [int(v) for v in torch.tensor(label).round().tolist()],
                "scores": score,
            }
            for identity, label, score in zip(identities, labels, predictions, strict=True)
        ],
        "license": dataset_license,
        "clinical_interpretation": "Research model scores only; not surgical clearance, clinical validation, or patient-care guidance.",
        "limited_smoke_run": args.limit is not None,
        "case_scoped_run": args.case_id is not None,
    }


def main() -> None:
    args = parse_args()
    if args.batch_size < 1 or args.batch_size > 16:
        raise SystemExit("--batch-size must be between 1 and 16")
    report = evaluate(args)
    serialized = json.dumps(report, indent=2, allow_nan=False) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(serialized, encoding="utf-8")
        print(f"Saved {args.split} report for {report['annotation_count']} frames to {args.output}")
    else:
        print(serialized)
    print("Per-class average precision:", report["average_precision_by_class"])


if __name__ == "__main__":
    main()
