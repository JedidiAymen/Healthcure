"""Evaluate a FiSaV stenosis classifier honestly, in an isolated worker process.

Research and education only. The model is a balanced, L2-regularised logistic regression on
unit-free PZT1 features (PZT1 lies over the anastomosis in every FiSaV patient). Evaluation
uses repeated, stratified, nested cross-validation: hyperparameters are tuned inside each
outer training fold, the decision threshold is fixed at 0.5 in advance, and every reported
per-patient prediction is out-of-fold. Occlusion-test windows are excluded from features.

Outputs (in --output-dir): evaluation.json and model.json (plain JSON parameters, no pickle).
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import platform
import sys

import numpy as np
from scipy import signal as sps

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps" / "api"))
from app.signal_processing import detect_r_peaks, marker_intervals  # noqa: E402

MODEL_ID = "fisav-stenosis-lr"
MODEL_VERSION = "0.1.0"
FS_EXPECTED = 10_000.0
MAX_SECONDS = 150
MIN_CLEAN_SECONDS = 20
MAX_CLEAN_SECONDS = 60
OCCLUSION_MARGIN_SEC = 2.0
BANDS = [(25, 100), (100, 250), (250, 500), (500, 1000), (1000, 2000)]
FEATURES = [f"rel_power_{lo}_{hi}_hz" for lo, hi in BANDS] + [
    "log10_spectral_centroid_hz", "log10_spectral_edge90_hz", "log10_high_low_power_ratio", "log10_systolic_diastolic_energy_ratio"]
C_GRID = [0.01, 0.1, 1.0, 10.0]


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def longest_clean_segment(times: np.ndarray, occlusion: np.ndarray) -> tuple[int, int]:
    clean = np.ones(len(times), dtype=bool)
    for start, end in marker_intervals(times, occlusion):
        clean &= ~((times >= start - OCCLUSION_MARGIN_SEC) & (times < end + OCCLUSION_MARGIN_SEC))
    best, run_start = (0, 0), None
    for index, ok in enumerate(np.append(clean, False)):
        if ok and run_start is None:
            run_start = index
        elif not ok and run_start is not None:
            if index - run_start > best[1] - best[0]:
                best = (run_start, index)
            run_start = None
    return best


def recording_features(times: np.ndarray, ecg: np.ndarray, pzt1: np.ndarray, occlusion: np.ndarray, fs: float) -> dict[str, float] | None:
    lo, hi = longest_clean_segment(times, occlusion)
    if (hi - lo) / fs < MIN_CLEAN_SECONDS:
        return None
    hi = min(hi, lo + int(MAX_CLEAN_SECONDS * fs))
    vib, lead = pzt1[lo:hi] - np.mean(pzt1[lo:hi]), ecg[lo:hi]
    freqs, power = sps.welch(vib, fs=fs, nperseg=8192)
    band = (freqs >= 5) & (freqs <= 2000)
    total = np.trapezoid(power[band], freqs[band])
    if not np.isfinite(total) or total <= 0:
        return None
    values: dict[str, float] = {}
    for low, high in BANDS:
        mask = (freqs >= low) & (freqs < high)
        values[f"rel_power_{low}_{high}_hz"] = float(np.trapezoid(power[mask], freqs[mask]) / total)
    centroid = float(np.sum(freqs[band] * power[band]) / np.sum(power[band]))
    cumulative = np.cumsum(power[band]) / np.sum(power[band])
    edge90 = float(freqs[band][np.searchsorted(cumulative, 0.9)])
    high_power = np.trapezoid(power[(freqs >= 500) & (freqs <= 2000)], freqs[(freqs >= 500) & (freqs <= 2000)])
    low_power = np.trapezoid(power[(freqs >= 25) & (freqs < 250)], freqs[(freqs >= 25) & (freqs < 250)])
    values["log10_spectral_centroid_hz"] = float(np.log10(centroid))
    values["log10_spectral_edge90_hz"] = float(np.log10(max(edge90, 1.0)))
    values["log10_high_low_power_ratio"] = float(np.log10(max(high_power, 1e-30) / max(low_power, 1e-30)))
    # Bruit energy early in the cardiac cycle versus later, per beat, from the ECG R peaks.
    sos = sps.butter(4, [100, 1000], btype="bandpass", fs=fs, output="sos")
    energy = sps.sosfiltfilt(sos, vib) ** 2
    ratios = []
    for r_peak, next_peak in zip(detect_r_peaks(lead, fs)[:-1], detect_r_peaks(lead, fs)[1:]):
        if (next_peak - r_peak) / fs < 0.75:
            continue
        systolic = energy[r_peak + int(0.05 * fs):r_peak + int(0.30 * fs)].mean()
        diastolic = energy[r_peak + int(0.45 * fs):r_peak + int(0.70 * fs)].mean()
        if systolic > 0 and diastolic > 0:
            ratios.append(np.log10(systolic / diastolic))
    if len(ratios) < 5:
        return None
    values["log10_systolic_diastolic_energy_ratio"] = float(np.median(ratios))
    return values


def load_recording(path: Path) -> tuple[np.ndarray, ...]:
    data = np.loadtxt(path, delimiter=",", skiprows=1, usecols=(0, 1, 2, 6), max_rows=int(MAX_SECONDS * FS_EXPECTED), dtype=np.float64)
    times = data[:, 0]
    fs = float(1 / np.median(np.diff(times)))
    return times, data[:, 1], data[:, 2], data[:, 3], fs


def nested_cv(X: np.ndarray, y: np.ndarray, repeats: int, seed: int):
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import GridSearchCV, RepeatedStratifiedKFold, StratifiedKFold
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    from sklearn.metrics import roc_auc_score

    def model():
        return GridSearchCV(make_pipeline(StandardScaler(), LogisticRegression(class_weight="balanced", max_iter=2000)),
                            {"logisticregression__C": C_GRID}, scoring="roc_auc",
                            cv=StratifiedKFold(4, shuffle=True, random_state=seed))

    outer = RepeatedStratifiedKFold(n_splits=5, n_repeats=repeats, random_state=seed)
    per_patient: list[list[float]] = [[] for _ in range(len(y))]
    repeat_aucs, fold_scores = [], []
    for fold, (train, test) in enumerate(outer.split(X, y)):
        fitted = model().fit(X[train], y[train])
        probabilities = fitted.predict_proba(X[test])[:, 1]
        for index, probability in zip(test, probabilities):
            per_patient[index].append(float(probability))
        fold_scores.append((fold // 5, test, probabilities))
    for repeat in range(repeats):
        oof = np.zeros(len(y))
        for _, test, probabilities in [item for item in fold_scores if item[0] == repeat]:
            oof[test] = probabilities
        repeat_aucs.append(float(roc_auc_score(y, oof)))
    mean_oof = np.array([np.mean(values) for values in per_patient])
    sd_oof = np.array([np.std(values) for values in per_patient])
    return mean_oof, sd_oof, repeat_aucs, model


def bootstrap_auc(y: np.ndarray, scores: np.ndarray, seed: int, resamples: int = 2000) -> list[float]:
    from sklearn.metrics import roc_auc_score
    rng = np.random.default_rng(seed)
    values = []
    for _ in range(resamples):
        sample = rng.integers(0, len(y), len(y))
        if len(set(y[sample])) == 2:
            values.append(roc_auc_score(y[sample], scores[sample]))
    return [float(np.percentile(values, 2.5)), float(np.percentile(values, 97.5))]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--fisav-root", type=Path, required=True)
    parser.add_argument("--labels", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--seed", type=int, default=20261010)
    parser.add_argument("--repeats", type=int, default=10)
    parser.add_argument("--permutations", type=int, default=200)
    args = parser.parse_args()

    import sklearn
    from sklearn.metrics import roc_auc_score

    labels_doc = json.loads(args.labels.read_text(encoding="utf8"))
    manifest = json.loads((args.fisav_root / "medforge-source-manifest.json").read_text(encoding="utf8"))
    records = {entry["file_name"].removesuffix(".csv"): entry["sha256"] for entry in manifest.get("records", [])}
    args.output_dir.mkdir(parents=True, exist_ok=True)
    cache_path = args.output_dir / "features-cache.json"
    cache = json.loads(cache_path.read_text(encoding="utf8")) if cache_path.is_file() else {}

    features, excluded = {}, {}
    for patient in sorted(labels_doc["patients"]):
        expected = records.get(patient)
        path = args.fisav_root / f"{patient}.csv"
        if not expected or not path.is_file():
            excluded[patient] = "recording not installed"
            continue
        key = f"{expected}:{MAX_SECONDS}:{MAX_CLEAN_SECONDS}:{OCCLUSION_MARGIN_SEC}"
        if cache.get(patient, {}).get("key") == key:
            values = cache[patient]["values"]
        else:
            if sha256_file(path) != expected:
                excluded[patient] = "recording hash does not match the source manifest"
                continue
            times, ecg, pzt1, occlusion, fs = load_recording(path)
            values = recording_features(times, ecg, pzt1, occlusion, fs)
            cache[patient] = {"key": key, "values": values}
            cache_path.write_text(json.dumps(cache), encoding="utf8")
            print(f"features {patient}: {'ok' if values else 'insufficient clean signal'}", flush=True)
        if values is None:
            excluded[patient] = "fewer than 20 s of clean signal or too few beats"
            continue
        features[patient] = values

    patients = sorted(features)
    X = np.array([[features[p][name] for name in FEATURES] for p in patients])
    y = np.array([1 if labels_doc["patients"][p]["stenosis"] else 0 for p in patients])
    if len(set(y)) < 2 or min(np.bincount(y)) < 5:
        raise SystemExit("Too few patients in one class for a nested cross-validated evaluation")

    mean_oof, sd_oof, repeat_aucs, model = nested_cv(X, y, args.repeats, args.seed)
    auroc = float(roc_auc_score(y, mean_oof))
    predicted = (mean_oof >= 0.5).astype(int)
    sensitivity = float(np.mean(predicted[y == 1] == 1))
    specificity = float(np.mean(predicted[y == 0] == 0))

    # Label permutation: how often does a model trained on shuffled labels do as well?
    rng = np.random.default_rng(args.seed + 1)
    null_aucs = []
    for _ in range(args.permutations):
        shuffled = rng.permutation(y)
        oof, _, _, _ = nested_cv(X, shuffled, 1, int(rng.integers(1 << 30)))
        null_aucs.append(float(roc_auc_score(shuffled, oof)))
    permutation_p = float((1 + sum(value >= auroc for value in null_aucs)) / (1 + len(null_aucs))) if null_aucs else None

    # Exam-only baseline from the patient sheet: systolic-only (not continuous) thrill and bruit.
    exam = np.array([[1.0 if labels_doc["patients"][p]["thrill_pattern"] == "Systolic" else 0.0,
                      1.0 if labels_doc["patients"][p]["bruit_pattern"] == "Systolic" else 0.0] for p in patients])
    exam_oof, _, _, _ = nested_cv(exam + np.random.default_rng(args.seed).normal(0, 1e-9, exam.shape), y, args.repeats, args.seed)
    exam_auroc = float(roc_auc_score(y, exam_oof))

    final = model().fit(X, y)
    pipeline = final.best_estimator_
    scaler, logistic = pipeline.named_steps["standardscaler"], pipeline.named_steps["logisticregression"]
    model_doc = {
        "schema": "medforge.fisav-stenosis-model.v1", "model_id": MODEL_ID, "model_version": MODEL_VERSION,
        "kind": "logistic regression on standardised unit-free PZT1 features", "feature_names": FEATURES,
        "scaler_mean": scaler.mean_.tolist(), "scaler_scale": scaler.scale_.tolist(),
        "coefficients": logistic.coef_[0].tolist(), "intercept": float(logistic.intercept_[0]),
        "C": float(final.best_params_["logisticregression__C"]), "threshold": 0.5, "positive_class": "stenosis present",
        "trained_on_patients": len(patients), "class_counts": {"stenosis": int(y.sum()), "no_stenosis": int(len(y) - y.sum())},
    }
    model_bytes = (json.dumps(model_doc, indent=2, sort_keys=True) + "\n").encode()
    (args.output_dir / "model.json").write_bytes(model_bytes)
    model_sha = hashlib.sha256(model_bytes).hexdigest()

    evaluation = {
        "schema": "medforge.fisav-stenosis-evaluation.v1", "model_id": MODEL_ID, "model_version": MODEL_VERSION,
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "parameters": {"seed": args.seed, "outer_folds": 5, "inner_folds": 4, "repeats": args.repeats, "permutations": args.permutations,
                       "C_grid": C_GRID, "threshold": 0.5, "class_weight": "balanced", "max_seconds_read": MAX_SECONDS,
                       "clean_segment_seconds": [MIN_CLEAN_SECONDS, MAX_CLEAN_SECONDS], "occlusion_margin_sec": OCCLUSION_MARGIN_SEC},
        "inputs": {"records": {p: records[p] for p in patients}, "labels_sha256": sha256_file(args.labels),
                   "patient_sheet_sha256": labels_doc["source_file"]["sha256"],
                   "code_sha256": {"workers/fisav-stenosis/evaluate.py": sha256_file(Path(__file__)),
                                   "apps/api/app/signal_processing.py": sha256_file(ROOT / "apps/api/app/signal_processing.py")}},
        "features": {"names": FEATURES, "channel": "raw PZT1", "values": {p: features[p] for p in patients}},
        "excluded_patients": excluded,
        "metrics": {"patients": len(patients), "stenosis": int(y.sum()), "no_stenosis": int(len(y) - y.sum()),
                    "auroc": auroc, "auroc_ci95": bootstrap_auc(y, mean_oof, args.seed),
                    "auroc_per_repeat_mean": float(np.mean(repeat_aucs)), "auroc_per_repeat_sd": float(np.std(repeat_aucs)),
                    "sensitivity": sensitivity, "specificity": specificity, "balanced_accuracy": (sensitivity + specificity) / 2,
                    "threshold": 0.5, "permutation_p_value": permutation_p},
        "baselines": {"majority_class": {"rule": "always predict stenosis present", "accuracy": float(y.mean()), "auroc": 0.5},
                      "exam_only": {"inputs": "systolic-only thrill and bruit from the patient sheet", "auroc": exam_auroc}},
        "predictions": {p: {"oof_probability": float(mean_oof[i]), "oof_sd_across_repeats": float(sd_oof[i]),
                            "predicted_stenosis": bool(predicted[i]), "reference_stenosis": bool(y[i])} for i, p in enumerate(patients)},
        "model": {"file": "model.json", "sha256": model_sha},
        "runtime": {"python": platform.python_version(), "numpy": np.__version__, "scikit_learn": sklearn.__version__,
                    "scipy": __import__("scipy").__version__},
        "limitations": [
            "Small single-centre cohort (59 patients); confidence intervals are wide and no external validation exists.",
            "Reference labels come from the dataset patient sheet and were not re-read for this evaluation.",
            "Sensor units are uncalibrated; features are relative and unit-free by design.",
            "Out-of-fold predictions describe this research cohort only. They are model predictions, not findings or diagnoses.",
        ],
    }
    (args.output_dir / "evaluation.json").write_text(json.dumps(evaluation, indent=2) + "\n", encoding="utf8")
    print(json.dumps({"status": "completed", "patients": len(patients), "excluded": len(excluded), "auroc": round(auroc, 3),
                      "auroc_ci95": [round(v, 3) for v in evaluation["metrics"]["auroc_ci95"]], "exam_only_auroc": round(exam_auroc, 3),
                      "permutation_p": permutation_p, "model_sha256": model_sha}))


if __name__ == "__main__":
    main()
