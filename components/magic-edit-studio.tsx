'use client'

import { useAction, useMutation } from 'convex/react'
import {
  ArrowLeft,
  Check,
  Download,
  Eraser,
  ImagePlus,
  LoaderCircle,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  WandSparkles,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

type Point = { x: number; y: number; label: 0 | 1 }
type Candidate = { mask: string; score: number }
type Operation = 'remove' | 'replace' | 'retouch'
type ImageState = { blob: Blob; url: string; width: number; height: number; name: string }

const OPERATIONS: Array<{ id: Operation; label: string; icon: typeof Eraser; hint: string }> = [
  { id: 'remove', label: 'Remove', icon: Eraser, hint: 'Erase it and rebuild the background' },
  { id: 'replace', label: 'Replace', icon: Sparkles, hint: 'Swap it for something new' },
  { id: 'retouch', label: 'Retouch', icon: WandSparkles, hint: 'Change color, texture, or details' },
]

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message.replace(/^\[CONVEX[^\]]*\]\s*/, '') : 'Something went wrong'
}

function canvasBlob(canvas: HTMLCanvasElement, type = 'image/png') {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not prepare the image'))), type)
  })
}

async function normalizeImage(file: File): Promise<ImageState> {
  if (!file.type.startsWith('image/')) throw new Error('Choose a PNG, JPEG, or WebP image')
  if (file.size > 20 * 1024 * 1024) throw new Error('Images must be 20 MB or smaller')

  const bitmap = await createImageBitmap(file)
  const maxEdge = 2048
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is unavailable in this browser')
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await canvasBlob(canvas)
  return { blob, url: URL.createObjectURL(blob), width, height, name: file.name }
}

async function createEditMask(maskUrl: string, width: number, height: number) {
  const image = new Image()
  image.src = maskUrl
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas is unavailable in this browser')
  context.drawImage(image, 0, 0, width, height)
  const pixels = context.getImageData(0, 0, width, height)
  for (let index = 0; index < pixels.data.length; index += 4) {
    const selected = pixels.data[index + 3] > 20
    pixels.data[index] = 255
    pixels.data[index + 1] = 255
    pixels.data[index + 2] = 255
    pixels.data[index + 3] = selected ? 0 : 255
  }
  context.putImageData(pixels, 0, 0)
  return canvasBlob(canvas)
}

