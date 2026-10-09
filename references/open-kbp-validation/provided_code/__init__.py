"""Minimal local package shim for the vendored OpenKBP evaluator files.

The upstream __init__ also imports model-training code and TensorFlow. MEDFORGE
uses only the pinned data loader and DoseEvaluator modules for offline
cross-checks; those unneeded model imports are intentionally not loaded.
"""
