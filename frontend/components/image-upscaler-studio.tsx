'use client'

import {
  ArrowRight,
  Check,
  Cloud,
  Cpu,
  Download,
  ImagePlus,
  LoaderCircle,
  Maximize2,
  RefreshCw,
  ScanSearch,
  Sparkles,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { SiteHeader } from '@/components/site-header'
import { apiFetch, backendUrl } from '@/lib/api'

type Scale = 2 | 4
type UpscaleMode = 'faithful' | 'ai'
type SupportedMimeType = 'image/png' | 'image/jpeg' | 'image/webp'
type ImageState = { blob: Blob; url: string; width: number; height: number; name: string; mimeType: SupportedMimeType }
type OutputSize = { width: number; height: number; actualScale: number }
type ResultInfo = OutputSize & { engine: string; processingTimeMs?: number }

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong'
}

async function normalizeImage(file: File): Promise<ImageState> {
  if (file.type !== 'image/png' && file.type !== 'image/jpeg' && file.type !== 'image/webp') {
    throw new Error('Choose a PNG, JPEG, or WebP image')
  }
  if (file.size > 20 * 1024 * 1024) throw new Error('Images must be 20 MB or smaller')

  const bitmap = await createImageBitmap(file)
  if (bitmap.width < 128 || bitmap.height < 128) {
    bitmap.close()
    throw new Error('Images must be at least 128 pixels wide and tall')
  }
  const ratio = bitmap.width / bitmap.height
  if (ratio > 3 || ratio < 1 / 3) {
    bitmap.close()
    throw new Error('Very wide or tall images are not supported. Use an aspect ratio between 1:3 and 3:1.')
  }
  const width = bitmap.width
  const height = bitmap.height
  bitmap.close()
  return { blob: file, url: URL.createObjectURL(file), width, height, name: file.name, mimeType: file.type }
}

function calculateOutputSize(width: number, height: number, requestedScale: Scale, mode: UpscaleMode): OutputSize {
  const longEdge = Math.max(width, height)
  const maximumPixels = mode === 'faithful' ? 40_000_000 : 3_840 * 2_160
  const maximumEdge = mode === 'faithful' ? 8_192 : 3_840
  const maximumScale = Math.min(maximumEdge / longEdge, Math.sqrt(maximumPixels / (width * height)))
  const appliedScale = Math.min(requestedScale, maximumScale)
  const alignment = mode === 'ai' ? 16 : 1
  const outputWidth = Math.max(256, Math.floor((width * appliedScale) / alignment) * alignment)
  const outputHeight = Math.max(256, Math.floor((height * appliedScale) / alignment) * alignment)
  return {
    width: outputWidth,
    height: outputHeight,
    actualScale: Math.min(outputWidth / width, outputHeight / height),
  }
}

function megapixels(width: number, height: number) {
  return ((width * height) / 1_000_000).toFixed(1)
}

async function inspectBlob(blob: Blob) {
  const bitmap = await createImageBitmap(blob)
  const dimensions = { width: bitmap.width, height: bitmap.height }
  bitmap.close()
  return { url: URL.createObjectURL(blob), ...dimensions }
}

