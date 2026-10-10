"""User-facing copy and docs carry no unsupported clinical, regulatory or security claims."""
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'scripts'))
import check_claims  # noqa: E402


def test_repository_has_no_unsupported_claims():
    result = subprocess.run([sys.executable, str(ROOT / 'scripts' / 'check_claims.py')], capture_output=True, text=True, timeout=120)
    assert result.returncode == 0, result.stdout[-3000:]


def test_claims_are_flagged_and_negations_pass():
    flagged = check_claims.scan_text('The model diagnoses stenosis in real time.', 'x.md')
    assert [item.phrase.lower() for item in flagged] == ['diagnoses']
    assert check_claims.scan_text('MEDFORGE does not diagnose stenosis.', 'x.md') == []
    assert check_claims.scan_text('This is a clinically validated classifier.', 'x.md')
    assert check_claims.scan_text('The index is not clinically validated.', 'x.md') == []
    assert check_claims.scan_text('Our platform is GDPR compliant and fully secure.', 'x.md')
    assert check_claims.scan_text('It detects stenosis from the bruit.', 'x.md')


def test_technical_terms_are_not_banned():
    assert check_claims.scan_text('R-peak beat detection uses the ECG lead.', 'x.md') == []
    assert check_claims.scan_text('Endoscapes is a 1 fps sampled still sequence.', 'x.md') == []
