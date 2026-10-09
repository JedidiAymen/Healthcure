# CVS-AdaptNet local evaluation worker

This worker runs the upstream CVS-AdaptNet model in a separate Python 3.10 environment. It is intended for local non-commercial scientific research and education. It does not provide clinical clearance or patient-care guidance.

## Pinned sources

- CVS-AdaptNet code: `references/upstream/CVS-AdaptNet`, revision `bb21ffbd781b6f943be0daaeeccf1567c21e691d`, CC BY-NC-SA 4.0.
- SurgVLP code: `references/upstream/SurgVLP`, revision `85e858998eec47614614b89f6af1363e0ad3f47b`.
- OpenAI CLIP dependency: revision `d05afc436d78f1c48dc0dbf8e5980a9d471f35f6`.
- The trained checkpoint is downloaded only from the official CVS-AdaptNet README link by `python3 scripts/acquire_cvs_adaptnet_checkpoint.py`. The upstream file is 1,596,737,924 bytes. The publisher does not provide a SHA-256 value; MEDFORGE records the locally computed digest and verifies the exact advertised length.
- The text backbone uses the MIT-licensed `emilyalsentzer/Bio_ClinicalBERT` model at pinned revision `d5892b39a4adaed74b92212a44081509db72f87b`; the pinned LICENSE file is checked and every downloaded file gets a local SHA-256 manifest.

## Local setup and evaluation

```bash
bash workers/cvs-adaptnet/setup_runtime.sh
python3 scripts/acquire_cvs_adaptnet_checkpoint.py
workers/.venvs/cvs-adaptnet/bin/python scripts/acquire_bioclinicalbert.py
workers/.venvs/cvs-adaptnet/bin/python workers/cvs-adaptnet/evaluate_endoscapes.py \
  --split val \
  --output docs/evidence/cvs-adaptnet-validation.json
```

The evaluation applies the upstream resize, center crop and ImageNet normalization, scores the three source prompts, and calculates per-criterion Average Precision on the authentic split labels. Before inference, it asserts that batched tokenization exactly matches upstream `process_text()` for `input_ids`, `attention_mask` and `token_type_ids`; the evidence report records the tokenizer and token-tensor digest. The validation run is not a clinical validation. A capped `--limit` invocation is only a smoke run and is explicitly labeled in its output.

Completed on CUDA 11.8 / RTX 3050: the full 409-record validation split scored AP 0.496406 / 0.502367 / 0.500541 for C1/C2/C3. The reproducible report is `docs/evidence/cvs-adaptnet-validation.json`; it records checkpoint/backbone/prompt/annotation hashes and every frame hash. It also records that 38 official records are identical all-black images; the official metric retains them, and AP is unchanged when identical image bytes are counted once. This is research evaluation, not clinical validation.

For a selected locally installed frame, the worker also accepts `--case-id endoscapes:<split>:<image_id>` and emits a case-scoped report. The API adapter accepts only a verified local case ID, invokes the worker in the isolated runtime, checks frame/annotation/prompt/model/dataset provenance and source labels, then persists running/completed/failed state and output scores with an idempotency key. `docs/evidence/cvs-adaptnet-case-run.json` records a real selected-frame run. The Model Lab action remains disabled because the publisher provides no independent checkpoint checksum and does not state this checkpoint's license separately. No image or annotation is uploaded by this worker.
