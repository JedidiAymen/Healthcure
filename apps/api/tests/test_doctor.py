"""Local source readiness counts only the source files in each manifest."""
import json
from pathlib import Path
import sqlite3
import sys

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'scripts'))
import doctor  # noqa: E402


def test_hackcure_reviewer_preflight_uses_the_role_local_login_will_select():
    conn = sqlite3.connect(':memory:')
    conn.executescript('''
        CREATE TABLE users (id TEXT PRIMARY KEY);
        CREATE TABLE role_grants (user_id TEXT, role TEXT, scope TEXT);
        CREATE TABLE local_credentials (user_id TEXT PRIMARY KEY);
    ''')
    for user_id, roles in {
        'reviewer': ('clinical_reviewer',),
        'educator_then_reviewer': ('clinical_reviewer', 'educator'),
        'admin_and_reviewer': ('clinical_reviewer', 'admin'),
    }.items():
        conn.execute('INSERT INTO users(id) VALUES(?)', (user_id,))
        conn.execute('INSERT INTO local_credentials(user_id) VALUES(?)', (user_id,))
        conn.executemany(
            "INSERT INTO role_grants(user_id,role,scope) VALUES(?,?,'platform')",
            ((user_id, role) for role in roles),
        )

    assert doctor._has_signin_capable_reviewer(conn) is True
    conn.execute("DELETE FROM local_credentials WHERE user_id='reviewer'")
    conn.execute("DELETE FROM local_credentials WHERE user_id='admin_and_reviewer'")
    assert doctor._has_signin_capable_reviewer(conn) is False
    conn.execute("INSERT INTO local_credentials(user_id) VALUES('admin_and_reviewer')")
    assert doctor._has_signin_capable_reviewer(conn) is True
    conn.close()


def test_endoscapes_readiness_ignores_additional_sampled_release_images(tmp_path, monkeypatch):
    root = tmp_path / 'endoscapes'
    images = {'train': ['100_27200.jpg'], 'val': ['125_13175.jpg'], 'test': []}
    splits = {}
    for split, names in images.items():
        split_dir = root / split
        split_dir.mkdir(parents=True)
        entries = []
        for image_id, file_name in enumerate(names, start=1):
            (split_dir / file_name).write_bytes(b'manifested frame')
            entries.append({'image_id': image_id, 'file_name': file_name})
        (split_dir / 'annotation_coco.json').write_text('{}', encoding='utf8')
        splits[split] = {'image_count': len(entries), 'images': entries}

    # These belong to a separate, much larger sampled-frame inventory.
    extra = root / 'train_seg'
    extra.mkdir()
    (extra / '100_27225.jpg').write_bytes(b'additional sampled frame')
    (root / 'medforge-source-manifest.json').write_text(json.dumps({
        'dataset': 'Endoscapes-BBox201', 'splits': splits,
    }), encoding='utf8')
    monkeypatch.setenv('MEDFORGE_ENDOSCAPES_ROOT', str(root))

    readiness = doctor.source_readiness()['endoscapes_bbox201']

    assert readiness['manifest_image_count'] == 2
    assert readiness['image_files_present'] == 2
    assert readiness['split_annotation_files_present'] == 3
    assert readiness['ready'] is True
