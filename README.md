# Photo Finale

Photo Finale is a single-user image manipulation proof of concept with a Next.js frontend and Python FastAPI backend, deployable together as a single Docker container.

## Architecture

```text
frontend/  Next.js UI — pointer gestures, layout, and canvas presentation only
    │
    └── multipart HTTP requests
            │
backend/   FastAPI API
    ├── app/tools/   every sidebar tool's logic (Pillow + NumPy, CPU only)
    │     ├── geometry.py       Transform: aspect presets, flips, rotation, crop
    │     ├── adjustments.py    Adjust: the twelve sliders, as a tone curve
    │     ├── filter_presets.py Filters: preset and variant definitions
    │     ├── color_pipeline.py Applies Adjust and Filters in one pass
    │     ├── focus_effects.py  Focus: gradient-masked selective blur
    │     ├── text_designs.py   Text Design: the sixteen templates
    │     ├── layer_painter.py  Rasterises text, text-design, and brush layers
    │     ├── renderer.py       Composites a preview or a final image
    │     └── catalog.py        Describes every control to the sidebar
    ├── Gemini image editing (art style, magic edit, border expansion, AI restore)
    ├── SAM 3 point-based segmentation on CUDA
    └── Real-ESRGAN 2×/4× upscaling on CUDA
```

All editing logic lives in Python. The frontend collects pointer gestures into an
edit document, posts it, and draws what comes back: `POST /tools/preview` returns
the graded background plus one transparent sprite per layer, so dragging a text
box stays at pointer speed while every pixel decision happens server-side.
`POST /tools/compose` produces the authoritative full-resolution flatten used for
Save and as the input to each AI tool.

**The backend must be running for the editor to work at all.** The sidebar builds
itself from `GET /tools/catalog` and the canvas is rendered by the backend, so the
frontend on its own will sit on the upload screen.

There is no database, authentication, or durable application state. Images are sent directly to FastAPI and generated images are returned directly in the response. The only external persistence involved is whatever the Gemini API itself retains under its service terms.

### What each feature needs

| Tools | Requires |
|---|---|
| Transform, Adjust, Filters, Text, Text Design, Brush, Focus, Save | Backend running. CPU only |
| Magic Edit — picking an object | NVIDIA GPU (SAM 3) |
| Upscaler — Faithful mode | NVIDIA GPU (Real-ESRGAN) |
| Magic Edit — applying, Art Style, Upscaler AI mode, Border Expander | `GEMINI_API_KEY` |

The FastAPI app imports Torch at startup, so the machine-learning dependencies must be
installed for the server to boot even when you only intend to use the CPU tools.

## Running with Docker Compose

The quickest way to get the whole thing up. The UI is exported to static files
during the build and served by FastAPI, so one container covers both halves and
the browser talks to the same origin that served it.

```bash
cp backend/.env.example backend/.env   # only the Gemini tools need this
docker compose up -d
```

