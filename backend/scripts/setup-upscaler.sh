#!/usr/bin/env bash
set -euo pipefail

backend_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
venv_path="$backend_root/.venv"
model_path="$backend_root/models"

if [[ ! -x "$venv_path/bin/python" ]]; then
  echo "Backend environment is missing. Run: bash backend/scripts/setup.sh" >&2
  exit 1
fi

uv pip install --python "$venv_path/bin/python" "spandrel==0.4.2"
mkdir -p "$model_path"

"$venv_path/bin/python" "$backend_root/scripts/fetch-upscaler-models.py" "$model_path"
"$venv_path/bin/python" -c "import spandrel; print(f'Ready: Spandrel {spandrel.__version__}')"
