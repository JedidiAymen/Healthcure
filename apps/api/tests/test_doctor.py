"""Local source readiness counts only the source files in each manifest."""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'scripts'))
import doctor  # noqa: E402


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
