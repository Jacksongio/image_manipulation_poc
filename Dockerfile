FROM node:22-alpine AS frontend-build
WORKDIR /frontend
# Corepack installs the exact pnpm named by the "packageManager" field, which
# must stay in step with the lockfile: pnpm 11 stopped reading pnpm.overrides
# from package.json, so a newer client sees no overrides and rejects the lock.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY frontend/ ./
# Empty NEXT_PUBLIC_API_URL makes the browser call the same origin that serves the UI.
ENV NEXT_PUBLIC_API_URL=""
RUN pnpm build

FROM nvidia/cuda:12.8.1-cudnn-runtime-ubuntu24.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# The font packages back the Text and Text Design tools; without them the
# renderer finds no families on disk and falls back to a bitmap face.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git python3.12 python3-pip python3-venv \
      fonts-dejavu fonts-lato fonts-ubuntu \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --break-system-packages --no-cache-dir \
      torch==2.10.0 torchvision --index-url https://download.pytorch.org/whl/cu128 \
    && pip install --break-system-packages --no-cache-dir -r requirements.txt \
      "git+https://github.com/facebookresearch/sam3.git"

COPY backend/scripts/fetch-upscaler-models.py ./scripts/fetch-upscaler-models.py
RUN python3 scripts/fetch-upscaler-models.py /app/models
COPY backend/app ./app
COPY --from=frontend-build /frontend/out ./static

EXPOSE 8008
CMD ["python3", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8008"]
