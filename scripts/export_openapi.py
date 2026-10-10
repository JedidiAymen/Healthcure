"""Generate machine-readable OpenAPI from the executed FastAPI reference code."""
import argparse
import json
import os
from pathlib import Path
import sys
import tempfile


def main() -> None:
    argparse.ArgumentParser(description=__doc__).parse_args()
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'apps' / 'api'))
    with tempfile.TemporaryDirectory() as scratch:
        # Importing the app initialises a database; keep it away from local research data.
        os.environ['MEDFORGE_DB_PATH'] = str(Path(scratch) / 'openapi.sqlite3')
        from app.main import app
        spec = app.openapi()
    path = Path(__file__).resolve().parents[1] / 'contracts' / 'openapi-implemented.json'
    path.write_text(json.dumps(spec, indent=2, sort_keys=True) + '\n', encoding='utf8')
    print(path)


if __name__ == '__main__':
    main()
