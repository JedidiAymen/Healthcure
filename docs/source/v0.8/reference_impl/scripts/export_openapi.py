"""Generate machine-readable OpenAPI from the executed FastAPI reference code."""
import json
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'apps'/'api'))
from app.main import app
path=Path(__file__).resolve().parents[1]/'contracts'/'openapi-implemented.json'
path.write_text(json.dumps(app.openapi(),indent=2,sort_keys=True)+'\n',encoding='utf8')
print(path)