function UploadView({ onFile, busy }: { onFile: (file: File) => void; busy: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  return (
    <main className="relative min-h-[calc(100vh-103px)] overflow-hidden bg-brand-navy px-5 pb-20 pt-14 sm:pt-20">
      <div aria-hidden className="pointer-events-none absolute -right-44 -top-28 size-[38rem] rounded-full border-[96px] border-brand-green/[0.055]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-52 -left-32 size-[34rem] rounded-full border-[80px] border-accent-teal/[0.055]" />
      <div className="relative mx-auto max-w-5xl text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-green text-brand-navy shadow-xl shadow-brand-green/20"><ScanSearch className="size-7" /></div>
        <h1 className="mx-auto mt-6 max-w-4xl text-balance text-4xl font-extrabold leading-[1.06] text-white sm:text-6xl">
          Small photo.<br /><span className="text-brand-green">Remarkable detail.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-white/65 sm:text-lg">
          Turn pixelated, compressed, or low-resolution images into clean, crisp files ready for sharing and printing.
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
          className={`group mx-auto mt-10 flex w-full max-w-4xl flex-col items-center rounded-[2rem] border-2 border-dashed bg-white px-8 py-12 shadow-2xl shadow-black/25 transition-all sm:py-14 ${dragging ? 'scale-[1.015] border-brand-green' : 'border-white/70 hover:-translate-y-1 hover:border-brand-green'}`}
        >
          <span className="relative grid size-16 place-items-center rounded-full bg-brand-green/15 text-brand-green-dark transition-transform group-hover:scale-105"><ImagePlus className="size-7" /><span className="absolute -right-0.5 -top-0.5 size-4 rounded-full border-2 border-white bg-accent-pink" /></span>
          <span className="mt-5 text-xl font-extrabold text-brand-navy">Drop your low-quality image here</span>
          <span className="mt-2 text-sm text-muted-foreground">or click to choose one from your device</span>
          <span className="mt-5 rounded-full bg-brand-navy px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition-colors group-hover:bg-brand-green group-hover:text-brand-navy">Choose an image</span>
          <span className="mt-4 text-[11px] font-medium text-brand-gray">PNG, JPEG or WebP · Maximum 20 MB</span>
        </button>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFile(file)
        }} />

        <div className="mx-auto mt-8 flex max-w-2xl flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs font-medium text-white/50">
          <span className="flex items-center gap-2"><Check className="size-3.5 text-brand-green" /> Up to 4× larger</span>
          <span className="flex items-center gap-2"><Check className="size-3.5 text-brand-green" /> Compression cleanup</span>
          <span className="flex items-center gap-2"><Check className="size-3.5 text-brand-green" /> Identity preserved</span>
        </div>
      </div>
    </main>
  )
}

