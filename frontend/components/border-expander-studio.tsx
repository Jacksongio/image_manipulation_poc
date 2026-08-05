'use client'

import {
  ArrowRight,
  Check,
  Download,
  Expand,
  Frame,
  ImagePlus,
  LoaderCircle,
  RectangleHorizontal,
  RectangleVertical,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SiteHeader } from '@/components/site-header'
import { apiFetch } from '@/lib/api'

type PrintSize = '4x6' | '5x7'
type Orientation = 'portrait' | 'landscape'
type SupportedMimeType = 'image/png' | 'image/jpeg' | 'image/webp'
type ImageState = {
  blob: Blob
  url: string
  width: number
  height: number
  name: string
  mimeType: SupportedMimeType
}
type Rectangle = { x: number; y: number; width: number; height: number }

const PRINT_SIZES = {
  '4x6': {
    label: '4 × 6',
    description: 'Classic photo print',
    portrait: { width: 1_200, height: 1_800 },
    landscape: { width: 1_800, height: 1_200 },
  },
  '5x7': {
    label: '5 × 7',
    description: 'Larger display print',
    portrait: { width: 1_500, height: 2_100 },
    landscape: { width: 2_100, height: 1_500 },
  },
} as const

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong'
}

async function normalizeImage(file: File): Promise<ImageState> {
  if (file.type !== 'image/png' && file.type !== 'image/jpeg' && file.type !== 'image/webp') {
    throw new Error('Choose a PNG, JPEG, or WebP image')
  }
  if (file.size > 20 * 1024 * 1024) throw new Error('Images must be 20 MB or smaller')

  const bitmap = await createImageBitmap(file)
  const ratio = bitmap.width / bitmap.height
  if (ratio > 4 || ratio < 1 / 4) {
    bitmap.close()
    throw new Error('Very wide or tall images are not supported. Use an aspect ratio between 1:4 and 4:1.')
  }
  const width = bitmap.width
  const height = bitmap.height
  bitmap.close()
  return { blob: file, url: URL.createObjectURL(file), width, height, name: file.name, mimeType: file.type }
}

function sourceRectangle(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number): Rectangle {
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight)
  const width = Math.round(sourceWidth * scale)
  const height = Math.round(sourceHeight * scale)
  return {
    x: Math.floor((targetWidth - width) / 2),
    y: Math.floor((targetHeight - height) / 2),
    width,
    height,
  }
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The expansion canvas could not be prepared'))),
      'image/png',
    )
  })
}

async function prepareOutput(generatedUrl: string, target: { width: number; height: number }) {
  const response = await fetch(generatedUrl)
  if (!response.ok) throw new Error('The expanded image could not be loaded')
  const generated = await createImageBitmap(await response.blob())
  const canvas = document.createElement('canvas')
  canvas.width = target.width
  canvas.height = target.height
  const context = canvas.getContext('2d')
  if (!context) {
    generated.close()
    throw new Error('Canvas is unavailable in this browser')
  }
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  const sourceRatio = generated.width / generated.height
  const targetRatio = target.width / target.height
  if (sourceRatio > targetRatio) {
    const sourceWidth = generated.height * targetRatio
    context.drawImage(
      generated,
      (generated.width - sourceWidth) / 2,
      0,
      sourceWidth,
      generated.height,
      0,
      0,
      target.width,
      target.height,
    )
  } else {
    const sourceHeight = generated.width / targetRatio
    context.drawImage(
      generated,
      0,
      (generated.height - sourceHeight) / 2,
      generated.width,
      sourceHeight,
      0,
      0,
      target.width,
      target.height,
    )
  }
  generated.close()
  return URL.createObjectURL(await canvasBlob(canvas))
}

