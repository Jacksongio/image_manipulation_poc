#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
venv_path="$project_root/.venv-sam3"

uv venv --python 3.12 "$venv_path"
uv pip install --python "$venv_path/bin/python" \
  torch==2.10.0 torchvision \
  --index-url https://download.pytorch.org/whl/cu128
uv pip install --python "$venv_path/bin/python" \
  -r "$project_root/sam3_service/requirements.txt" \
  "git+https://github.com/facebookresearch/sam3.git"

"$venv_path/bin/python" -c "import torch; assert torch.cuda.is_available(); print(f'Ready: {torch.cuda.get_device_name(0)}')"
