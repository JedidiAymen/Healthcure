"""SurgiVision frame browsing filters and the CVS self-check block, on synthetic Endoscapes fixtures."""
import hashlib
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
import pytest

from app.main import create_app
from helpers import auth_headers

RUBRIC = [
    {'id': 'evidence', 'title': 'Evidence use', 'description': 'Uses the frame.', 'max_points': 60},
    {'id': 'limits', 'title': 'Limits', 'description': 'States limits.', 'max_points': 40},
]

# (split, file name, video id, CVS annotator means, category names present)
SYNTHETIC_FRAMES = [
    ('train', '1_100.jpg', 1, [1, 1, 1], ['gallbladder', 'tool']),
    ('train', '1_200.jpg', 1, [1 / 3, 0, 0], ['gallbladder']),
    ('val', '2_100.jpg', 2, [2 / 3, 2 / 3, 1 / 3], ['tool']),
    ('test', '3_100.jpg', 3, [0, 0, 0], []),
]
CATEGORIES = [{'id': 1, 'name': 'gallbladder'}, {'id': 2, 'name': 'tool'}]


def _write_synthetic_endoscapes(root: Path) -> None:
    splits = {}
    for split in ('train', 'val', 'test'):
        split_dir = root / split
        split_dir.mkdir(parents=True)
        images, annotations, metas = [], [], []
        for index, (frame_split, name, video, cvs, names) in enumerate(SYNTHETIC_FRAMES, start=1):
            if frame_split != split:
                continue
            payload = f'synthetic-test-frame-{name}'.encode()
            (split_dir / name).write_bytes(payload)
            image_id = index * 1000
            images.append({'id': image_id, 'file_name': name, 'width': 854, 'height': 480, 'video_id': video, 'ds': cvs})
            for offset, category in enumerate(names):
                category_id = next(item['id'] for item in CATEGORIES if item['name'] == category)
                annotations.append({'id': image_id + offset, 'image_id': image_id, 'category_id': category_id, 'bbox': [10, 10, 50, 50]})
            metas.append({'file_name': name, 'image_id': image_id, 'video_id': video, 'width': 854, 'height': 480,
                          'size_bytes': len(payload), 'sha256': hashlib.sha256(payload).hexdigest()})
        raw = json.dumps({'images': images, 'categories': CATEGORIES, 'annotations': annotations}).encode()
        (split_dir / 'annotation_coco.json').write_bytes(raw)
        splits[split] = {'annotation_sha256': hashlib.sha256(raw).hexdigest(), 'images': metas}
    (root / 'medforge-source-manifest.json').write_text(json.dumps({
        'schema': 'medforge.source-manifest.endoscapes.v3', 'dataset': 'Endoscapes-BBox201', 'splits': splits,
    }), encoding='utf8')


@pytest.fixture
def client(monkeypatch, tmp_path):
    root = tmp_path / 'endoscapes'
    _write_synthetic_endoscapes(root)
    monkeypatch.setenv('MEDFORGE_ENDOSCAPES_ROOT', str(root))
    monkeypatch.delenv('MEDFORGE_OPENKBP_CASE_DIR', raising=False)
    monkeypatch.delenv('MEDFORGE_FISAV_ROOT', raising=False)
    monkeypatch.setenv('MEDFORGE_DB_PATH', str(tmp_path / 'surgivision.sqlite3'))
    return TestClient(create_app())


def _ids(payload):
    return [frame['id'] for frame in payload['frames']]


def test_frame_browser_filters_by_split_tool_criterion_and_disagreement(client):
    everything = client.get('/api/v1/surgivision/frames').json()
    assert everything['total'] == 4
    assert everything['facets']['categories'] == ['gallbladder', 'tool']
    assert everything['facets']['splits'] == {'test': 1, 'train': 2, 'val': 1}
    first = next(frame for frame in everything['frames'] if frame['id'] == 'endoscapes:train:1_100')
    assert first['categories'] == ['gallbladder', 'tool']
    assert first['disputed_criteria'] == 0 and first['agreement'] == 'unanimous'

    assert _ids(client.get('/api/v1/surgivision/frames?split=val').json()) == ['endoscapes:val:2_100']
    assert set(_ids(client.get('/api/v1/surgivision/frames?category=tool').json())) == {'endoscapes:train:1_100', 'endoscapes:val:2_100'}
    disputed = client.get('/api/v1/surgivision/frames?agreement=disputed').json()
    assert set(_ids(disputed)) == {'endoscapes:train:1_200', 'endoscapes:val:2_100'}
    assert next(frame for frame in disputed['frames'] if frame['id'] == 'endoscapes:val:2_100')['disputed_criteria'] == 3
    assert _ids(client.get('/api/v1/surgivision/frames?agreement=unanimous&criterion=two_structures&min_value=1').json()) == ['endoscapes:train:1_100']
    assert _ids(client.get('/api/v1/surgivision/frames?criterion=cystic_plate&max_value=0').json()) == ['endoscapes:train:1_200', 'endoscapes:test:3_100']
    paged = client.get('/api/v1/surgivision/frames?limit=1&offset=1').json()
    assert paged['total'] == 4 and len(paged['frames']) == 1
    assert client.get('/api/v1/surgivision/frames?criterion=unknown').status_code == 422
    assert client.get('/api/v1/surgivision/frames?min_value=0.9&max_value=0.1').status_code == 422


