'use client'

import { PanelButton, PanelShell } from '../ui/panel'
import { SliderRow } from '../ui/slider-row'
import { SwatchRow } from '../ui/swatches'
import type { Editor } from '../use-editor'

export function BrushPanel({ editor }: { editor: Editor }) {
  const { brush } = editor
  const strokes = editor.doc.layers.filter((layer) => layer.kind === 'stroke')

  return (
    <PanelShell title="Brush">
      <SliderRow
        label="Brush Hardness"
        min={0}
        max={100}
        value={brush.hardness}
        onChange={(hardness) => editor.setBrush((current) => ({ ...current, hardness }))}
      />
      <SliderRow
        label="Brush Size"
        min={1}
        max={200}
        value={brush.size}
        onChange={(size) => editor.setBrush((current) => ({ ...current, size }))}
      />
      <SwatchRow label="Brush Color" value={brush.color} onChange={(color) => editor.setBrush((current) => ({ ...current, color }))} />

      <PanelButton
        disabled={!strokes.length}
        onClick={() =>
          editor.update((current) => ({ ...current, layers: current.layers.filter((layer) => layer.kind !== 'stroke') }))
        }
      >
        Clear strokes
      </PanelButton>

      <p className="mt-3 text-[10px] leading-4 text-ed-dim">
        Drag on the canvas to paint. Each stroke is its own step, so Undo removes them one at a time.
      </p>
    </PanelShell>
  )
}
