#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
python_path="$project_root/.venv-sam3/bin/python"

if [[ ! -x "$python_path" ]]; then
  echo "SAM 3 environment is missing. Run: pnpm setup:sam3" >&2
  exit 1
fi

cd "$project_root"
exec "$python_path" -m uvicorn sam3_service.app:app --host 127.0.0.1 --port 8008
