'use client'

import { artStyle } from '@/lib/editor/ai'
import { PanelButton, PanelHint, PanelShell, SegmentedControl } from '../ui/panel'
import { Tile, TileGrid } from '../ui/tile-grid'
import type { Editor } from '../use-editor'
import { useAiRun } from './use-ai-run'

export function ArtStylePanel({
  editor,
  style,
  setStyle,
  intensity,
  setIntensity,
}: {
  editor: Editor
  style: string
  setStyle: (value: string) => void
  intensity: string
  setIntensity: (value: string) => void
}) {
  const run = useAiRun(editor)
  const { artStyles, styleIntensities } = editor.catalog.ai
  const active = artStyles.find((entry) => entry.id === style)

  return (
    <PanelShell title="Art Style">
      <TileGrid>
        {artStyles.map((entry) => (
          <Tile
            key={entry.id}
            label={entry.label}
            selected={style === entry.id}
            onClick={() => setStyle(entry.id)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={editor.doc.source.url}
              alt=""
              className="size-full object-cover"
              style={{ filter: entry.previewFilter }}
            />
          </Tile>
        ))}
      </TileGrid>

      <div className="mt-3">
        <SegmentedControl
          label="Intensity"
          value={intensity}
          options={styleIntensities.map((entry) => ({ id: entry.id, name: entry.label }))}
          onChange={setIntensity}
        />
      </div>

      <PanelButton
        tone="accent"
        disabled={Boolean(editor.busy)}
        onClick={() =>
          run(`Painting in ${active?.label ?? 'style'}…`, (flattened) =>
            artStyle(flattened, editor.doc.source.name, style, intensity),
          )
        }
      >
        Create {active?.label ?? 'artwork'}
      </PanelButton>

      <PanelHint>{active?.detail} — people, details, and composition are preserved.</PanelHint>
    </PanelShell>
  )
}
