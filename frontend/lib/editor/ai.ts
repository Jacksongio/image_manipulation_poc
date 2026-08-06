/**
 * Transport for the four AI endpoints.
 *
 * Mask hardening, subject cut-outs, output sizing, and print fitting all happen
 * in the backend, so this file only posts blobs and reads results back.
 */

import { apiFetch, backendUrl } from '@/lib/api'

export type Point = { x: number; y: number; label: 0 | 1 }
export type Candidate = { mask: string; score: number }
export type Operation = 'remove' | 'replace' | 'retouch'
export type PrintSize = string
export type Orientation = 'portrait' | 'landscape'
export type UpscaleMode = 'faithful' | 'ai'

export type BackendHealth = { cuda: boolean; upscalerInstalled: boolean; gpu: string | null }

export async function fetchHealth(): Promise<BackendHealth | null> {
  try {
    const response = await fetch(backendUrl('/health'), { cache: 'no-store' })
    if (!response.ok) return null
    const value: unknown = await response.json()
    if (typeof value !== 'object' || value === null) return null
    const record = value as Record<string, unknown>
    return {
      cuda: record.cuda === true,
      upscalerInstalled: record.upscalerInstalled === true,
      gpu: typeof record.gpu === 'string' ? record.gpu : null,
    }
  } catch {
    return null
  }
}

function parseSegmentResult(value: unknown): Candidate[] {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('candidates' in value) ||
    !Array.isArray(value.candidates)
  ) {
    throw new Error('SAM 3 returned an unexpected response')
  }
  const candidates = value.candidates.filter(
    (candidate): candidate is Candidate =>
      typeof candidate === 'object' &&
      candidate !== null &&
      'mask' in candidate &&
      typeof candidate.mask === 'string' &&
      'score' in candidate &&
      typeof candidate.score === 'number',
  )
  if (!candidates.length) throw new Error('SAM 3 could not find an object at that point')
  return candidates
}

export async function segment(image: Blob, name: string, points: Point[], signal?: AbortSignal) {
  const body = new FormData()
  body.set('image', image, name)
  body.set('points', JSON.stringify(points))
  const response = await apiFetch('/segment', { method: 'POST', body, signal })
  return parseSegmentResult(await response.json())
}

/** Turns a mask data URL from /segment back into a blob the endpoint can accept. */
async function maskBlob(maskUrl: string) {
  const response = await fetch(maskUrl)
  return response.blob()
}

export async function magicEdit(options: {
  image: Blob
  name: string
  maskUrl: string
  operation: Operation
  instruction: string
}) {
  const body = new FormData()
  body.set('image', options.image, options.name)
  body.set('mask', await maskBlob(options.maskUrl), 'selection-mask.png')
  body.set('operation', options.operation)
  body.set('instruction', options.instruction)
  const response = await apiFetch('/magic-edit', { method: 'POST', body })
  return response.blob()
}

export async function artStyle(image: Blob, name: string, style: string, intensity: string) {
  const body = new FormData()
  body.set('image', image, name)
  body.set('style', style)
  body.set('intensity', intensity)
  const response = await apiFetch('/art-style', { method: 'POST', body })
  return response.blob()
}

export async function upscale(options: {
  image: Blob
  name: string
  mode: UpscaleMode
  scale: number
  strength: number
}) {
  const body = new FormData()
  body.set('image', options.image, options.name)
  body.set('scale', String(options.scale))
  if (options.mode === 'faithful') body.set('strength', String(options.strength))
  const response = await apiFetch(options.mode === 'faithful' ? '/upscale' : '/ai/upscale', {
    method: 'POST',
    body,
  })
  return {
    blob: await response.blob(),
    engine:
      response.headers.get('x-upscale-model') ??
      (options.mode === 'faithful' ? 'Real-ESRGAN' : 'Gemini'),
    processingTimeMs: Number(response.headers.get('x-processing-time-ms')) || undefined,
  }
}

export async function borderExpand(
  image: Blob,
  name: string,
  printSize: PrintSize,
  orientation: Orientation,
) {
  const body = new FormData()
  body.set('image', image, name)
  body.set('print_size', printSize)
  body.set('orientation', orientation)
  const response = await apiFetch('/border-expand', { method: 'POST', body })
  return response.blob()
}
