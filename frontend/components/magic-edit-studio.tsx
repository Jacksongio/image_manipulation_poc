'use client'

import {
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
import { useCallback, useEffect, useRef, useState } from 'react'
import { SiteHeader } from '@/components/site-header'
import { apiFetch } from '@/lib/api'

type Point = { x: number; y: number; label: 0 | 1 }
type Candidate = { mask: string; score: number }
type Operation = 'remove' | 'replace' | 'retouch'
type ImageState = { blob: Blob; url: string; width: number; height: number; name: string }
type ImageSnapshot = Omit<ImageState, 'url'>

const OPERATIONS: Array<{ id: Operation; label: string; icon: typeof Eraser; hint: string }> = [
  { id: 'remove', label: 'Remove', icon: Eraser, hint: 'Erase it and rebuild the background' },
  { id: 'replace', label: 'Replace', icon: Sparkles, hint: 'Swap it for something new' },
  { id: 'retouch', label: 'Retouch', icon: WandSparkles, hint: 'Change pose, color, texture, or details' },
]

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong'
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

async function imageStateFromBlob(blob: Blob, name: string): Promise<ImageState> {
  const bitmap = await createImageBitmap(blob)
  const width = bitmap.width
  const height = bitmap.height
  bitmap.close()
  return { blob, url: URL.createObjectURL(blob), width, height, name }
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
    pixels.data[index] = selected ? 255 : 0
    pixels.data[index + 1] = selected ? 255 : 0
    pixels.data[index + 2] = selected ? 255 : 0
    pixels.data[index + 3] = 255
  }
  context.putImageData(pixels, 0, 0)
  return canvasBlob(canvas)
}

