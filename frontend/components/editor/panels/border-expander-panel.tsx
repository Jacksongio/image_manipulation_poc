'use client'

import { useEffect } from 'react'
import { borderExpand, type Orientation } from '@/lib/editor/ai'
import { PanelButton, PanelHint, PanelShell, SegmentedControl } from '../ui/panel'
import { Tile, TileGrid } from '../ui/tile-grid'
import type { Editor } from '../use-editor'
import { useAiRun } from './use-ai-run'

export function BorderExpanderPanel({
  editor,
  printSize,
  setPrintSize,
  orientation,
  setOrientation,
  model,
  setModel,
  models,
}: {
  editor: Editor
  printSize: string
  setPrintSize: (value: string) => void
  orientation: Orientation
  setOrientation: (value: Orientation) => void
  model: string
  setModel: (value: string) => void
  models: Array<{ id: string; label: string; detail: string }>
}) {
  const run = useAiRun(editor)
  const { setBorderExpansionPreview } = editor
  const sizes = editor.catalog.ai.printSizes
  const rect = editor.render.crop
  const selected = sizes.find((entry) => entry.id === printSize) ?? sizes[0]
  const target = selected[orientation]

  // Default to whichever orientation matches the frame the user is looking at.
  const isLandscape = rect.width >= rect.height
  useEffect(() => {
    setOrientation(isLandscape ? 'landscape' : 'portrait')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLandscape])

  // The stage uses this ratio to place the complete source on the proposed
  // print canvas and visibly mark the pixels that Border Expander will create.
  useEffect(() => {
    setBorderExpansionPreview({ targetAspectRatio: target.width / target.height })
    return () => setBorderExpansionPreview(null)
  }, [setBorderExpansionPreview, target.height, target.width])

  return (
    <PanelShell title="Border Expander">
      <TileGrid>
        {sizes.map((entry) => {
          const size = entry[orientation]
          const ratio = size.width / size.height
          return (
            <Tile
              key={entry.id}
              label={entry.label}
              labelPlacement="below"
              selected={printSize === entry.id}
              onClick={() => setPrintSize(entry.id)}
            >
              <span
                className="block rounded-[1px] bg-[#8f8f8f]"
                style={{ width: ratio >= 1 ? 34 : 34 * ratio, height: ratio >= 1 ? 34 / ratio : 34 }}
              />
            </Tile>
          )
        })}
      </TileGrid>

      <div className="mt-3">
        <SegmentedControl
          label="Orientation"
          value={orientation}
          options={[
            { id: 'portrait' as Orientation, name: 'Portrait' },
            { id: 'landscape' as Orientation, name: 'Landscape' },
          ]}
          onChange={setOrientation}
        />
      </div>

      <SegmentedControl
        label="Model"
        value={model}
        options={models.map((entry) => ({ id: entry.id, name: entry.label }))}
        onChange={setModel}
      />

      <div className="rounded-[3px] border border-ed-line px-2 py-1.5">
        <span className="block text-[9px] uppercase tracking-[0.1em] text-ed-dim">Print output</span>
        <span className="mt-0.5 block text-[11px] tabular-nums text-ed-text">
          {target.width} × {target.height} px · 300 DPI
        </span>
      </div>

      <div className="mt-3">
        {/* The endpoint returns the exact print size, already fitted. */}
        <PanelButton
          tone="accent"
          disabled={Boolean(editor.busy)}
          onClick={() =>
            run('Expanding borders…', (flattened) =>
              borderExpand(flattened, editor.doc.source.name, selected.id, orientation, model),
            )
          }
        >
          Expand to {selected.label}
        </PanelButton>
      </div>

      <PanelHint>
        AI paints new scenery outward so the photo fills the print without cropping the subject.
      </PanelHint>
    </PanelShell>
  )
}
