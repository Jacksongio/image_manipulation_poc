'use client'

import { FlipHorizontal2, FlipVertical2, RotateCcw, RotateCw } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { Editor } from './use-editor'

function BarButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="grid size-6 place-items-center rounded-[3px] text-ed-dim transition-colors hover:bg-white/[0.08] hover:text-ed-text"
    >
      {children}
    </button>
  )
}

export function TransformBar({ editor }: { editor: Editor }) {
  const { doc } = editor
  const fill = ((doc.rotation + 45) / 90) * 100

  return (
    <footer className="flex h-10 shrink-0 items-center justify-center gap-3 border-t border-ed-line bg-ed-topbar px-4">
      <BarButton label="Flip horizontally" onClick={() => editor.update((current) => ({ ...current, flipX: !current.flipX }))}>
        <FlipHorizontal2 className="size-3.5" />
      </BarButton>
      <BarButton label="Flip vertically" onClick={() => editor.update((current) => ({ ...current, flipY: !current.flipY }))}>
        <FlipVertical2 className="size-3.5" />
      </BarButton>

      <div className="flex items-center gap-2">
        <input
          type="range"
          aria-label="Rotation"
          className="ed-range w-40"
          style={{ '--ed-fill': `${fill}%` } as CSSProperties}
          min={-45}
          max={45}
          step={0.5}
          value={doc.rotation}
          onPointerDown={editor.checkpoint}
          onChange={(event) =>
            editor.update((current) => ({ ...current, rotation: Number(event.target.value), crop: null }), {
              checkpoint: false,
            })
          }
        />
        <button
          type="button"
          onClick={() => editor.update((current) => ({ ...current, rotation: 0 }))}
          title="Reset rotation"
          className="min-w-9 text-center text-[11px] tabular-nums text-ed-text transition-colors hover:text-white"
        >
          {doc.rotation.toFixed(0)}°
        </button>
      </div>

      <BarButton
        label="Rotate left"
        onClick={() => editor.update((current) => ({ ...current, quarterTurns: (current.quarterTurns + 3) % 4, crop: null }))}
      >
        <RotateCcw className="size-3.5" />
      </BarButton>
      <BarButton
        label="Rotate right"
        onClick={() => editor.update((current) => ({ ...current, quarterTurns: (current.quarterTurns + 1) % 4, crop: null }))}
      >
        <RotateCw className="size-3.5" />
      </BarButton>
    </footer>
  )
}
