# Photo Finale Magic Edit

Magic Edit uses local Meta SAM 3 inference for point-based object selection, Convex for image storage and server actions, and OpenAI GPT Image 2 for masked edits.

## One-time setup

```bash
pnpm install
pnpm setup:sam3
```

SAM 3 downloads its gated checkpoint from `facebook/sam3` on Hugging Face the first time it segments an image. Request access to the checkpoint and authenticate if needed:

```bash
.venv-sam3/bin/hf auth login
```

Set the OpenAI key on the personal Convex development deployment:

```bash
pnpm exec convex env set OPENAI_API_KEY
```

## Development

Run these in three terminals:

```bash
pnpm dev:sam3
pnpm dev:convex
pnpm dev
```

Then open [http://localhost:3009/magic-edit](http://localhost:3009/magic-edit).

The SAM 3 service listens only on `127.0.0.1:8008`. Set `SAM3_SERVICE_URL` for the Next.js server if you move inference to another machine.

## Verification

```bash
pnpm exec tsc --noEmit
pnpm exec next build --webpack
pnpm exec convex dev --once
```