export function ImageUpscalerStudio() {
  const [image, setImage] = useState<ImageState | null>(null)
  const [scale, setScale] = useState<Scale>(2)
  const [mode, setMode] = useState<UpscaleMode>('faithful')
  const [strength, setStrength] = useState(0.75)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultSize, setResultSize] = useState<ResultInfo | null>(null)
  const [compare, setCompare] = useState(50)
  const [zoom, setZoom] = useState(1)
  const [localReady, setLocalReady] = useState<boolean | null>(null)
  const [busy, setBusy] = useState<'upload' | 'upscale' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url) }, [image])
  useEffect(() => () => { if (resultUrl?.startsWith('blob:')) URL.revokeObjectURL(resultUrl) }, [resultUrl])
  useEffect(() => {
    let active = true
    void fetch(backendUrl('/health'), { cache: 'no-store' })
      .then(async (response) => {
        const value: unknown = await response.json()
        const ready = response.ok && typeof value === 'object' && value !== null
          && 'cuda' in value && value.cuda === true
          && 'upscalerInstalled' in value && value.upscalerInstalled === true
        if (active) setLocalReady(ready)
      })
      .catch(() => { if (active) setLocalReady(false) })
    return () => { active = false }
  }, [])

  const chooseFile = useCallback(async (file: File) => {
    setBusy('upload')
    setError(null)
    try {
      const next = await normalizeImage(file)
      setImage(next)
      setResultUrl(null)
      setResultSize(null)
      setCompare(50)
      setZoom(1)
    } catch (caught) {
      setError(messageFromError(caught))
    } finally {
      setBusy(null)
    }
  }, [])

  const generate = async () => {
    if (!image) return
    const target = calculateOutputSize(image.width, image.height, scale, mode)
    if (target.actualScale <= 1) {
      setError('This image is already at the maximum supported resolution')
      return
    }
    setBusy('upscale')
    setError(null)
    try {
      if (mode === 'faithful') {
        const body = new FormData()
        body.set('image', image.blob, image.name)
        body.set('output_width', String(target.width))
        body.set('output_height', String(target.height))
        body.set('strength', String(strength))
        const response = await apiFetch('/upscale', { method: 'POST', body })
        const inspected = await inspectBlob(await response.blob())
        setResultUrl(inspected.url)
        setResultSize({
          ...inspected,
          actualScale: Math.min(inspected.width / image.width, inspected.height / image.height),
          engine: response.headers.get('x-upscale-model') ?? 'Real-ESRGAN',
          processingTimeMs: Number(response.headers.get('x-processing-time-ms')) || undefined,
        })
      } else {
        const body = new FormData()
        body.set('image', image.blob, image.name)
        body.set('scale', String(scale))
        body.set('output_width', String(target.width))
        body.set('output_height', String(target.height))
        const response = await apiFetch('/ai/upscale', { method: 'POST', body })
        const inspected = await inspectBlob(await response.blob())
        setResultUrl(inspected.url)
        setResultSize({
          ...inspected,
          actualScale: Math.min(inspected.width / image.width, inspected.height / image.height),
          engine: 'Gemini AI Restore',
        })
      }
      setCompare(50)
      setZoom(1)
    } catch (caught) {
      setError(messageFromError(caught))
    } finally {
      setBusy(null)
    }
  }

  const reset = () => {
    setImage(null)
    setResultUrl(null)
    setResultSize(null)
    setError(null)
    setCompare(50)
    setZoom(1)
  }

  const target = image ? calculateOutputSize(image.width, image.height, scale, mode) : null

  return (
    <div className="min-h-screen bg-[#f4f5f8] text-brand-navy">
      <SiteHeader />

      {error && (
        <div className="fixed left-1/2 top-28 z-50 flex w-[min(92vw,620px)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-red-200 bg-white p-4 text-sm text-red-700 shadow-xl"><X className="size-4 shrink-0" /><span className="flex-1">{error}</span><button type="button" aria-label="Dismiss" onClick={() => setError(null)}><X className="size-4" /></button></div>
      )}

      {!image ? <UploadView onFile={chooseFile} busy={busy === 'upload'} /> : (
        <main className="magic-editor-enter mx-auto grid min-h-[calc(100vh-103px)] max-w-[1600px] lg:grid-cols-[minmax(0,1fr)_410px]">
          <section className="flex min-h-[620px] flex-col p-4 sm:p-6 lg:p-8">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-lg font-extrabold tracking-tight">{resultUrl ? 'Your enhanced image is ready' : 'Ready to recover the detail'}</p><p className="mt-0.5 text-xs text-muted-foreground">{resultUrl ? 'Drag the slider to inspect the clarity improvement' : 'Choose an enlargement on the right, then upscale'}</p></div>
              <button type="button" onClick={reset} disabled={!!busy} className="rounded-full bg-brand-navy px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-brand-green hover:text-brand-navy disabled:opacity-40">New image</button>
            </div>

            <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-[2rem] bg-[#e5e7ed] shadow-inner ring-1 ring-black/5">
              <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(45deg,#d7dae2_25%,transparent_25%),linear-gradient(-45deg,#d7dae2_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#d7dae2_75%),linear-gradient(-45deg,transparent_75%,#d7dae2_75%)] [background-position:0_0,0_12px,12px_-12px,-12px_0] [background-size:24px_24px]" />
              <div className="magic-image-land relative z-10 max-h-[76vh] max-w-full overflow-hidden rounded-2xl bg-brand-navy shadow-2xl shadow-brand-navy/20 transition-transform duration-300" style={{ aspectRatio: `${image.width}/${image.height}`, transform: `scale(${zoom})` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt="Original low-resolution image" className={`block max-h-[76vh] max-w-full object-contain transition-all duration-700 ${busy === 'upscale' ? 'scale-[1.03] blur-[6px] brightness-75' : ''}`} />
                {resultUrl && (
                  <div className="absolute inset-0 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resultUrl} alt="Upscaled result" className="absolute inset-0 size-full object-contain" style={{ clipPath: `inset(0 ${100 - compare}% 0 0)` }} />
                    <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-lg" style={{ left: `${compare}%` }} />
                    <input aria-label="Compare original and upscaled image" type="range" min="0" max="100" value={compare} onChange={(event) => setCompare(Number(event.target.value))} className="absolute inset-0 size-full cursor-ew-resize opacity-0" />
                    <span className="absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Enhanced</span><span className="absolute right-3 top-3 rounded-full bg-black/55 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Original</span>
                  </div>
                )}
                {busy === 'upscale' && (
                  <div className="magic-generating-overlay absolute inset-0 z-30 flex items-center justify-center overflow-hidden bg-brand-navy/40 backdrop-blur-[2px]">
                    <div aria-hidden className="magic-generate-scan absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent blur-xl" />
                    <div className="relative flex max-w-xs flex-col items-center px-6 text-center text-white"><span className="relative grid size-16 place-items-center rounded-2xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-md"><ScanSearch className="size-7 text-brand-green" /><span className="absolute -inset-2 -z-10 animate-ping rounded-3xl border border-brand-green/30" /></span><div className="mt-6 h-7 overflow-hidden"><div className="magic-generate-words"><p className="h-7 text-lg font-extrabold">Analyzing every pixel…</p><p className="h-7 text-lg font-extrabold">Recovering fine detail…</p><p className="h-7 text-lg font-extrabold">Cleaning compression…</p><p className="h-7 text-lg font-extrabold">Sharpening the result…</p></div></div><p className="mt-2 text-xs leading-5 text-white/60">Building a crisp {target?.width} × {target?.height} image</p><span className="mt-6 h-1 w-52 overflow-hidden rounded-full bg-white/15"><span className="magic-generate-progress block h-full w-2/5 rounded-full bg-brand-green shadow-[0_0_12px_rgba(140,198,63,0.8)]" /></span></div>
                  </div>
                )}
              </div>
              {resultUrl && (
                <div className="absolute bottom-4 right-4 z-40 flex items-center gap-1 rounded-full border border-white/60 bg-white/90 p-1 shadow-lg backdrop-blur">
                  <button type="button" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(1, value - 0.5))} disabled={zoom <= 1} className="grid size-8 place-items-center rounded-full transition-colors hover:bg-brand-navy/5 disabled:opacity-30"><ZoomOut className="size-4" /></button>
                  <span className="min-w-11 text-center text-[10px] font-extrabold">{Math.round(zoom * 100)}%</span>
                  <button type="button" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(3, value + 0.5))} disabled={zoom >= 3} className="grid size-8 place-items-center rounded-full transition-colors hover:bg-brand-navy/5 disabled:opacity-30"><ZoomIn className="size-4" /></button>
                </div>
              )}
            </div>
          </section>

          <aside className="border-l border-black/5 bg-white p-6 shadow-[-20px_0_50px_rgba(35,48,107,0.04)] sm:p-8">
            {resultUrl && resultSize ? (
              <div className="flex h-full flex-col">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-green-dark">Upscale complete</p>
                <div className="mt-6 grid size-14 place-items-center rounded-2xl bg-brand-green text-brand-navy shadow-lg shadow-brand-green/20"><Check className="size-7" strokeWidth={3} /></div>
                <h2 className="mt-6 text-3xl font-extrabold tracking-tight">Sharper. Larger. Ready.</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">Fine detail has been restored and compression artifacts reduced without intentionally changing your image.</p>
                <div className="mt-5 flex items-center justify-between rounded-xl border border-brand-navy/[0.07] px-4 py-3 text-[10px]"><span className="font-bold text-muted-foreground">Processed with</span><span className="text-right font-extrabold text-brand-navy">{resultSize.engine}{resultSize.processingTimeMs ? ` · ${(resultSize.processingTimeMs / 1000).toFixed(1)}s` : ''}</span></div>
                <div className="mt-7 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl bg-[#f3f5f1] p-4 text-center"><div><p className="text-lg font-extrabold">{image.width} × {image.height}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Original</p></div><ArrowRight className="size-4 text-brand-green-dark" /><div><p className="text-lg font-extrabold text-brand-green-dark">{resultSize.width} × {resultSize.height}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Enhanced</p></div></div>
                <a href={resultUrl} download={`upscaled-${image.name.replace(/\.[^.]+$/, '')}.png`} className="mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-brand-navy px-5 py-4 text-sm font-bold text-white shadow-lg shadow-brand-navy/20 transition-all hover:-translate-y-0.5 hover:bg-brand-green hover:text-brand-navy"><Download className="size-4" /> Download upscaled PNG</a>
                <button type="button" onClick={() => { setResultUrl(null); setResultSize(null) }} className="mt-3 inline-flex items-center justify-center gap-2 rounded-full border border-brand-navy/10 px-5 py-3.5 text-sm font-bold transition-colors hover:border-brand-green hover:text-brand-green-dark"><RefreshCw className="size-4" /> Try another size</button>
              </div>
            ) : (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-green-dark">Image Upscaler</p><h2 className="mt-2 text-2xl font-extrabold tracking-tight">Choose your size.</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">We recover natural detail as the image grows—not just stretch the existing pixels.</p>

                <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-[#f1f3f5] p-1.5">
                  <button type="button" onClick={() => setMode('faithful')} className={`rounded-xl px-3 py-3 text-left transition-all ${mode === 'faithful' ? 'bg-white shadow-sm ring-1 ring-black/5' : 'text-muted-foreground hover:text-brand-navy'}`}><span className="flex items-center justify-between"><Cpu className={`size-4 ${mode === 'faithful' ? 'text-brand-green-dark' : ''}`} /><span className={`size-2 rounded-full ${localReady === null ? 'bg-brand-gray/40' : localReady ? 'bg-brand-green' : 'bg-amber-400'}`} /></span><span className="mt-2 block text-[11px] font-extrabold">Faithful</span><span className="mt-0.5 block text-[9px] leading-4">Local · {localReady === false ? 'service offline' : 'exact scene'}</span></button>
                  <button type="button" onClick={() => setMode('ai')} className={`rounded-xl px-3 py-3 text-left transition-all ${mode === 'ai' ? 'bg-white shadow-sm ring-1 ring-black/5' : 'text-muted-foreground hover:text-brand-navy'}`}><Cloud className={`size-4 ${mode === 'ai' ? 'text-accent-pink' : ''}`} /><span className="mt-2 block text-[11px] font-extrabold">AI Restore</span><span className="mt-0.5 block text-[9px] leading-4">Gemini · rebuild detail</span></button>
                </div>

                {mode === 'faithful' ? (
                  <div className="mt-4 rounded-2xl border border-brand-navy/[0.07] p-4">
                    <div className="flex items-center justify-between"><div><p className="text-[11px] font-extrabold">Restoration strength</p><p className="mt-1 text-[9px] text-muted-foreground">Blend natural pixels with recovered detail</p></div><span className="rounded-full bg-brand-green/15 px-2.5 py-1 text-[10px] font-extrabold text-brand-green-dark">{Math.round(strength * 100)}%</span></div>
                    <input aria-label="Restoration strength" type="range" min="25" max="100" step="5" value={Math.round(strength * 100)} onChange={(event) => setStrength(Number(event.target.value) / 100)} className="mt-4 w-full accent-[#8cc63f]" />
                    <div className="mt-2 flex justify-between text-[8px] font-bold uppercase tracking-wider text-muted-foreground"><span>Natural</span><span>Crisp</span></div>
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-[10px] leading-4 text-amber-800">AI Restore can reconstruct severe damage, but it may reinterpret tiny faces, lettering, or textures.</p>
                )}

                <div className="mt-7 rounded-2xl border border-brand-navy/[0.08] bg-[#f7f8fa] p-4"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-white text-brand-navy shadow-sm"><ImagePlus className="size-4" /></span><div className="min-w-0"><p className="truncate text-xs font-extrabold">{image.name}</p><p className="mt-1 text-[10px] text-muted-foreground">{image.width} × {image.height} · {megapixels(image.width, image.height)} MP</p></div></div></div>

                <div className="mt-7 space-y-3">
                  {([2, 4] as const).map((option) => {
                    const optionSize = calculateOutputSize(image.width, image.height, option, mode)
                    return <button key={option} type="button" onClick={() => setScale(option)} className={`flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all ${scale === option ? 'border-brand-green bg-brand-green/[0.07] shadow-sm' : 'border-brand-navy/[0.07] hover:border-brand-green/40'}`}><span className={`grid size-12 shrink-0 place-items-center rounded-xl text-lg font-extrabold ${scale === option ? 'bg-brand-green text-brand-navy' : 'bg-brand-navy/[0.06]'}`}>{option}×</span><span><span className="block text-xs font-extrabold">{option === 2 ? 'Clear & shareable' : 'Maximum detail'}</span><span className="mt-1 block text-[10px] text-muted-foreground">Up to {optionSize.width} × {optionSize.height} · {megapixels(optionSize.width, optionSize.height)} MP</span></span>{scale === option && <Check className="ml-auto size-4 text-brand-green-dark" />}</button>
                  })}
                </div>

                {target && target.actualScale < scale - 0.1 && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-700">Output is capped at the highest supported 4K-range resolution for this aspect ratio.</p>}
                <div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-[#f7f8fa] p-3"><Maximize2 className="size-4 text-brand-green-dark" /><p className="mt-2 text-[10px] font-bold">Larger dimensions</p></div><div className="rounded-2xl bg-[#f7f8fa] p-3"><Zap className="size-4 text-accent-pink" /><p className="mt-2 text-[10px] font-bold">Recovered detail</p></div></div>
                <button type="button" disabled={!!busy} onClick={() => void generate()} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-green px-5 py-4 text-sm font-extrabold text-brand-navy shadow-lg shadow-brand-green/25 transition-all hover:-translate-y-0.5 hover:bg-[#7eb638] disabled:translate-y-0 disabled:opacity-50">{busy === 'upscale' ? <><LoaderCircle className="size-4 animate-spin" /> Upscaling image…</> : <><Sparkles className="size-4" /> Upscale to {target?.width} × {target?.height}<ArrowRight className="size-4" /></>}</button>
                <p className="mt-3 text-center text-[10px] font-medium text-muted-foreground">{mode === 'faithful' ? 'Runs privately on your RTX 5090 · No creative restyling' : 'Cloud AI restoration · Best for severely damaged images'}</p>
              </div>
            )}
          </aside>
        </main>
      )}

      {busy === 'upload' && <div className="fixed inset-0 z-50 grid place-items-center bg-brand-navy/85 backdrop-blur-xl"><div className="magic-upload-pop flex flex-col items-center text-center"><span className="relative grid size-20 place-items-center rounded-[1.6rem] bg-white text-brand-green-dark shadow-2xl"><ScanSearch className="size-8" /><span className="absolute -inset-3 -z-10 animate-ping rounded-[2rem] border border-brand-green/40" /></span><p className="mt-7 text-xl font-extrabold text-white">Inspecting your image</p><p className="mt-2 text-sm text-white/55">Reading dimensions and preparing every pixel…</p><span className="mt-6 h-1 w-48 overflow-hidden rounded-full bg-white/10"><span className="magic-progress block h-full rounded-full bg-brand-green" /></span></div></div>}
    </div>
  )
}