async function createSubjectReference(maskUrl: string, source: ImageState) {
  const maskImage = new Image()
  maskImage.src = maskUrl
  const [sourceImage] = await Promise.all([createImageBitmap(source.blob), maskImage.decode()])

  try {
    const maskCanvas = document.createElement('canvas')
    maskCanvas.width = source.width
    maskCanvas.height = source.height
    const maskContext = maskCanvas.getContext('2d', { willReadFrequently: true })
    if (!maskContext) throw new Error('Canvas is unavailable in this browser')
    maskContext.drawImage(maskImage, 0, 0, source.width, source.height)
    const maskPixels = maskContext.getImageData(0, 0, source.width, source.height)

    let left = source.width
    let top = source.height
    let right = -1
    let bottom = -1
    for (let y = 0; y < source.height; y += 1) {
      for (let x = 0; x < source.width; x += 1) {
        if (maskPixels.data[(y * source.width + x) * 4 + 3] <= 20) continue
        left = Math.min(left, x)
        top = Math.min(top, y)
        right = Math.max(right, x)
        bottom = Math.max(bottom, y)
      }
    }
    if (right < left || bottom < top) throw new Error('The selected subject could not be prepared')

    const subjectWidth = right - left + 1
    const subjectHeight = bottom - top + 1
    const padding = Math.max(12, Math.round(Math.max(subjectWidth, subjectHeight) * 0.12))
    const cropLeft = Math.max(0, left - padding)
    const cropTop = Math.max(0, top - padding)
    const cropRight = Math.min(source.width, right + padding + 1)
    const cropBottom = Math.min(source.height, bottom + padding + 1)
    const cropWidth = cropRight - cropLeft
    const cropHeight = cropBottom - cropTop
    const scale = Math.min(1, 1024 / Math.max(cropWidth, cropHeight))
    const outputWidth = Math.max(1, Math.round(cropWidth * scale))
    const outputHeight = Math.max(1, Math.round(cropHeight * scale))

    const referenceCanvas = document.createElement('canvas')
    referenceCanvas.width = outputWidth
    referenceCanvas.height = outputHeight
    const referenceContext = referenceCanvas.getContext('2d')
    if (!referenceContext) throw new Error('Canvas is unavailable in this browser')
    referenceContext.drawImage(
      sourceImage,
      cropLeft,
      cropTop,
      cropWidth,
      cropHeight,
      0,
      0,
      outputWidth,
      outputHeight,
    )

    const alphaCanvas = document.createElement('canvas')
    alphaCanvas.width = outputWidth
    alphaCanvas.height = outputHeight
    const alphaContext = alphaCanvas.getContext('2d', { willReadFrequently: true })
    if (!alphaContext) throw new Error('Canvas is unavailable in this browser')
    alphaContext.drawImage(
      maskImage,
      cropLeft,
      cropTop,
      cropWidth,
      cropHeight,
      0,
      0,
      outputWidth,
      outputHeight,
    )
    const alphaPixels = alphaContext.getImageData(0, 0, outputWidth, outputHeight)
    for (let index = 0; index < alphaPixels.data.length; index += 4) {
      const selected = alphaPixels.data[index + 3] > 20
      alphaPixels.data[index] = 255
      alphaPixels.data[index + 1] = 255
      alphaPixels.data[index + 2] = 255
      alphaPixels.data[index + 3] = selected ? 255 : 0
    }
    alphaContext.putImageData(alphaPixels, 0, 0)

    referenceContext.globalCompositeOperation = 'destination-in'
    referenceContext.drawImage(alphaCanvas, 0, 0)
    referenceContext.globalCompositeOperation = 'source-over'
    return canvasBlob(referenceCanvas)
  } finally {
    sourceImage.close()
  }
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
        <h1 className="mx-auto max-w-3xl text-balance text-4xl font-extrabold leading-[1.08] text-white sm:text-6xl">
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
  const [image, setImage] = useState<ImageState | null>(null)
  const [points, setPoints] = useState<Point[]>([])
  const [pointMode, setPointMode] = useState<0 | 1>(1)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [candidateIndex, setCandidateIndex] = useState(0)
  const [operation, setOperation] = useState<Operation>('remove')
  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState<'upload' | 'segment' | 'edit' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resultImage, setResultImage] = useState<ImageState | null>(null)
  const [history, setHistory] = useState<ImageSnapshot[]>([])
  const [compare, setCompare] = useState(50)
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
  const [hoverBusy, setHoverBusy] = useState(false)
  const [selectionVersion, setSelectionVersion] = useState(0)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoverAbortRef = useRef<AbortController | null>(null)
  const hoverSequenceRef = useRef(0)
  const lastHoverKeyRef = useRef('')
  const hoverCacheRef = useRef(new Map<string, Candidate[]>())
  const resultUrl = resultImage?.url ?? null

  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url) }, [image])
  useEffect(() => () => { if (resultImage) URL.revokeObjectURL(resultImage.url) }, [resultImage])
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
      setResultImage(null)
      setHistory([])
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
      const response = await apiFetch('/segment', { method: 'POST', body, signal: controller.signal })
      const value: unknown = await response.json()
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
      const maskUrl = `data:image/png;base64,${candidate.mask}`
      const [maskBlob, referenceBlob] = await Promise.all([
        createEditMask(maskUrl, image.width, image.height),
        operation === 'retouch' ? createSubjectReference(maskUrl, image) : Promise.resolve(null),
      ])
      const body = new FormData()
      body.set('image', image.blob, image.name)
      body.set('mask', maskBlob, 'selection-mask.png')
      if (referenceBlob) body.set('reference', referenceBlob, 'subject-reference.png')
      body.set('operation', operation)
      body.set('instruction', instruction)
      const response = await apiFetch('/magic-edit', { method: 'POST', body })
      setResultImage(await imageStateFromBlob(await response.blob(), `edited-${image.name}`))
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
    setResultImage(null)
    setHistory([])
    setError(null)
    setHover(null)
    setHoverBusy(false)
    hoverCacheRef.current.clear()
    lastHoverKeyRef.current = ''
  }

  const clearSelection = () => {
    setPoints([])
    setCandidates([])
    setInstruction('')
    setHover(null)
    setHoverBusy(false)
    hoverCacheRef.current.clear()
    lastHoverKeyRef.current = ''
  }

  const keepEditingResult = () => {
    if (!image || !resultImage) return
    setHistory((current) => [...current, {
      blob: image.blob,
      width: image.width,
      height: image.height,
      name: image.name,
    }])
    setImage({ ...resultImage, url: URL.createObjectURL(resultImage.blob) })
    setResultImage(null)
    clearSelection()
  }

  const undoChanges = () => {
    if (resultImage) {
      setResultImage(null)
      setCompare(50)
      return
    }
    const previous = history.at(-1)
    if (!previous) return
    setHistory((current) => current.slice(0, -1))
    setImage({ ...previous, url: URL.createObjectURL(previous.blob) })
    clearSelection()
  }

  const selectedCandidate = candidates[candidateIndex]

  return (
    <div className="min-h-screen bg-[#f4f5f8] text-brand-navy">
      <SiteHeader />

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
                {!resultUrl && history.length > 0 && (
                  <button type="button" disabled={!!busy} onClick={undoChanges} className="inline-flex items-center gap-2 rounded-full border border-brand-navy/10 bg-white px-4 py-2.5 text-xs font-bold shadow-sm transition-colors hover:border-accent-pink hover:text-accent-pink disabled:opacity-40">
                    <RotateCcw className="size-3.5" /> Undo changes
                  </button>
                )}
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

            <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-[2rem] bg-[#e5e7ed] shadow-inner ring-1 ring-black/5">
              <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(45deg,#d7dae2_25%,transparent_25%),linear-gradient(-45deg,#d7dae2_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#d7dae2_75%),linear-gradient(-45deg,transparent_75%,#d7dae2_75%)] [background-position:0_0,0_12px,12px_-12px,-12px_0] [background-size:24px_24px]" />
              <div className="magic-image-land relative z-10 max-h-[76vh] max-w-full overflow-hidden rounded-2xl bg-brand-navy shadow-2xl shadow-brand-navy/25 ring-1 ring-white/10" style={{ aspectRatio: `${image.width}/${image.height}` }}>
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
                  className="relative block h-full max-h-[76vh] w-full max-w-full cursor-crosshair disabled:cursor-default"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt="Image being edited" draggable={false} className={`block max-h-[76vh] max-w-full select-none object-contain transition-all duration-700 ${busy === 'edit' ? 'scale-[1.035] blur-[7px] saturate-75 brightness-75' : ''}`} />
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

                {busy === 'edit' && (
                  <div className="magic-generating-overlay absolute inset-0 z-30 flex items-center justify-center overflow-hidden bg-brand-navy/35 backdrop-blur-[2px]">
                    <div aria-hidden className="magic-generate-scan absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent blur-xl" />
                    <div className="relative flex max-w-xs flex-col items-center px-6 text-center text-white">
                      <span className="relative grid size-16 place-items-center rounded-2xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-md">
                        <WandSparkles className="size-7 text-brand-green" />
                        <span className="absolute -inset-2 -z-10 animate-ping rounded-3xl border border-brand-green/30" />
                      </span>
                      <div className="mt-6 h-7 overflow-hidden">
                        <div className="magic-generate-words">
                          <p className="h-7 text-lg font-extrabold">Generating your edit…</p>
                          <p className="h-7 text-lg font-extrabold">Rebuilding the pixels…</p>
                          <p className="h-7 text-lg font-extrabold">Blending it naturally…</p>
                          <p className="h-7 text-lg font-extrabold">Adding the final polish…</p>
                        </div>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-white/60">Nano Banana is transforming only your selected area</p>
                      <span className="mt-6 h-1 w-52 overflow-hidden rounded-full bg-white/15">
                        <span className="magic-generate-progress block h-full w-2/5 rounded-full bg-brand-green shadow-[0_0_12px_rgba(140,198,63,0.8)]" />
                      </span>
                    </div>
                  </div>
                )}

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
                <button type="button" onClick={keepEditingResult} className="mt-3 rounded-full border border-brand-navy/10 px-5 py-3.5 text-sm font-bold transition-colors hover:border-brand-green hover:text-brand-green-dark">Keep editing selection</button>
                <button type="button" onClick={undoChanges} className="mt-3 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"><RotateCcw className="size-4" /> Undo changes</button>
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
                  {operation === 'retouch' && selectedCandidate && (
                    <p className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-brand-green-dark">
                      <Check className="size-3" /> Selected subject attached as an identity reference
                    </p>
                  )}
                  <div className="mt-2 text-right text-[10px] text-brand-gray">{instruction.length} / 1500</div>
                  <button type="button" disabled={!selectedCandidate || !!busy} onClick={() => void submitEdit()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent-pink px-5 py-4 text-sm font-bold text-white shadow-lg shadow-accent-pink/25 transition-all hover:-translate-y-0.5 hover:bg-[#dc3d7d] disabled:translate-y-0 disabled:opacity-40">
                    {busy === 'edit' ? <><LoaderCircle className="size-4 animate-spin" /> Nano Banana is editing…</> : <><WandSparkles className="size-4" /> Apply Magic Edit</>}
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
