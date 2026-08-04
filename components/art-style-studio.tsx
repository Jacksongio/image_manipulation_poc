'use client'

import { useAction, useMutation } from 'convex/react'
import {
  ArrowRight,
  Check,
  Download,
  ImagePlus,
  LoaderCircle,
  Palette,
  RefreshCw,
  Sparkles,
  WandSparkles,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { SiteHeader } from '@/components/site-header'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

type StyleId = 'watercolor' | 'oil-painting' | 'pencil-sketch' | 'pop-art' | 'anime' | 'impressionist' | 'storybook' | 'vintage-poster'
type Intensity = 'subtle' | 'balanced' | 'bold'
type ImageState = { blob: Blob; url: string; width: number; height: number; name: string }

const STYLES: Array<{
  id: StyleId
  name: string
  detail: string
  colors: string
  filter: string
}> = [
  { id: 'watercolor', name: 'Watercolor', detail: 'Soft washes & paper grain', colors: 'from-sky-200 via-rose-100 to-amber-100', filter: 'saturate-75 contrast-75 brightness-110' },
  { id: 'oil-painting', name: 'Oil Painting', detail: 'Rich color & brushwork', colors: 'from-amber-700 via-rose-800 to-indigo-900', filter: 'saturate-150 contrast-125' },
  { id: 'pencil-sketch', name: 'Pencil Sketch', detail: 'Graphite lines & shading', colors: 'from-stone-200 via-white to-stone-400', filter: 'grayscale contrast-125 brightness-110' },
  { id: 'pop-art', name: 'Pop Art', detail: 'Bold ink & halftones', colors: 'from-yellow-300 via-pink-500 to-cyan-400', filter: 'saturate-200 contrast-150' },
  { id: 'anime', name: 'Anime', detail: 'Clean lines & cel shading', colors: 'from-indigo-300 via-pink-300 to-cyan-200', filter: 'saturate-125 contrast-110 brightness-105' },
  { id: 'impressionist', name: 'Impressionist', detail: 'Light-filled brushstrokes', colors: 'from-emerald-300 via-sky-300 to-violet-300', filter: 'saturate-125 contrast-75 brightness-110' },
  { id: 'storybook', name: 'Storybook', detail: 'Warm painted whimsy', colors: 'from-orange-200 via-lime-200 to-teal-200', filter: 'sepia saturate-125 brightness-105' },
  { id: 'vintage-poster', name: 'Vintage Poster', detail: 'Retro color & texture', colors: 'from-orange-500 via-amber-200 to-teal-700', filter: 'sepia contrast-125 saturate-75' },
]

const INTENSITIES: Array<{ id: Intensity; name: string }> = [
  { id: 'subtle', name: 'Subtle' },
  { id: 'balanced', name: 'Balanced' },
  { id: 'bold', name: 'Bold' },
]

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message.replace(/^\[CONVEX[^\]]*\]\s*/, '') : 'Something went wrong'
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not prepare the image'))), 'image/png')
  })
}

async function normalizeImage(file: File): Promise<ImageState> {
  if (!file.type.startsWith('image/')) throw new Error('Choose a PNG, JPEG, or WebP image')
  if (file.size > 20 * 1024 * 1024) throw new Error('Images must be 20 MB or smaller')

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height))
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