def test_frame_browser_is_not_available_to_students(client):
    student = auth_headers(client, 'learner', 'student')
    assert client.get('/api/v1/surgivision/frames', headers=student).status_code == 403


def _publish_cvs_lesson(client, educator, blocks):
    case_id = 'endoscapes:val:2_100'
    draft = client.post('/api/v1/educator/drafts', headers=educator, json={
        'title': 'CVS self-check', 'case_id': case_id,
        'content': {'rubric': 'Manual rubric.', 'rubric_criteria': RUBRIC, 'blocks': blocks}})
    assert draft.status_code == 201, draft.text
    assert client.get(f"/api/v1/educator/drafts/{draft.json()['id']}/preview", headers=educator).status_code in (200, 409)
    return draft.json()['id'], client.post(f"/api/v1/educator/drafts/{draft.json()['id']}/publish", headers=educator,
                                           json={'source_terms_confirmed': True, 'source_review_note': 'Synthetic test source reviewed.'})


SELF_CHECK_BLOCKS = [
    {'id': 'intro', 'type': 'Instruction', 'title': 'Look first', 'content': 'Judge the frame before revealing.'},
    {'id': 'cvs', 'type': 'CVS self-check', 'title': 'Judge the three criteria', 'content': 'Say whether each criterion is achieved.'},
    {'id': 'why', 'type': 'Question', 'title': 'Explain', 'content': 'Explain one judgement.'},
]


def test_cvs_self_check_commits_before_revealing_annotator_means(client):
    educator = auth_headers(client, 'teacher', 'educator')
    student_headers = auth_headers(client, 'learner', 'student')
    _, published = _publish_cvs_lesson(client, educator, SELF_CHECK_BLOCKS)
    assert published.status_code == 200, published.text
    cohort = client.post('/api/v1/educator/cohorts', headers=educator, json={'name': 'Synthetic cohort'}).json()
    assert client.post(f"/api/v1/educator/cohorts/{cohort['id']}/students", headers=educator, json={'student_id': 'test-learner'}).status_code == 201
    assignment = client.post('/api/v1/educator/assignments', headers=educator,
                             json={'lesson_version_id': published.json()['version_id'], 'cohort_id': cohort['id']}).json()
    attempt = client.post('/api/v1/academy/attempts', headers=student_headers, json={'assignment_id': assignment['id']}).json()
    block_url = f"/api/v1/academy/attempts/{attempt['attempt_id']}/cvs-self-check/cvs"

    # Nothing is revealed before the learner commits a judgement.
    assert client.get(block_url, headers=student_headers).status_code == 404
    assert 'ds' not in json.dumps(attempt) and '0.666' not in json.dumps(attempt)
    assert client.post(f"/api/v1/academy/attempts/{attempt['attempt_id']}/cvs-self-check/why", headers=student_headers,
                       json={'judgements': [1, 1, 0]}).status_code == 404

    committed = client.post(block_url, headers=student_headers, json={'judgements': [1, 0, 0]})
    assert committed.status_code == 200, committed.text
    result = committed.json()
    assert result['judgements'] == [1, 0, 0]
    criteria = {item['criterion_id']: item for item in result['criteria']}
    assert criteria['two_structures']['annotator_mean'] == pytest.approx(2 / 3)
    assert criteria['two_structures']['annotators_disagreed'] is True
    assert criteria['two_structures']['matches_majority'] is True
    assert criteria['hepatocystic_triangle']['matches_majority'] is False
    assert criteria['cystic_plate']['matches_majority'] is True
    assert result['matches'] == 2
    assert any('three annotators' in note for note in result['limitations'])

    # The commitment is immutable; repeating it is idempotent, changing it is refused.
    assert client.post(block_url, headers=student_headers, json={'judgements': [1, 0, 0]}).json() == result
    assert client.post(block_url, headers=student_headers, json={'judgements': [0, 0, 0]}).status_code == 409
    assert client.get(block_url, headers=student_headers).json() == result
    assert client.post(block_url, headers=student_headers, json={'judgements': [1, 2, 0]}).status_code == 422

    # Another student cannot read this attempt's self-check.
    other = auth_headers(client, 'other', 'student')
    assert client.get(block_url, headers=other).status_code in (403, 404)

    # Educators see the committed judgement in review.
    saved = client.put(f"/api/v1/academy/attempts/{attempt['attempt_id']}/draft", headers=student_headers, json={
        'expected_revision': 0, 'observations': [{'block_id': 'why', 'response': 'Two structures look visible.'}],
        'viewer_evidence': {'kind': 'surgivision', 'case_id': 'endoscapes:val:2_100', 'frame_id': '2_100',
                            'selection_x_px': 10, 'selection_y_px': 10}})
    assert saved.status_code == 200, saved.text
    submitted = client.post(f"/api/v1/academy/attempts/{attempt['attempt_id']}/submit", headers={**student_headers, 'Idempotency-Key': 'synthetic-key-1'},
                            json={'expected_revision': saved.json()['revision']})
    assert submitted.status_code == 200, submitted.text
    reviews = client.get(f"/api/v1/educator/assignments/{assignment['id']}/attempts", headers=educator).json()
    assert reviews[0]['cvs_self_checks'][0]['block_id'] == 'cvs'
    assert reviews[0]['cvs_self_checks'][0]['judgements'] == [1, 0, 0]


