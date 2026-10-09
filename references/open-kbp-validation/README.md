# Pinned OpenKBP evaluator subset

This folder contains the MIT-licensed OpenKBP reference loader and evaluator modules used to cross-check MEDFORGE calculations. It is not the complete upstream repository. Source file hashes and the exact inspected commit are in `SOURCE.json`; the upstream license is included.

The local `provided_code/__init__.py` is a minimal package shim so importing the evaluation modules does not pull in upstream model-training code or TensorFlow. The loader and metric implementation files themselves match the pinned upstream Git blobs.

Install the isolated reference-evaluator dependencies with `python -m pip install -r workers/openkbp-validation/requirements.txt`, then run `python scripts/crosscheck_openkbp_pt201.py` from the MEDFORGE root after acquiring the local ignored case. The dataset itself is not covered by the repository's software license; see `docs/openkbp-pt201-manifest.json` and retain the case's source provenance.