function UploadView({ onFile, busy }: { onFile: (file: File) => void; busy: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  return (
    <main className="relative min-h-[calc(100vh-103px)] overflow-hidden bg-brand-navy px-5 pb-20 pt-14 sm:pt-20">
      <div aria-hidden className="pointer-events-none absolute -right-44 -top-28 size-[38rem] rounded-full border-[96px] border-accent-orange/[0.06]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-48 -left-36 size-[34rem] rounded-full border-[80px] border-brand-green/[0.05]" />
      <div className="relative mx-auto max-w-5xl text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent-orange text-white shadow-xl shadow-accent-orange/20"><Palette className="size-7" /></div>
        <h1 className="mx-auto mt-6 max-w-4xl text-balance text-4xl font-extrabold leading-[1.06] text-white sm:text-6xl">
          Your photo, reimagined<br /><span className="text-brand-green">as a work of art.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-white/65 sm:text-lg">
          Upload any photo and transform it with a curated artistic style while keeping the people, details, and composition you love.
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
          className={`group mx-auto mt-10 flex w-full max-w-4xl flex-col items-center overflow-hidden rounded-[2rem] border-2 border-dashed bg-white px-8 py-12 shadow-2xl shadow-black/25 transition-all sm:py-14 ${dragging ? 'scale-[1.015] border-accent-orange' : 'border-white/70 hover:-translate-y-1 hover:border-brand-green'}`}
        >
          <span className="relative grid size-16 place-items-center rounded-full bg-accent-orange/10 text-accent-orange transition-transform group-hover:scale-105"><ImagePlus className="size-7" /><span className="absolute -right-0.5 -top-0.5 size-4 rounded-full border-2 border-white bg-brand-green" /></span>
          <span className="mt-5 text-xl font-extrabold text-brand-navy">Drop your photo here</span>
          <span className="mt-2 text-sm text-muted-foreground">or click to choose one from your device</span>
          <span className="mt-5 rounded-full bg-brand-navy px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition-colors group-hover:bg-accent-orange">Choose a photo</span>
          <span className="mt-4 text-[11px] font-medium text-brand-gray">PNG, JPEG or WebP · Maximum 20 MB</span>
        </button>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFile(file)
        }} />

        <div className="mx-auto mt-8 flex max-w-2xl flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs font-medium text-white/50">
          <span className="flex items-center gap-2"><Check className="size-3.5 text-brand-green" /> Identity preserved</span>
          <span className="flex items-center gap-2"><Check className="size-3.5 text-brand-green" /> Eight curated styles</span>
          <span className="flex items-center gap-2"><Check className="size-3.5 text-brand-green" /> Print-ready PNG</span>
        </div>
      </div>
    </main>
  )
}

