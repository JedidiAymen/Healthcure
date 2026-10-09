#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

uv python install 3.10
uv venv --python 3.10 workers/.venvs/cvs-adaptnet
uv pip install \
  --python workers/.venvs/cvs-adaptnet/bin/python \
  --index-url https://pypi.org/simple \
  -r workers/cvs-adaptnet/requirements.txt
uv pip install \
  --python workers/.venvs/cvs-adaptnet/bin/python \
  --index-url https://pypi.org/simple \
  -r workers/cvs-adaptnet/requirements-pytorch.txt
uv pip install \
  --python workers/.venvs/cvs-adaptnet/bin/python \
  --index-url https://pypi.org/simple \
  torchmetrics==1.2.0
uv pip install \
  --python workers/.venvs/cvs-adaptnet/bin/python \
  --index-url https://pypi.org/simple \
  --no-deps \
  git+https://github.com/openai/CLIP.git@d05afc436d78f1c48dc0dbf8e5980a9d471f35f6

workers/.venvs/cvs-adaptnet/bin/python - <<'PY'
import torch
import torchvision
import transformers

print(f"torch={torch.__version__}; torchvision={torchvision.__version__}; transformers={transformers.__version__}")
print(f"CUDA available={torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"GPU={torch.cuda.get_device_name(0)}; VRAM={torch.cuda.get_device_properties(0).total_memory}")
PY