function parseSegmentResult(value: unknown): { candidates: Candidate[] } {
  if (typeof value !== 'object' || value === null || !('candidates' in value) || !Array.isArray(value.candidates)) {
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
  return { candidates }
}

function UploadPanel({ onFile }: { onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  return (
    <main className="relative min-h-[calc(100vh-103px)] overflow-hidden bg-brand-navy px-5 pb-20 pt-16 sm:pt-20">
      <div aria-hidden className="pointer-events-none absolute -right-32 top-0 size-[34rem] rounded-full border-[90px] border-white/[0.025]" />
      <div aria-hidden className="pointer-events-none absolute -left-52 bottom-0 size-[30rem] rounded-full border-[70px] border-brand-green/[0.045]" />
      <div className="relative mx-auto w-full max-w-5xl text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-green">
          <WandSparkles className="size-4" /> AI-powered precision editing
        </div>
        <h1 className="mx-auto mt-6 max-w-3xl text-balance text-4xl font-extrabold leading-[1.08] text-white sm:text-6xl">
          Change anything.<br /><span className="text-brand-green">Keep everything you love.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-white/70 sm:text-lg">
          Upload a photo, point to any object, and describe your edit. Precision selection runs privately on your RTX 5090.
        </p>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            const file = event.dataTransfer.files[0]
            if (file) onFile(file)
          }}
          className={`group mx-auto mt-11 flex w-full max-w-4xl flex-col items-center rounded-[2rem] border-2 border-dashed px-8 py-14 shadow-2xl shadow-black/25 transition-all sm:py-16 ${
            dragging ? 'scale-[1.015] border-brand-green bg-white' : 'border-white/60 bg-white hover:-translate-y-1 hover:border-brand-green'
          }`}
        >
          <span className="relative flex size-16 items-center justify-center rounded-full bg-accent-pink text-white shadow-lg shadow-accent-pink/25 transition-transform group-hover:scale-105">
            <ImagePlus className="size-7" />
            <span className="absolute -right-1 -top-1 size-4 rounded-full border-2 border-white bg-brand-green" />
          </span>
          <span className="mt-5 text-xl font-extrabold text-brand-navy">Drop your image here</span>
          <span className="mt-2 text-sm text-muted-foreground">or click anywhere to browse your files</span>
          <span className="mt-5 rounded-full bg-brand-navy px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition-colors group-hover:bg-accent-pink">Choose an image</span>
          <span className="mt-4 text-[11px] font-medium text-brand-gray">PNG, JPEG or WebP · Maximum 20 MB</span>
        </button>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFile(file)
        }} />
        <div className="mx-auto mt-9 grid max-w-3xl grid-cols-3 gap-2 text-left sm:gap-6">
          {[
            ['01', 'Upload', 'Add your photo'],
            ['02', 'Select', 'Point at an object'],
            ['03', 'Transform', 'Describe the change'],
          ].map(([number, title, detail], index) => (
            <div key={title} className="relative flex items-center gap-3 rounded-xl px-2 py-3 sm:px-4">
              <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-extrabold ${index === 0 ? 'bg-brand-green text-brand-navy' : 'border border-white/20 text-white/60'}`}>{number}</span>
              <span><span className="block text-xs font-bold text-white sm:text-sm">{title}</span><span className="hidden text-[11px] text-white/45 sm:block">{detail}</span></span>
              {index < 2 && <span className="absolute -right-3 hidden h-px w-6 bg-white/15 sm:block" />}
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

export function MagicEditStudio() {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const runEdit = useAction(api.magicEdit.edit)
  const [image, setImage] = useState<ImageState | null>(null)
  const [points, setPoints] = useState<Point[]>([])
  const [pointMode, setPointMode] = useState<0 | 1>(1)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [candidateIndex, setCandidateIndex] = useState(0)
  const [operation, setOperation] = useState<Operation>('remove')
  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState<'upload' | 'segment' | 'edit' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [compare, setCompare] = useState(50)
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
  const [hoverBusy, setHoverBusy] = useState(false)
  const [selectionVersion, setSelectionVersion] = useState(0)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoverAbortRef = useRef<AbortController | null>(null)
  const hoverSequenceRef = useRef(0)
  const lastHoverKeyRef = useRef('')
  const hoverCacheRef = useRef(new Map<string, Candidate[]>())

  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url) }, [image])
  useEffect(() => () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    hoverAbortRef.current?.abort()
  }, [])

  const chooseFile = useCallback(async (file: File) => {
    setBusy('upload')
    setError(null)
    try {
      const next = await normalizeImage(file)
      setImage((current) => {
        if (current) URL.revokeObjectURL(current.url)
        return next
      })
      setPoints([])
      setCandidates([])
      setResultUrl(null)
      hoverCacheRef.current.clear()
      lastHoverKeyRef.current = ''
    } catch (caught) {
      setError(messageFromError(caught))
    } finally {
      setBusy(null)
    }
  }, [])

  const requestSegment = useCallback(async (
    nextPoints: Point[],
    options: { preview?: boolean; cacheKey?: string } = {},
  ) => {
    if (!image) return
    const { preview = false, cacheKey } = options
    const sequence = ++hoverSequenceRef.current
    const controller = new AbortController()
    if (preview) {
      hoverAbortRef.current?.abort()
      hoverAbortRef.current = controller
      setHoverBusy(true)
    } else {
      hoverAbortRef.current?.abort()
      setBusy('segment')
      setError(null)
    }
    try {
      const body = new FormData()
      body.set('image', image.blob, 'source.png')
      body.set('points', JSON.stringify(nextPoints))
      const response = await fetch('/api/segment', { method: 'POST', body, signal: controller.signal })
      const value: unknown = await response.json()
      if (!response.ok) {
        const detail = typeof value === 'object' && value !== null && 'detail' in value && typeof value.detail === 'string'
          ? value.detail
          : 'SAM 3 could not create a selection'
        throw new Error(detail)
      }
      const parsed = parseSegmentResult(value)
      if (preview && sequence !== hoverSequenceRef.current) return
      if (preview && cacheKey) hoverCacheRef.current.set(cacheKey, parsed.candidates)
      setCandidates(parsed.candidates)
      setCandidateIndex(0)
      setSelectionVersion((current) => current + 1)
      if (!preview) setPoints(nextPoints)
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return
      if (!preview) setError(messageFromError(caught))
    } finally {
      if (preview) {
        if (sequence === hoverSequenceRef.current) setHoverBusy(false)
      } else {
        setBusy(null)
      }
    }
  }, [image])

  const handleImageHover = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!image || busy || resultUrl) return
    const rect = event.currentTarget.getBoundingClientRect()
    const normalizedX = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    const normalizedY = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
    setHover({ x: normalizedX * 100, y: normalizedY * 100 })
    if (points.length > 0 || pointMode === 0) return

    // A 24 × 24 spatial grid keeps hover responsive without flooding the local model.
    const cellX = Math.floor(normalizedX * 24)
    const cellY = Math.floor(normalizedY * 24)
    const cacheKey = `${cellX}:${cellY}`
    if (cacheKey === lastHoverKeyRef.current) return
    lastHoverKeyRef.current = cacheKey
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    hoverAbortRef.current?.abort()
    hoverSequenceRef.current += 1
    setHoverBusy(false)

    const cached = hoverCacheRef.current.get(cacheKey)
    if (cached) {
      setCandidates(cached)
      setCandidateIndex(0)
      setSelectionVersion((current) => current + 1)
      return
    }

    const previewPoint: Point = {
      x: Math.min(image.width - 1, Math.max(0, normalizedX * image.width)),
      y: Math.min(image.height - 1, Math.max(0, normalizedY * image.height)),
      label: 1,
    }
    hoverTimerRef.current = setTimeout(() => {
      void requestSegment([previewPoint], { preview: true, cacheKey })
    }, 180)
  }

  const handleImageClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!image || busy || resultUrl) return
    const rect = event.currentTarget.getBoundingClientRect()
    const nextPoint: Point = {
      x: Math.min(image.width - 1, Math.max(0, ((event.clientX - rect.left) / rect.width) * image.width)),
      y: Math.min(image.height - 1, Math.max(0, ((event.clientY - rect.top) / rect.height) * image.height)),
      label: pointMode,
    }
    if (points.length === 0 && candidates.length > 0 && pointMode === 1) {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
      hoverAbortRef.current?.abort()
      setHoverBusy(false)
      setPoints([nextPoint])
      return
    }
    void requestSegment([...points, nextPoint])
  }

  const uploadBlob = async (blob: Blob) => {
    const uploadUrl = await generateUploadUrl({})
    const response = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: blob })
    if (!response.ok) throw new Error('Could not upload the image to Convex')
    const value: unknown = await response.json()
    if (typeof value !== 'object' || value === null || !('storageId' in value) || typeof value.storageId !== 'string') {
      throw new Error('Convex returned an invalid upload response')
    }
    return value.storageId as Id<'_storage'>
  }

  const submitEdit = async () => {
    const candidate = candidates[candidateIndex]
    if (!image || !candidate) return
    if (operation !== 'remove' && !instruction.trim()) {
      setError('Describe what should replace or change inside the selection')
      return
    }
    setBusy('edit')
    setError(null)
    try {
      const maskBlob = await createEditMask(`data:image/png;base64,${candidate.mask}`, image.width, image.height)
      const [imageId, maskId] = await Promise.all([uploadBlob(image.blob), uploadBlob(maskBlob)])
      const result = await runEdit({ imageId, maskId, operation, instruction })
      setResultUrl(result.url)
      setCompare(50)
    } catch (caught) {
      setError(messageFromError(caught))
    } finally {
      setBusy(null)
    }
  }

  const reset = () => {
    if (image) URL.revokeObjectURL(image.url)
    setImage(null)
    setPoints([])
    setCandidates([])
    setResultUrl(null)
    setError(null)
    setHover(null)
    setHoverBusy(false)
    hoverCacheRef.current.clear()
    lastHoverKeyRef.current = ''
  }

  const selectedCandidate = candidates[candidateIndex]

  return (
    <div className="min-h-screen bg-[#f4f5f8] text-brand-navy">
      <header className="relative z-40">
        <div className="bg-brand-green">
          <div className="mx-auto flex h-[30px] max-w-7xl items-center justify-end gap-6 px-4 text-[11px] font-semibold text-white sm:px-6 lg:px-8">
            <span>Private local selection</span><span className="size-1 rounded-full bg-white/60" /><span>OpenAI image editing</span>
          </div>
        </div>
        <div className="border-b border-black/5 bg-white">
          <div className="mx-auto flex h-[73px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <Link href="/" aria-label="Back home" className="flex size-9 items-center justify-center rounded-full border border-brand-navy/10 text-brand-navy transition-all hover:-translate-x-0.5 hover:border-brand-green hover:text-brand-green-dark">
                <ArrowLeft className="size-4" />
              </Link>
              <Link href="/" className="text-xl font-extrabold tracking-tight sm:text-[26px]"><span className="text-brand-green">PHOTO</span> <span className="text-brand-gray">FINALE</span></Link>
              <span className="hidden h-6 w-px bg-black/10 sm:block" />
              <span className="hidden rounded-full bg-accent-pink/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-accent-pink sm:inline-flex">Magic Edit</span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-brand-green/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-green-dark sm:text-xs sm:normal-case sm:tracking-normal">
              <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-green opacity-50" /><span className="relative inline-flex size-2 rounded-full bg-brand-green" /></span>
              <span className="hidden sm:inline">SAM 3 ready · </span>RTX 5090
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="fixed left-1/2 top-28 z-50 flex w-[min(92vw,620px)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-red-200 bg-white p-4 text-sm text-red-700 shadow-xl">
          <X className="size-4 shrink-0" /> <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss"><X className="size-4" /></button>
        </div>
      )}

      {!image ? <UploadPanel onFile={chooseFile} /> : (
        <main className="magic-editor-enter mx-auto grid min-h-[calc(100vh-103px)] max-w-[1600px] lg:grid-cols-[minmax(0,1fr)_400px]">
          <section className="flex min-h-[560px] flex-col p-4 sm:p-6 lg:p-8">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-extrabold tracking-tight">{resultUrl ? 'Your edit is ready' : candidates.length ? 'Selection ready' : 'Hover over anything to begin'}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{resultUrl ? 'Drag the slider to compare before and after' : points.length ? 'Click again with include or exclude to refine the edge' : candidates.length ? 'Move around to explore, or click once to pin this selection' : 'Pause over an object and SAM 3 will trace it automatically'}</p>
              </div>
              <div className="flex items-center gap-2">
                {!resultUrl && points.length > 0 && (
                  <button type="button" disabled={!!busy} onClick={() => {
                    const next = points.slice(0, -1)
                    if (next.length) void requestSegment(next)
                    else { setPoints([]); setCandidates([]) }
                  }} className="inline-flex items-center gap-2 rounded-full border border-brand-navy/10 bg-white px-4 py-2.5 text-xs font-bold shadow-sm transition-colors hover:border-brand-green disabled:opacity-40">
                    <RotateCcw className="size-3.5" /> Undo point
                  </button>
                )}
                <button type="button" onClick={reset} className="rounded-full bg-brand-navy px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-accent-pink">New image</button>
              </div>
            </div>

            <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-[2rem] bg-brand-navy p-3 shadow-2xl shadow-brand-navy/15 ring-1 ring-black/5 sm:p-8">
              <div className="absolute inset-0 opacity-[0.045] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:32px_32px]" />
              <span className="absolute left-5 top-5 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/65">Hover to select</span>
              <div className="magic-image-land relative z-10 max-h-[72vh] max-w-full overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10" style={{ aspectRatio: `${image.width}/${image.height}` }}>
                <button
                  type="button"
                  aria-label="Hover over an object to preview its selection; click to pin it"
                  disabled={!!busy || !!resultUrl}
                  onClick={handleImageClick}
                  onMouseMove={handleImageHover}
                  onMouseLeave={() => {
                    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
                    lastHoverKeyRef.current = ''
                    setHover(null)
                  }}
                  className="relative block h-full max-h-[72vh] w-full max-w-full cursor-crosshair disabled:cursor-default"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt="Image being edited" draggable={false} className="block max-h-[72vh] max-w-full select-none object-contain transition-[filter,transform] duration-700" />
                  {selectedCandidate && !resultUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={selectionVersion} src={`data:image/png;base64,${selectedCandidate.mask}`} alt="Selected area" className="magic-mask-enter pointer-events-none absolute inset-0 size-full object-fill" />
                  )}
                  {points.map((point, index) => (
                    <span key={`${point.x}-${point.y}-${index}`} className={`pointer-events-none absolute grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow ${point.label ? 'bg-brand-green' : 'bg-red-500'}`} style={{ left: `${(point.x / image.width) * 100}%`, top: `${(point.y / image.height) * 100}%` }}>
                      {point.label ? '+' : '−'}
                    </span>
                  ))}
                  {hover && !busy && !resultUrl && (
                    <span className={`pointer-events-none absolute grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white shadow-lg transition-colors ${pointMode ? 'bg-brand-green/45' : 'bg-red-500/45'}`} style={{ left: `${hover.x}%`, top: `${hover.y}%` }}>
                      {hoverBusy ? <LoaderCircle className="size-4 animate-spin text-white" /> : <span className="size-1.5 rounded-full bg-white shadow" />}
                    </span>
                  )}
                  {busy === 'segment' && <span className="absolute inset-0 grid place-items-center bg-brand-navy/30 backdrop-blur-[2px]"><span className="inline-flex items-center gap-3 rounded-full bg-white px-5 py-3 text-sm font-bold shadow-xl"><LoaderCircle className="size-5 animate-spin text-accent-pink" /> SAM 3 is tracing…</span></span>}
                </button>

                {resultUrl && (
                  <div className="absolute inset-0 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resultUrl} alt="Edited result" className="absolute inset-0 size-full object-fill" style={{ clipPath: `inset(0 ${100 - compare}% 0 0)` }} />
                    <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-lg" style={{ left: `${compare}%` }} />
                    <input aria-label="Compare original and edited image" type="range" min="0" max="100" value={compare} onChange={(event) => setCompare(Number(event.target.value))} className="absolute inset-0 size-full cursor-ew-resize opacity-0" />
                    <span className="absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Edited</span>
                    <span className="absolute right-3 top-3 rounded-full bg-black/55 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Original</span>
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="border-l border-black/5 bg-white p-6 shadow-[-20px_0_50px_rgba(35,48,107,0.04)] sm:p-8">
            {resultUrl ? (
              <div className="flex h-full flex-col">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-green-dark">Edit complete</p>
                <div className="mt-6 grid size-14 place-items-center rounded-2xl bg-brand-green text-brand-navy shadow-lg shadow-brand-green/20"><Check className="size-7" strokeWidth={3} /></div>
                <h2 className="mt-6 text-3xl font-extrabold tracking-tight">Looking good.</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">Your finished image is ready. Compare it on the canvas, then download the full-resolution result.</p>
                <div className="mt-8 rounded-2xl bg-brand-green/10 p-4 text-xs leading-5 text-brand-green-dark"><span className="font-bold">Print-ready result</span><br />Your original dimensions and quality are preserved.</div>
                <a href={resultUrl} download="magic-edit.png" className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-brand-navy px-5 py-4 text-sm font-bold text-white shadow-lg shadow-brand-navy/20 transition-all hover:-translate-y-0.5 hover:bg-accent-pink"><Download className="size-4" /> Download PNG</a>
                <button type="button" onClick={() => setResultUrl(null)} className="mt-3 rounded-full border border-brand-navy/10 px-5 py-3.5 text-sm font-bold transition-colors hover:border-brand-green hover:text-brand-green-dark">Keep editing selection</button>
              </div>
            ) : (
              <div className="space-y-7">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent-pink">Magic Edit</p>
                  <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Make it yours.</h2>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">Select an object, choose an action, and let AI handle the pixels.</p>
                </div>
                <div className="h-px bg-black/5" />
                <div>
                  <div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-full bg-brand-green text-xs font-extrabold text-brand-navy">1</span><h3 className="font-bold">Select the subject</h3></div>
                  <p className="ml-10 mt-2 text-xs leading-5 text-muted-foreground">Hover to preview any object instantly. Click only when you want to pin it and add refinement points.</p>
                  <div className="ml-10 mt-4 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setPointMode(1)} className={`flex items-center justify-center gap-2 rounded-full border px-3 py-2.5 text-xs font-bold transition-all ${pointMode === 1 ? 'border-brand-green bg-brand-green text-brand-navy shadow-sm' : 'border-brand-navy/10 bg-white hover:border-brand-green'}`}><Plus className="size-4" /> Include</button>
                    <button type="button" onClick={() => setPointMode(0)} className={`flex items-center justify-center gap-2 rounded-full border px-3 py-2.5 text-xs font-bold transition-all ${pointMode === 0 ? 'border-red-400 bg-red-500 text-white shadow-sm' : 'border-brand-navy/10 bg-white hover:border-red-300'}`}><Minus className="size-4" /> Exclude</button>
                  </div>
                  {candidates.length > 1 && (
                    <div className="ml-10 mt-4">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Selection options</p>
                      <div className="grid grid-cols-3 gap-2">
                        {candidates.map((candidate, index) => (
                          <button key={index} type="button" onClick={() => setCandidateIndex(index)} className={`relative aspect-square overflow-hidden rounded-xl border-2 bg-[#eef0f3] transition-all ${index === candidateIndex ? 'border-accent-pink shadow-md shadow-accent-pink/15' : 'border-transparent hover:border-brand-navy/15'}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`data:image/png;base64,${candidate.mask}`} alt={`Mask option ${index + 1}`} className="size-full object-fill" />
                            <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">{Math.round(candidate.score * 100)}%</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className={candidates.length ? '' : 'pointer-events-none opacity-40'}>
                  <div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-full bg-brand-navy text-xs font-bold text-white">2</span><h3 className="font-bold">Choose the magic</h3></div>
                  <div className="ml-10 mt-4 space-y-2">
                    {OPERATIONS.map((item) => (
                      <button key={item.id} type="button" onClick={() => setOperation(item.id)} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all ${operation === item.id ? 'border-accent-pink bg-accent-pink/[0.06] shadow-sm' : 'border-brand-navy/[0.08] hover:border-accent-pink/40 hover:bg-accent-pink/[0.025]'}`}>
                        <span className={`grid size-10 place-items-center rounded-xl transition-colors ${operation === item.id ? 'bg-accent-pink text-white' : 'bg-brand-navy/[0.06] text-brand-navy'}`}><item.icon className="size-4" /></span>
                        <span><span className="block text-xs font-bold">{item.label}</span><span className="mt-0.5 block text-[10px] text-muted-foreground">{item.hint}</span></span>
                        {operation === item.id && <Check className="ml-auto size-4 text-accent-pink" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={candidates.length ? '' : 'pointer-events-none opacity-40'}>
                  <div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-full bg-brand-navy text-xs font-bold text-white">3</span><label htmlFor="instruction" className="text-sm font-bold">{operation === 'remove' ? 'Add guidance' : 'Describe the change'}</label></div>
                  <textarea id="instruction" value={instruction} onChange={(event) => setInstruction(event.target.value)} maxLength={1500} rows={4} placeholder={operation === 'replace' ? 'e.g. Replace it with a vase of wildflowers' : operation === 'retouch' ? 'e.g. Make the jacket deep navy blue' : 'Optional: Keep the wall texture seamless'} className="mt-4 w-full resize-none rounded-2xl border border-brand-navy/10 bg-[#f7f8fa] p-4 text-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-accent-pink/50 focus:bg-white focus:ring-4 focus:ring-accent-pink/10" />
                  <div className="mt-2 text-right text-[10px] text-brand-gray">{instruction.length} / 1500</div>
                  <button type="button" disabled={!selectedCandidate || !!busy} onClick={() => void submitEdit()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent-pink px-5 py-4 text-sm font-bold text-white shadow-lg shadow-accent-pink/25 transition-all hover:-translate-y-0.5 hover:bg-[#dc3d7d] disabled:translate-y-0 disabled:opacity-40">
                    {busy === 'edit' ? <><LoaderCircle className="size-4 animate-spin" /> OpenAI is editing…</> : <><WandSparkles className="size-4" /> Apply Magic Edit</>}
                  </button>
                </div>
              </div>
            )}
          </aside>
        </main>
      )}

      {busy === 'upload' && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-brand-navy/85 backdrop-blur-xl">
          <div className="magic-upload-pop flex flex-col items-center text-center">
            <span className="relative grid size-20 place-items-center rounded-[1.6rem] bg-white text-accent-pink shadow-2xl shadow-black/25">
              <ImagePlus className="size-8" />
              <span className="absolute -inset-3 -z-10 animate-ping rounded-[2rem] border border-brand-green/40" />
            </span>
            <p className="mt-7 text-xl font-extrabold text-white">Preparing your canvas</p>
            <p className="mt-2 text-sm text-white/55">Optimizing the image for fast, precise selection…</p>
            <span className="mt-6 h-1 w-48 overflow-hidden rounded-full bg-white/10"><span className="magic-progress block h-full rounded-full bg-brand-green" /></span>
          </div>
        </div>
      )}
    </div>
  )
}
