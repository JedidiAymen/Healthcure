"""Starter lessons authored as data are valid drafts that respect each dataset's rules."""
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pytest

from app.schemas import EducatorDraftContent

LESSONS = sorted((Path(__file__).resolve().parents[3] / 'content' / 'lessons').glob('*.json'))


def test_required_starter_lessons_exist():
    modules = [json.loads(path.read_text(encoding='utf8'))['module'] for path in LESSONS]
    assert modules.count('surgivision') >= 2 and 'fistulaguard' in modules and 'dosetwin' in modules


@pytest.mark.parametrize('path', LESSONS, ids=lambda path: path.stem)
def test_starter_lesson_is_a_valid_reviewable_draft(path):
    raw = path.read_text(encoding='utf8')
    lesson = json.loads(raw)
    assert '—' not in raw, 'no em dashes in authored copy'
    assert lesson['title'].startswith('DRAFT:') and 'domain expert' in lesson['review_status']
    assert len(lesson['learning_objectives']) >= 2
    content = EducatorDraftContent.model_validate({key: lesson[key] for key in ('rubric', 'rubric_criteria', 'blocks')})
    assert sum(item.max_points for item in content.rubric_criteria) == 100
    types = [block.type for block in content.blocks]
    assert 'Question' in types or 'CVS self-check' in types
    if 'CVS self-check' in types:
        assert lesson['module'] == 'surgivision'
    if lesson['module'] == 'dosetwin':
        assert 'unpublishable' in lesson['title'] and 'cannot be published' in lesson['review_status']
