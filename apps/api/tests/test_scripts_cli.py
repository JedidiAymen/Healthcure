"""Every project script answers --help without downloading data or writing files."""
import os
from pathlib import Path
import subprocess
import sys

import pytest

ROOT = Path(__file__).resolve().parents[3]
SCRIPTS = sorted((ROOT / 'scripts').glob('*.py'))


@pytest.mark.parametrize('script', SCRIPTS, ids=lambda path: path.name)
def test_script_help_exits_without_side_effects(script, tmp_path):
    env = {**os.environ, 'MEDFORGE_DB_PATH': str(tmp_path / 'help.sqlite3'),
           # A dead proxy makes any accidental network call fail fast instead of downloading.
           'HTTP_PROXY': 'http://127.0.0.1:9', 'HTTPS_PROXY': 'http://127.0.0.1:9'}
    result = subprocess.run([sys.executable, str(script), '--help'], cwd=tmp_path, env=env,
                            capture_output=True, text=True, timeout=60)
    assert result.returncode == 0, result.stderr[-2000:]
    assert 'usage:' in result.stdout.lower()
    assert not (tmp_path / 'help.sqlite3').exists()