export function ArtStyleStudio() {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const transform = useAction(api.artStyle.transform)
  const [image, setImage] = useState<ImageState | null>(null)
  const [imageId, setImageId] = useState<Id<'_storage'> | null>(null)
  const [style, setStyle] = useState<StyleId>('watercolor')
  const [intensity, setIntensity] = useState<Intensity>('balanced')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [compare, setCompare] = useState(50)
  const [busy, setBusy] = useState<'upload' | 'generate' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url) }, [image])

  const chooseFile = useCallback(async (file: File) => {
    setBusy('upload')
    setError(null)
    try {
      const next = await normalizeImage(file)
      setImage(next)
      setImageId(null)
      setResultUrl(null)
      setCompare(50)
    } catch (caught) {
      setError(messageFromError(caught))
    } finally {
      setBusy(null)
    }
  }, [])

  const uploadSource = async () => {
    if (!image) throw new Error('Choose a photo first')
    if (imageId) return imageId
    const uploadUrl = await generateUploadUrl({})
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
      body: image.blob,
    })
    if (!response.ok) throw new Error('Could not upload the image to Convex')
    const value: unknown = await response.json()
    if (typeof value !== 'object' || value === null || !('storageId' in value) || typeof value.storageId !== 'string') {
      throw new Error('Convex returned an invalid upload response')
    }
    const storageId = value.storageId as Id<'_storage'>
    setImageId(storageId)
    return storageId
  }

  const generate = async () => {
    if (!image) return
    setBusy('generate')
    setError(null)
    try {
      const sourceId = await uploadSource()
      const result = await transform({ imageId: sourceId, style, intensity })
      setResultUrl(result.url)
      setCompare(50)
    } catch (caught) {
      setError(messageFromError(caught))
    } finally {
      setBusy(null)
    }
  }

  const reset = () => {
    setImage(null)
    setImageId(null)
    setResultUrl(null)
    setError(null)
    setCompare(50)
  }

  const selectedStyle = STYLES.find((item) => item.id === style) ?? STYLES[0]

  return (
    <div className="min-h-screen bg-[#f4f5f8] text-brand-navy">
      <SiteHeader />

      {error && (
        <div className="fixed left-1/2 top-28 z-50 flex w-[min(92vw,620px)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-red-200 bg-white p-4 text-sm text-red-700 shadow-xl">
          <X className="size-4 shrink-0" /><span className="flex-1">{error}</span><button type="button" aria-label="Dismiss" onClick={() => setError(null)}><X className="size-4" /></button>
        </div>
      )}

      {!image ? <UploadView onFile={chooseFile} busy={busy === 'upload'} /> : (
        <main className="magic-editor-enter mx-auto grid min-h-[calc(100vh-103px)] max-w-[1600px] lg:grid-cols-[minmax(0,1fr)_440px]">
          <section className="flex min-h-[620px] flex-col p-4 sm:p-6 lg:p-8">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-extrabold tracking-tight">{resultUrl ? `${selectedStyle.name} transformation` : 'Choose your signature look'}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{resultUrl ? 'Drag the slider to compare your original and artwork' : 'Pick a style on the right, adjust its strength, then create'}</p>
              </div>
              <button type="button" onClick={reset} disabled={!!busy} className="rounded-full bg-brand-navy px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-accent-orange disabled:opacity-40">New photo</button>
            </div>

            <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-[2rem] bg-[#e5e7ed] shadow-inner ring-1 ring-black/5">
              <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(45deg,#d7dae2_25%,transparent_25%),linear-gradient(-45deg,#d7dae2_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#d7dae2_75%),linear-gradient(-45deg,transparent_75%,#d7dae2_75%)] [background-position:0_0,0_12px,12px_-12px,-12px_0] [background-size:24px_24px]" />
              <div className="magic-image-land relative z-10 max-h-[76vh] max-w-full overflow-hidden rounded-2xl bg-brand-navy shadow-2xl shadow-brand-navy/20" style={{ aspectRatio: `${image.width}/${image.height}` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt="Original photograph" className={`block max-h-[76vh] max-w-full object-contain transition-all duration-700 ${busy === 'generate' ? 'scale-[1.025] blur-[6px] brightness-75 saturate-75' : ''}`} />

                {resultUrl && (
                  <div className="absolute inset-0 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resultUrl} alt={`${selectedStyle.name} result`} className="absolute inset-0 size-full object-fill" style={{ clipPath: `inset(0 ${100 - compare}% 0 0)` }} />
                    <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-lg" style={{ left: `${compare}%` }} />
                    <input aria-label="Compare original and styled image" type="range" min="0" max="100" value={compare} onChange={(event) => setCompare(Number(event.target.value))} className="absolute inset-0 size-full cursor-ew-resize opacity-0" />
                    <span className="absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Styled</span>
                    <span className="absolute right-3 top-3 rounded-full bg-black/55 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Original</span>
                  </div>
                )}

                {busy === 'generate' && (
                  <div className="magic-generating-overlay absolute inset-0 z-30 flex items-center justify-center overflow-hidden bg-brand-navy/40 backdrop-blur-[2px]">
                    <div aria-hidden className="magic-generate-scan absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent blur-xl" />
                    <div className="relative flex max-w-xs flex-col items-center px-6 text-center text-white">
                      <span className="relative grid size-16 place-items-center rounded-2xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-md"><Palette className="size-7 text-accent-orange" /><span className="absolute -inset-2 -z-10 animate-ping rounded-3xl border border-accent-orange/30" /></span>
                      <div className="mt-6 h-7 overflow-hidden"><div className="magic-generate-words"><p className="h-7 text-lg font-extrabold">Studying your photo…</p><p className="h-7 text-lg font-extrabold">Mixing the palette…</p><p className="h-7 text-lg font-extrabold">Painting every detail…</p><p className="h-7 text-lg font-extrabold">Adding the final touch…</p></div></div>
                      <p className="mt-2 text-xs leading-5 text-white/60">Creating your {selectedStyle.name.toLowerCase()} artwork</p>
                      <span className="mt-6 h-1 w-52 overflow-hidden rounded-full bg-white/15"><span className="magic-generate-progress block h-full w-2/5 rounded-full bg-accent-orange shadow-[0_0_12px_rgba(245,136,63,0.8)]" /></span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="border-l border-black/5 bg-white p-6 shadow-[-20px_0_50px_rgba(35,48,107,0.04)] sm:p-8">
            {resultUrl ? (
              <div className="flex h-full flex-col">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent-orange">Artwork complete</p>
                <div className="mt-6 grid size-14 place-items-center rounded-2xl bg-accent-orange text-white shadow-lg shadow-accent-orange/20"><Check className="size-7" strokeWidth={3} /></div>
                <h2 className="mt-6 text-3xl font-extrabold tracking-tight">A whole new medium.</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">Your {selectedStyle.name.toLowerCase()} transformation is ready. Compare it on the canvas or try another style.</p>
                <div className={`mt-7 rounded-2xl bg-gradient-to-br ${selectedStyle.colors} p-[1px]`}><div className="rounded-[15px] bg-white/90 p-4"><p className="text-xs font-extrabold">{selectedStyle.name}</p><p className="mt-1 text-[11px] text-muted-foreground">{intensity.charAt(0).toUpperCase() + intensity.slice(1)} strength · High-fidelity source</p></div></div>
                <a href={resultUrl} download={`photo-finale-${style}.png`} className="mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-brand-navy px-5 py-4 text-sm font-bold text-white shadow-lg shadow-brand-navy/20 transition-all hover:-translate-y-0.5 hover:bg-accent-orange"><Download className="size-4" /> Download artwork</a>
                <button type="button" onClick={() => setResultUrl(null)} className="mt-3 inline-flex items-center justify-center gap-2 rounded-full border border-brand-navy/10 px-5 py-3.5 text-sm font-bold transition-colors hover:border-accent-orange hover:text-accent-orange"><RefreshCw className="size-4" /> Try another style</button>
              </div>
            ) : (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent-orange">Art Style</p>
                <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Pick your medium.</h2>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">Each look is carefully prompted to preserve the identity and composition of your photo.</p>

                <div className="mt-7 grid grid-cols-2 gap-3">
                  {STYLES.map((item) => (
                    <button key={item.id} type="button" onClick={() => setStyle(item.id)} className={`group overflow-hidden rounded-2xl border-2 text-left transition-all ${style === item.id ? 'border-accent-orange shadow-lg shadow-accent-orange/10' : 'border-transparent bg-[#f2f3f6] hover:border-accent-orange/35'}`}>
                      <span className={`relative block aspect-[1.45] overflow-hidden bg-gradient-to-br ${item.colors}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={image.url} alt="" className={`size-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-105 ${item.filter}`} />
                        <span className={`absolute inset-0 bg-gradient-to-br ${item.colors} opacity-20 mix-blend-color`} />
                        {style === item.id && <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-accent-orange text-white shadow"><Check className="size-3.5" strokeWidth={3} /></span>}
                      </span>
                      <span className="block bg-white px-3 py-2.5"><span className="block text-[11px] font-extrabold">{item.name}</span><span className="mt-0.5 block truncate text-[9px] text-muted-foreground">{item.detail}</span></span>
                    </button>
                  ))}
                </div>

                <div className="mt-7">
                  <div className="flex items-center justify-between"><label className="text-xs font-extrabold">Style strength</label><span className="text-[10px] font-medium text-muted-foreground">How painterly?</span></div>
                  <div className="mt-3 grid grid-cols-3 rounded-full bg-[#f1f2f5] p-1">
                    {INTENSITIES.map((item) => <button key={item.id} type="button" onClick={() => setIntensity(item.id)} className={`rounded-full px-2 py-2 text-[10px] font-bold transition-all ${intensity === item.id ? 'bg-white text-accent-orange shadow-sm' : 'text-muted-foreground hover:text-brand-navy'}`}>{item.name}</button>)}
                  </div>
                </div>

                <button type="button" disabled={!!busy} onClick={() => void generate()} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent-orange px-5 py-4 text-sm font-bold text-white shadow-lg shadow-accent-orange/25 transition-all hover:-translate-y-0.5 hover:bg-[#e6752c] disabled:translate-y-0 disabled:opacity-50">
                  {busy === 'generate' ? <><LoaderCircle className="size-4 animate-spin" /> Creating artwork…</> : <><WandSparkles className="size-4" /> Create {selectedStyle.name}<ArrowRight className="size-4" /></>}
                </button>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] font-medium text-brand-green-dark"><Sparkles className="size-3" /> Source details and identity are preserved</p>
              </div>
            )}
          </aside>
        </main>
      )}

      {busy === 'upload' && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-brand-navy/85 backdrop-blur-xl"><div className="magic-upload-pop flex flex-col items-center text-center"><span className="relative grid size-20 place-items-center rounded-[1.6rem] bg-white text-accent-orange shadow-2xl"><ImagePlus className="size-8" /><span className="absolute -inset-3 -z-10 animate-ping rounded-[2rem] border border-brand-green/40" /></span><p className="mt-7 text-xl font-extrabold text-white">Preparing your studio</p><p className="mt-2 text-sm text-white/55">Optimizing your photo for a beautiful transformation…</p><span className="mt-6 h-1 w-48 overflow-hidden rounded-full bg-white/10"><span className="magic-progress block h-full rounded-full bg-accent-orange" /></span></div></div>
      )}
    </div>
  )
}
