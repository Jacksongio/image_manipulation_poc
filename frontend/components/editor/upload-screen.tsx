'use client'

import { ImagePlus, LoaderCircle, TriangleAlert } from 'lucide-react'
import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export function UploadScreen({
  onFile,
  busy,
  error,
}: {
  onFile: (file: File) => void
  busy: boolean
  error: string | null
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  return (
    <main className="grid min-h-dvh place-items-center bg-ed-stage px-6 py-16">
      <div className="magic-upload-pop w-full max-w-lg text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-ed-text sm:text-3xl">Photo Editor</h1>
        <p className="mx-auto mt-2 max-w-sm text-pretty text-sm leading-6 text-ed-dim">
          Drop in a photo to crop, grade, letter, and retouch it with AI — all on one canvas.
        </p>

        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            const file = event.dataTransfer.files?.[0]
            if (file) onFile(file)
          }}
          className={cn(
            'group mt-8 grid w-full place-items-center rounded-xl border border-dashed px-6 py-14 transition-colors disabled:cursor-default',
            dragging ? 'border-ed-accent bg-ed-accent/[0.08]' : 'border-[#3d3d3d] bg-ed-panel/60 hover:enabled:border-ed-dim',
          )}
        >
          <span
            className={cn(
              'grid size-12 place-items-center rounded-full transition-colors',
              dragging ? 'bg-ed-accent text-white' : 'bg-ed-tile text-ed-dim group-hover:text-ed-text',
            )}
          >
            {busy ? <LoaderCircle className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
          </span>
          <span className="mt-4 text-sm font-medium text-ed-text">
            {busy ? 'Preparing your image…' : 'Drop an image or click to browse'}
          </span>
          <span className="mt-1 text-[11px] text-ed-dim">PNG, JPEG, or WebP · up to 20 MB</span>
        </button>

        {error ? (
          <p className="mt-4 inline-flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
            <TriangleAlert className="size-3.5 shrink-0" />
            {error}
          </p>
        ) : null}

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) onFile(file)
          }}
        />
      </div>
    </main>
  )
}