function UploadView({ onFile, busy }: { onFile: (file: File) => void; busy: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  return (
    <main className="relative min-h-[calc(100vh-103px)] overflow-hidden bg-brand-navy px-5 pb-20 pt-14 sm:pt-20">
      <div aria-hidden className="pointer-events-none absolute -right-44 -top-28 size-[38rem] rounded-full border-[96px] border-accent-teal/[0.055]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-52 -left-32 size-[34rem] rounded-full border-[80px] border-brand-green/[0.05]" />
      <div className="relative mx-auto max-w-5xl text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent-teal text-white shadow-xl shadow-accent-teal/20"><Frame className="size-7" /></div>
        <h1 className="mx-auto mt-6 max-w-4xl text-balance text-4xl font-extrabold leading-[1.06] text-white sm:text-6xl">
          Keep the whole photo.<br /><span className="text-accent-teal">Fit the perfect print.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-white/65 sm:text-lg">
          Extend your image beyond its original edges with a natural AI-generated background—without awkward cropping.
        </p>

        <button
          type="button"
          disabled={busy}
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
          className={`group mx-auto mt-10 flex w-full max-w-4xl flex-col items-center rounded-[2rem] border-2 border-dashed bg-white px-8 py-12 shadow-2xl shadow-black/25 transition-all sm:py-14 ${dragging ? 'scale-[1.015] border-accent-teal' : 'border-white/70 hover:-translate-y-1 hover:border-accent-teal'}`}
        >
          <span className="relative grid size-16 place-items-center rounded-full bg-accent-teal/10 text-accent-teal transition-transform group-hover:scale-105"><ImagePlus className="size-7" /><span className="absolute -right-0.5 -top-0.5 size-4 rounded-full border-2 border-white bg-brand-green" /></span>
          <span className="mt-5 text-xl font-extrabold text-brand-navy">Drop your photo here</span>
          <span className="mt-2 text-sm text-muted-foreground">or click to choose one from your device</span>
          <span className="mt-5 rounded-full bg-brand-navy px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition-colors group-hover:bg-accent-teal">Choose an image</span>
          <span className="mt-4 text-[11px] font-medium text-brand-gray">PNG, JPEG or WebP · Maximum 20 MB</span>
        </button>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFile(file)
        }} />

        <div className="mx-auto mt-8 flex max-w-2xl flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs font-medium text-white/50">
          <span className="flex items-center gap-2"><Check className="size-3.5 text-accent-teal" /> No cropping</span>
          <span className="flex items-center gap-2"><Check className="size-3.5 text-accent-teal" /> Seamless outpainting</span>
          <span className="flex items-center gap-2"><Check className="size-3.5 text-accent-teal" /> 300-DPI print sizes</span>
        </div>
      </div>
    </main>
  )
}