def test_submission_requires_every_cvs_self_check_to_be_committed(client):
    educator = auth_headers(client, 'teacher', 'educator')
    student_headers = auth_headers(client, 'learner', 'student')
    _, published = _publish_cvs_lesson(client, educator, SELF_CHECK_BLOCKS)
    cohort = client.post('/api/v1/educator/cohorts', headers=educator, json={'name': 'Synthetic cohort'}).json()
    client.post(f"/api/v1/educator/cohorts/{cohort['id']}/students", headers=educator, json={'student_id': 'test-learner'})
    assignment = client.post('/api/v1/educator/assignments', headers=educator,
                             json={'lesson_version_id': published.json()['version_id'], 'cohort_id': cohort['id']}).json()
    attempt = client.post('/api/v1/academy/attempts', headers=student_headers, json={'assignment_id': assignment['id']}).json()
    saved = client.put(f"/api/v1/academy/attempts/{attempt['attempt_id']}/draft", headers=student_headers, json={
        'expected_revision': 0, 'observations': [{'block_id': 'why', 'response': 'An answer.'}],
        'viewer_evidence': {'kind': 'surgivision', 'case_id': 'endoscapes:val:2_100', 'frame_id': '2_100',
                            'selection_x_px': 10, 'selection_y_px': 10}})
    assert saved.status_code == 200, saved.text
    response = client.post(f"/api/v1/academy/attempts/{attempt['attempt_id']}/submit", headers={**student_headers, 'Idempotency-Key': 'synthetic-key-2'},
                           json={'expected_revision': saved.json()['revision']})
    assert response.status_code == 422
    assert response.json()['detail']['code'] == 'CVS_SELF_CHECK_REQUIRED'


def test_cvs_self_check_blocks_publish_only_on_surgivision_lessons(client, monkeypatch, tmp_path):
    educator = auth_headers(client, 'teacher', 'educator')
    _, published = _publish_cvs_lesson(client, educator, SELF_CHECK_BLOCKS)
    assert published.status_code == 200
    # A self-check alone counts as the learner task required for publication.
    _, alone = _publish_cvs_lesson(client, educator, [SELF_CHECK_BLOCKS[1]])
    assert alone.status_code == 200, alone.text

    # Other modules have no CVS reference, so the block is refused when the draft is saved.
    case_dir = tmp_path / 'test-synthetic-case'
    case_dir.mkdir()
    (case_dir / 'voxel_dimensions.csv').write_text('2.0\n2.0\n2.0\n', encoding='utf8')
    for name, rows in [('ct.csv', '0,100\n'), ('dose.csv', '0,12\n'), ('possible_dose_mask.csv', '0,\n')]:
        (case_dir / name).write_text(',data\n' + rows, encoding='utf8')
    monkeypatch.setenv('MEDFORGE_OPENKBP_CASE_DIR', str(case_dir))
    monkeypatch.setenv('MEDFORGE_SOURCE_KIND', 'synthetic-test')
    with_dose = TestClient(create_app())
    refused = with_dose.post('/api/v1/educator/drafts', headers=educator, json={
        'title': 'Wrong module', 'case_id': 'openkbp:test-synthetic-case',
        'content': {'rubric': '', 'rubric_criteria': RUBRIC, 'blocks': [SELF_CHECK_BLOCKS[1]]}})
    assert refused.status_code == 422
    assert refused.json()['detail']['code'] == 'CVS_SELF_CHECK_MODULE'