Open [http://localhost:8008](http://localhost:8008) — the UI, the API, and
`/docs` all share the port.

```bash
docker compose logs -f    # follow the logs
docker compose down       # stop and remove the container
```

The first build pulls the CUDA base image and the CUDA build of Torch, so it
takes roughly ten minutes and produces a 7 GB image. Docker spends much of that
time on a single `exporting layers` line with no progress bar, which looks
stalled but is not. Later runs reuse the image and start in seconds.

Compose reads `backend/.env` if it exists and starts without it if it does not,
since none of the CPU tools need credentials.

### Enabling the GPU tools

The base compose file deliberately asks for no GPU, so it starts on any machine.
SAM 3 segmentation and Faithful upscaling do need one, and reaching them requires
the [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)
on the host — a working `nvidia-smi` is not sufficient on its own:

```bash
docker compose -f compose.yaml -f compose.gpu.yaml up -d
```

If the toolkit is missing, Docker refuses the container with
`could not select device driver "" with capabilities: [[gpu]]`. Every other tool
keeps working on the CPU in the meantime.

## Running the dev servers

Use this instead of Compose when you want hot reload.

### 1. Prerequisites

Required:

- Node.js 22 and pnpm
- Python 3.12 and [`uv`](https://docs.astral.sh/uv/)
- TrueType fonts installed for the text tools. Most Linux desktops already have
  these; on a bare server install them with
  `sudo apt install fonts-dejavu fonts-lato fonts-ubuntu`

Optional, depending on which tools you need (see the table above):

- An NVIDIA GPU with a CUDA-compatible driver, for SAM 3 and Faithful upscaling
- Access to the gated `facebook/sam3` checkpoint on Hugging Face
- A Gemini API key for the cloud-powered tools

### 2. Install

```bash
pnpm --dir frontend install
pnpm setup:backend
```

`setup:backend` creates `backend/.venv` and installs Torch and the other
machine-learning dependencies, so expect a multi-gigabyte download the first time.

### 3. Configure

```bash
cp backend/.env.example backend/.env
```

Set `GEMINI_API_KEY` in `backend/.env` if you want the AI tools. Then authenticate
with Hugging Face if the SAM checkpoint is not already cached:

```bash
backend/.venv/bin/hf auth login
```

### 4. Run

Start the backend first, since the frontend loads its tool catalog from it. Use two terminals:

```bash
pnpm dev:backend    # FastAPI on http://127.0.0.1:8008
pnpm dev:frontend   # Next.js on http://localhost:3009
```

Open [http://localhost:3009](http://localhost:3009). The interactive API
documentation is at [http://127.0.0.1:8008/docs](http://127.0.0.1:8008/docs).

### 5. Confirm it is working

```bash
curl -s http://127.0.0.1:8008/health
curl -s http://127.0.0.1:8008/tools/catalog | head -c 200
```

`/health` reports CUDA and model readiness. `/tools/catalog` should return JSON
describing every sidebar control; if it does not, the editor will not load.

### Stopping

Press `Ctrl+C` in each terminal. If a server is left holding a port:

```bash
ss -tlnp | grep -E '3009|8008'   # find the process
kill <pid>
```

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
| `NEXT_PUBLIC_API_URL` | Public FastAPI base URL | `http://127.0.0.1:8008` when unset; an empty string means same-origin |

`NEXT_PUBLIC_API_URL` is embedded into the browser bundle at build time. Leave it unset for local development, or set it to an empty string when FastAPI serves the frontend from the same origin (the Docker image does this).

## API surface

Editor tools, served by `app/tools/` on the CPU:

| Endpoint | Function |
|---|---|
| `GET /tools/catalog` | Every sidebar control, so the UI hard-codes no presets |
| `POST /tools/preview` | Graded background plus one sprite per layer, for the canvas |
| `POST /tools/compose` | Full-resolution flatten, for Save and the AI tools |
| `POST /tools/thumbnails` | Preview tiles for the Filters and Focus grids |
| `GET /tools/text-design-previews` | Sample tiles for the Text Design grid |
| `GET /tools/upscale-plan` | Output dimensions for each Upscaler mode and scale |

Model-backed tools:

| Endpoint | Function |
|---|---|
| `GET /health` | CUDA and model readiness |
| `POST /segment` | SAM 3 point-based segmentation |
| `POST /upscale` | Local Real-ESRGAN upscaling. Takes `scale`; sizing is computed server-side |
| `POST /ai/upscale` | Gemini AI restoration. Takes `scale` |
| `POST /art-style` | Gemini style transfer |
| `POST /magic-edit` | Mask-guided Gemini editing. Takes the raw SAM overlay, hardened server-side |
| `POST /border-expand` | Gemini outpainting, fitted to exact print dimensions |

## Verification

```bash
pnpm typecheck
pnpm build
python3 -m compileall -q backend/app
```

## Deployment notes

A single root Dockerfile builds one container that serves both the frontend and the API, and `compose.yaml` wraps it for everyday use. To run the image directly instead:

```bash
docker build -t photo-finale .
docker run --gpus all -p 8008:8008 -e GEMINI_API_KEY=... -e HF_TOKEN=... photo-finale
```

The frontend build pins pnpm through the `packageManager` field in
`frontend/package.json`. Keep it in step with the version that generated
`pnpm-lock.yaml`: pnpm 11 stopped reading `pnpm.overrides` from `package.json`, so
a newer client sees no overrides, disagrees with the lockfile, and fails the
frozen install.

Configure `GEMINI_API_KEY` and `HF_TOKEN` as secrets. The first SAM request downloads the gated checkpoint, which is why Compose keeps a named `hf-cache` volume; production hosting should do the same or bake an authorized checkpoint into a private image.

This architecture intentionally serializes local GPU inference and keeps no user records, which is appropriate for the current single-user demonstration. Add authentication, rate limiting, object storage, and a job queue before turning it into a public multi-user service.
