'use client'

import { LoaderCircle, Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export function TopBar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  onSave,
  onClose,
  saving,
}: {
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomFit: () => void
  onSave: () => void
  onClose: () => void
  saving: boolean
}) {
  return (
    <header className="flex h-9 shrink-0 items-center justify-between border-b border-ed-line bg-ed-topbar px-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className={cn(
            'text-[11px] font-medium transition-colors',
            canUndo ? 'text-ed-text hover:text-white' : 'cursor-default text-[#5a5a5a]',
          )}
        >
          Undo
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className={cn(
            'text-[11px] font-medium transition-colors',
            canRedo ? 'text-ed-text hover:text-white' : 'cursor-default text-[#5a5a5a]',
          )}
        >
          Redo
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Zoom out"
          onClick={onZoomOut}
          className="grid size-5 place-items-center rounded-[3px] text-ed-dim transition-colors hover:bg-white/[0.07] hover:text-ed-text"
        >
          <Minus className="size-3" />
        </button>
        <button
          type="button"
          onClick={onZoomFit}
          title="Fit to screen"
          className="min-w-14 text-center text-[11px] tabular-nums text-ed-text transition-colors hover:text-white"
        >
          {(zoom * 100).toFixed(1)} %
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={onZoomIn}
          className="grid size-5 place-items-center rounded-[3px] text-ed-dim transition-colors hover:bg-white/[0.07] hover:text-ed-text"
        >
          <Plus className="size-3" />
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-[3px] bg-ed-accent px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white transition-all hover:enabled:brightness-110 disabled:opacity-60"
        >
          {saving ? <LoaderCircle className="size-3 animate-spin" /> : null}
          Save
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-[3px] bg-[#2f2f2f] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-ed-text transition-colors hover:bg-[#3a3a3a] hover:text-white"
        >
          Close
        </button>
      </div>
    </header>
  )
}
