# Photo Finale

Photo Finale is a single-user image manipulation proof of concept with a separately deployable Next.js frontend and Python FastAPI backend.

## Architecture

```text
frontend/  Next.js UI
    │
    └── multipart HTTP requests
            │
backend/   FastAPI API
    ├── Gemini image editing (art style, magic edit, border expansion, AI restore)
    ├── SAM 3 point-based segmentation on CUDA
    └── Real-ESRGAN 2×/4× upscaling on CUDA
```

There is no database, authentication, or durable application state. Images are sent directly to FastAPI and generated images are returned directly in the response. The only external persistence involved is whatever the Gemini API itself retains under its service terms.

## Local setup

Prerequisites:

- Node.js 22 and pnpm
- Python 3.12 and [`uv`](https://docs.astral.sh/uv/)
- An NVIDIA GPU with a CUDA-compatible driver for SAM 3 and Faithful upscaling
- Access to the gated `facebook/sam3` checkpoint on Hugging Face
- A Gemini API key for the cloud-powered tools

Install the frontend and backend:

```bash
pnpm --dir frontend install
pnpm setup:backend
```

Create the backend environment file:

```bash
cp backend/.env.example backend/.env
```

Set `GEMINI_API_KEY` in `backend/.env`, then authenticate with Hugging Face if the SAM checkpoint is not already cached:

```bash
backend/.venv/bin/hf auth login
```

Run the services in two terminals:

```bash
pnpm dev:backend
pnpm dev:frontend
```

Open [http://localhost:3009](http://localhost:3009). FastAPI listens on `http://127.0.0.1:8008`, and its interactive API documentation is at [http://127.0.0.1:8008/docs](http://127.0.0.1:8008/docs).

## Environment variables

Backend (`backend/.env`):

| Variable | Purpose | Default |
|---|---|---|
| `GEMINI_API_KEY` | Enables Gemini-powered image tools | Required for Gemini routes |
| `GEMINI_IMAGE_MODEL` | Gemini image model ID | `gemini-3.1-flash-image` |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins | Local port 3009 origins |
| `HOST` | Local bind address | `127.0.0.1` |
| `PORT` | Local API port | `8008` |

Frontend (`frontend/.env.local`):

| Variable | Purpose | Default |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Public FastAPI base URL | `http://127.0.0.1:8008` |

`NEXT_PUBLIC_API_URL` is embedded into the browser bundle, so set it to the publicly reachable backend URL when building the frontend.

## API surface

| Endpoint | Function |
|---|---|
| `GET /health` | CUDA and model readiness |
| `POST /segment` | SAM 3 point-based segmentation |
| `POST /upscale` | Local Real-ESRGAN upscaling |
| `POST /ai/upscale` | Gemini AI restoration |
| `POST /art-style` | Gemini style transfer |
| `POST /magic-edit` | Mask-guided Gemini editing |
| `POST /border-expand` | Gemini outpainting for print ratios |

## Verification

```bash
pnpm typecheck
pnpm build
python3 -m compileall -q backend/app
```

## Deployment notes

The two directories include independent Dockerfiles. Build the frontend with the deployed API URL:

```bash
docker build --build-arg NEXT_PUBLIC_API_URL=https://api.example.com -t photo-finale-frontend frontend
docker build -t photo-finale-backend backend
```

The backend container requires an NVIDIA GPU runtime for segmentation and Faithful upscaling. Configure `GEMINI_API_KEY`, `HF_TOKEN`, and `CORS_ORIGINS` as backend secrets/environment variables. The first SAM request downloads the gated checkpoint, so production hosting should use a persistent Hugging Face cache or bake an authorized checkpoint into a private image.

This architecture intentionally serializes local GPU inference and keeps no user records, which is appropriate for the current single-user demonstration. Add authentication, rate limiting, object storage, and a job queue before turning it into a public multi-user service.
