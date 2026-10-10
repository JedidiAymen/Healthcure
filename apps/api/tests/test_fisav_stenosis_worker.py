"""The isolated stenosis worker runs end to end on a visibly synthetic cohort (no real recordings)."""
import hashlib
import json
import os
from pathlib import Path
import subprocess

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[3]
WORKER_PY = ROOT / 'workers' / '.venvs' / 'fisav-stenosis' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
FS = 10_000


def _synthetic_recording(path: Path, rng: np.random.Generator, systolic_heavy: bool) -> str:
    seconds = 25
    t = np.arange(seconds * FS) / FS
    ecg = 0.02 * rng.standard_normal(len(t))
    vib = 0.05 * rng.standard_normal(len(t))
    for beat in np.arange(0.3, seconds, 0.85):
        ecg += np.exp(-((t - beat) ** 2) / (2 * 0.008 ** 2))
        burst = np.exp(-((t - beat - (0.15 if systolic_heavy else 0.55)) ** 2) / (2 * 0.06 ** 2))
        vib += burst * np.sin(2 * np.pi * 400 * t) * 0.8
    rows = ['Time,ECG,raw PZT1,raw PZT2,raw PZT3,raw PZT4,Occlusion']
    rows += [f'{t[i]:.4f},{ecg[i]:.5f},{vib[i]:.5f},0,0,0,0' for i in range(len(t))]
    payload = ('\n'.join(rows) + '\n').encode()
    path.write_bytes(payload)
    return hashlib.sha256(payload).hexdigest()


@pytest.mark.skipif(not WORKER_PY.exists(), reason='isolated worker venv not installed (workers/.venvs/fisav-stenosis)')
def test_worker_evaluates_a_synthetic_cohort_and_writes_hashed_outputs(tmp_path):
    rng = np.random.default_rng(3)
    root = tmp_path / 'fisav-synthetic'
    root.mkdir()
    records, patients = [], {}
    for index in range(1, 13):
        name = f'pat{index:03d}'
        stenosis = index <= 6
        digest = _synthetic_recording(root / f'{name}.csv', rng, systolic_heavy=stenosis)
        records.append({'file_name': f'{name}.csv', 'sha256': digest})
        patients[name] = {'stenosis': stenosis, 'occlusion_test': False, 'prior_pta': False,
                          'thrill_pattern': 'Systolic-diastolic', 'bruit_pattern': 'Systolic-diastolic', 'pzt1_position': 'Over the anastomosis'}
    (root / 'medforge-source-manifest.json').write_text(json.dumps({'records': records}), encoding='utf8')
    labels = tmp_path / 'labels.json'
    labels.write_text(json.dumps({'source_file': {'sha256': '0' * 64}, 'patients': patients}), encoding='utf8')
    out = tmp_path / 'out'
    result = subprocess.run([str(WORKER_PY), str(ROOT / 'workers/fisav-stenosis/evaluate.py'), '--fisav-root', str(root), '--labels', str(labels),
                             '--output-dir', str(out), '--repeats', '2', '--permutations', '5'], capture_output=True, text=True, timeout=600)
    assert result.returncode == 0, result.stderr[-3000:]
    evaluation = json.loads((out / 'evaluation.json').read_text(encoding='utf8'))
    model_bytes = (out / 'model.json').read_bytes()
    assert evaluation['model']['sha256'] == hashlib.sha256(model_bytes).hexdigest()
    assert evaluation['parameters']['fold_grouping'].startswith('patient')
    assert set(evaluation['predictions']) == set(patients)
    assert all(0 <= item['oof_probability'] <= 1 for item in evaluation['predictions'].values())
    assert len(evaluation['features']['names']) == 9
    # The planted difference is easy, so a working pipeline must rank it well.
    assert evaluation['metrics']['auroc'] > 0.8
