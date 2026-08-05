#!/usr/bin/env bash
set -euo pipefail

backend_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
python_path="$backend_root/.venv/bin/python"

if [[ ! -x "$python_path" ]]; then
  echo "Backend environment is missing. Run: bash backend/scripts/setup.sh" >&2
  exit 1
fi

cd "$backend_root"
env_args=()
if [[ -f "$backend_root/.env" ]]; then
  env_args=(--env-file .env)
fi
exec "$python_path" -m uvicorn app.main:app --host "${HOST:-127.0.0.1}" --port "${PORT:-8008}" "${env_args[@]}"
