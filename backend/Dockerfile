FROM nvidia/cuda:12.8.1-cudnn-runtime-ubuntu24.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends git python3.12 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./
RUN pip install --break-system-packages --no-cache-dir \
      torch==2.10.0 torchvision --index-url https://download.pytorch.org/whl/cu128 \
    && pip install --break-system-packages --no-cache-dir -r requirements.txt \
      "git+https://github.com/facebookresearch/sam3.git"

COPY scripts/fetch-upscaler-models.py ./scripts/fetch-upscaler-models.py
RUN python3 scripts/fetch-upscaler-models.py /app/models
COPY app ./app

EXPOSE 8008
CMD ["python3", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8008"]