export function BorderExpanderStudio() {
  const [image, setImage] = useState<ImageState | null>(null)
  const [printSize, setPrintSize] = useState<PrintSize>('4x6')
  const [orientation, setOrientation] = useState<Orientation>('portrait')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState<'upload' | 'expand' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url) }, [image])
  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl) }, [resultUrl])

  const target = PRINT_SIZES[printSize][orientation]
  const rectangle = useMemo(
    () => image ? sourceRectangle(image.width, image.height, target.width, target.height) : null,
    [image, target.height, target.width],
  )

  const chooseFile = useCallback(async (file: File) => {
    setBusy('upload')
    setError(null)
    try {
      const next = await normalizeImage(file)
      setImage(next)
      setResultUrl(null)
      setOrientation(next.width >= next.height ? 'landscape' : 'portrait')
    } catch (caught) {
      setError(messageFromError(caught))
    } finally {
      setBusy(null)
    }
  }, [])

  const generate = async () => {
    if (!image) return
    setBusy('expand')
    setError(null)
    try {
      const positionedSource = sourceRectangle(image.width, image.height, target.width, target.height)
      const hasExpansion = positionedSource.width < target.width - 1 || positionedSource.height < target.height - 1
      if (!hasExpansion) {
        setResultUrl(await prepareOutput(image.url, target))
        return
      }
      const body = new FormData()
      body.set('image', image.blob, image.name)
      body.set('print_size', printSize)
      body.set('orientation', orientation)
      const response = await apiFetch('/border-expand', { method: 'POST', body })
      const generatedUrl = URL.createObjectURL(await response.blob())
      try {
        setResultUrl(await prepareOutput(generatedUrl, target))
      } finally {
        URL.revokeObjectURL(generatedUrl)
      }
    } catch (caught) {
      setError(messageFromError(caught))
    } finally {
      setBusy(null)
    }
  }

  const choosePrintSize = (next: PrintSize) => {
    setPrintSize(next)
    setResultUrl(null)
  }

  const chooseOrientation = (next: Orientation) => {
    setOrientation(next)
    setResultUrl(null)
  }

  const reset = () => {
    setImage(null)
    setResultUrl(null)
    setError(null)
    setPrintSize('4x6')
  }

  return (
    <div className="min-h-screen bg-[#f4f5f8] text-brand-navy">
      <SiteHeader />

      {error && (
        <div className="fixed left-1/2 top-28 z-50 flex w-[min(92vw,620px)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-red-200 bg-white p-4 text-sm text-red-700 shadow-xl"><X className="size-4 shrink-0" /><span className="flex-1">{error}</span><button type="button" aria-label="Dismiss" onClick={() => setError(null)}><X className="size-4" /></button></div>
      )}

      {!image ? <UploadView onFile={chooseFile} busy={busy === 'upload'} /> : (
        <main className="magic-editor-enter mx-auto grid min-h-[calc(100vh-103px)] max-w-[1600px] lg:grid-cols-[minmax(0,1fr)_410px]">
          <section className="flex min-h-[650px] flex-col p-4 sm:p-6 lg:p-8">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-lg font-extrabold tracking-tight">{resultUrl ? 'Your print-ready expansion' : 'Preview your new canvas'}</p><p className="mt-0.5 text-xs text-muted-foreground">{resultUrl ? 'The full canvas was rendered as one continuous scene' : 'The striped area will be generated around your full photo'}</p></div>
              <button type="button" onClick={reset} disabled={!!busy} className="rounded-full bg-brand-navy px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-accent-teal disabled:opacity-40">New image</button>
            </div>

            <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-[2rem] bg-[#e5e7ed] p-5 shadow-inner ring-1 ring-black/5 sm:p-8">
              <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(45deg,#d7dae2_25%,transparent_25%),linear-gradient(-45deg,#d7dae2_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#d7dae2_75%),linear-gradient(-45deg,transparent_75%,#d7dae2_75%)] [background-position:0_0,0_12px,12px_-12px,-12px_0] [background-size:24px_24px]" />
              <div className="magic-image-land relative z-10 max-h-[76vh] max-w-full overflow-hidden bg-white shadow-2xl shadow-brand-navy/20 ring-1 ring-black/10" style={{ aspectRatio: `${target.width}/${target.height}`, height: orientation === 'portrait' ? 'min(72vh, 720px)' : 'auto', width: orientation === 'landscape' ? 'min(100%, 900px)' : 'auto' }}>
                {resultUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resultUrl} alt={`Expanded ${printSize} result`} className="size-full object-fill" />
                ) : rectangle ? (
                  <>
                    <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(69,191,174,0.16)_0px,rgba(69,191,174,0.16)_12px,rgba(69,191,174,0.05)_12px,rgba(69,191,174,0.05)_24px)]" />
                    <div className="absolute inset-0 flex items-center justify-center"><span className="rounded-full border border-accent-teal/25 bg-white/85 px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.18em] text-accent-teal shadow-sm">AI expands here</span></div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.url}
                      alt="Original positioned inside the expanded print"
                      className={`absolute object-fill shadow-[0_0_0_1px_rgba(255,255,255,0.65)] transition-all duration-700 ${busy === 'expand' ? 'scale-[1.01] blur-[3px] brightness-75' : ''}`}
                      style={{
                        left: `${(rectangle.x / target.width) * 100}%`,
                        top: `${(rectangle.y / target.height) * 100}%`,
                        width: `${(rectangle.width / target.width) * 100}%`,
                        height: `${(rectangle.height / target.height) * 100}%`,
                      }}
                    />
                  </>
                ) : null}

                {busy === 'expand' && (
                  <div className="magic-generating-overlay absolute inset-0 z-30 flex items-center justify-center overflow-hidden bg-brand-navy/55 backdrop-blur-[3px]">
                    <div aria-hidden className="magic-generate-scan absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-accent-teal/35 to-transparent blur-xl" />
                    <div className="relative flex max-w-xs flex-col items-center px-6 text-center text-white"><span className="relative grid size-16 place-items-center rounded-2xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-md"><Expand className="size-7 text-accent-teal" /><span className="absolute -inset-2 -z-10 animate-ping rounded-3xl border border-accent-teal/35" /></span><div className="mt-6 h-7 overflow-hidden"><div className="magic-generate-words"><p className="h-7 text-lg font-extrabold">Reading the scene edges…</p><p className="h-7 text-lg font-extrabold">Extending the background…</p><p className="h-7 text-lg font-extrabold">Matching light and texture…</p><p className="h-7 text-lg font-extrabold">Blending every boundary…</p></div></div><p className="mt-2 text-xs leading-5 text-white/60">Creating a {PRINT_SIZES[printSize].label}-inch {orientation} print</p><span className="mt-6 h-1 w-52 overflow-hidden rounded-full bg-white/15"><span className="magic-generate-progress block h-full w-2/5 rounded-full bg-accent-teal shadow-[0_0_12px_rgba(69,191,174,0.8)]" /></span></div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="border-l border-black/5 bg-white p-6 shadow-[-20px_0_50px_rgba(35,48,107,0.04)] sm:p-8">
            {resultUrl ? (
              <div className="flex h-full flex-col">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent-teal">Expansion complete</p>
                <div className="mt-6 grid size-14 place-items-center rounded-2xl bg-accent-teal text-white shadow-lg shadow-accent-teal/20"><Check className="size-7" strokeWidth={3} /></div>
                <h2 className="mt-6 text-3xl font-extrabold tracking-tight">More scene. Zero crop.</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">The source and its new surroundings were rendered as one continuous image, preventing hard rectangular seams and overlapping scene details.</p>
                <div className="mt-7 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl bg-[#eef8f6] p-4 text-center"><div><p className="text-lg font-extrabold">{image.width} × {image.height}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Original</p></div><ArrowRight className="size-4 text-accent-teal" /><div><p className="text-lg font-extrabold text-accent-teal">{target.width} × {target.height}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{PRINT_SIZES[printSize].label} at 300 DPI</p></div></div>
                <a href={resultUrl} download={`expanded-${printSize}-${image.name.replace(/\.[^.]+$/, '')}.png`} className="mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-brand-navy px-5 py-4 text-sm font-bold text-white shadow-lg shadow-brand-navy/20 transition-all hover:-translate-y-0.5 hover:bg-accent-teal"><Download className="size-4" /> Download print-ready PNG</a>
                <button type="button" onClick={() => setResultUrl(null)} className="mt-3 inline-flex items-center justify-center gap-2 rounded-full border border-brand-navy/10 px-5 py-3.5 text-sm font-bold transition-colors hover:border-accent-teal hover:text-accent-teal"><RefreshCw className="size-4" /> Try another format</button>
              </div>
            ) : (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent-teal">Border Expander</p><h2 className="mt-2 text-2xl font-extrabold tracking-tight">Choose your print.</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">Your full image stays centered. AI creates only the background needed to reach the selected print ratio.</p>

                <div className="mt-7 rounded-2xl border border-brand-navy/[0.08] bg-[#f7f8fa] p-4"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-white text-brand-navy shadow-sm"><ImagePlus className="size-4" /></span><div className="min-w-0"><p className="truncate text-xs font-extrabold">{image.name}</p><p className="mt-1 text-[10px] text-muted-foreground">{image.width} × {image.height} · Full composition retained</p></div></div></div>

                <p className="mt-7 text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Print size</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {(Object.keys(PRINT_SIZES) as PrintSize[]).map((size) => (
                    <button key={size} type="button" onClick={() => choosePrintSize(size)} className={`rounded-2xl border-2 p-4 text-left transition-all ${printSize === size ? 'border-accent-teal bg-accent-teal/[0.07] shadow-sm' : 'border-brand-navy/[0.07] hover:border-accent-teal/40'}`}><span className="block text-xl font-extrabold">{PRINT_SIZES[size].label}</span><span className="mt-1 block text-[10px] text-muted-foreground">{PRINT_SIZES[size].description}</span>{printSize === size && <Check className="mt-3 size-4 text-accent-teal" />}</button>
                  ))}
                </div>

                <p className="mt-7 text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Orientation</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => chooseOrientation('portrait')} className={`flex items-center justify-center gap-2 rounded-2xl border-2 px-3 py-3.5 text-xs font-extrabold transition-all ${orientation === 'portrait' ? 'border-accent-teal bg-accent-teal/[0.07]' : 'border-brand-navy/[0.07] hover:border-accent-teal/40'}`}><RectangleVertical className="size-4" /> Portrait</button>
                  <button type="button" onClick={() => chooseOrientation('landscape')} className={`flex items-center justify-center gap-2 rounded-2xl border-2 px-3 py-3.5 text-xs font-extrabold transition-all ${orientation === 'landscape' ? 'border-accent-teal bg-accent-teal/[0.07]' : 'border-brand-navy/[0.07] hover:border-accent-teal/40'}`}><RectangleHorizontal className="size-4" /> Landscape</button>
                </div>

                <div className="mt-6 rounded-2xl bg-[#eef8f6] p-4"><div className="flex items-center justify-between text-xs"><span className="font-bold">Output</span><span className="font-extrabold text-accent-teal">{target.width} × {target.height}px</span></div><div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground"><span>No source cropping</span><span>300 DPI</span></div></div>
                <button type="button" disabled={!!busy} onClick={() => void generate()} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent-teal px-5 py-4 text-sm font-extrabold text-white shadow-lg shadow-accent-teal/25 transition-all hover:-translate-y-0.5 hover:bg-[#37aa9a] disabled:translate-y-0 disabled:opacity-50">{busy === 'expand' ? <><LoaderCircle className="size-4 animate-spin" /> Expanding background…</> : <><Sparkles className="size-4" /> Expand to {PRINT_SIZES[printSize].label}<ArrowRight className="size-4" /></>}</button>
                <p className="mt-3 text-center text-[10px] font-medium text-muted-foreground">AI outpainting · One continuous generated canvas</p>
              </div>
            )}
          </aside>
        </main>
      )}

      {busy === 'upload' && <div className="fixed inset-0 z-50 grid place-items-center bg-brand-navy/85 backdrop-blur-xl"><div className="magic-upload-pop flex flex-col items-center text-center"><span className="relative grid size-20 place-items-center rounded-[1.6rem] bg-white text-accent-teal shadow-2xl"><Frame className="size-8" /><span className="absolute -inset-3 -z-10 animate-ping rounded-[2rem] border border-accent-teal/40" /></span><p className="mt-7 text-xl font-extrabold text-white">Preparing your canvas</p><p className="mt-2 text-sm text-white/55">Reading the photo dimensions and finding the perfect fit…</p><span className="mt-6 h-1 w-48 overflow-hidden rounded-full bg-white/10"><span className="magic-progress block h-full rounded-full bg-accent-teal" /></span></div></div>}
    </div>
  )
}
