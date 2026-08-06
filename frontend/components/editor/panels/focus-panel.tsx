'use client'

import type { Focus } from '@/lib/editor/doc'
import { PanelButton, PanelShell } from '../ui/panel'
import { SliderRow } from '../ui/slider-row'
import { Tile, TileGrid } from '../ui/tile-grid'
import type { Editor } from '../use-editor'
import { useToolThumbnails } from './use-thumbnails'

export function FocusPanel({ editor }: { editor: Editor }) {
  const { doc, catalog, fullFrame } = editor
  const thumbnails = useToolThumbnails(doc.source, 'focus')

  /** Mirrors the backend's default_focus so a new selection lands sensibly. */
  const startingFocus = (type: Focus['type']): Focus => ({
    type,
    intensity: 15,
    x: fullFrame.width / 2,
    y: fullFrame.height / 2,
    radius: Math.max(1, Math.min(fullFrame.width, fullFrame.height) * (type === 'gaussian' ? 0.42 : 0.3)),
    angle: 0,
  })

  return (
    <PanelShell title="Focus">
      <PanelButton disabled={!doc.focus} onClick={() => editor.setFocus(null)}>
        Remove focus
      </PanelButton>

      <div className="mt-3">
        <SliderRow
          label="Focus Intensity"
          min={0}
          max={100}
          value={doc.focus?.intensity ?? 15}
          disabled={!doc.focus}
          onCommitStart={editor.checkpoint}
          onChange={(intensity) =>
            doc.focus && editor.setFocus({ ...doc.focus, intensity }, { checkpoint: false })
          }
        />
      </div>

      <TileGrid>
        {catalog.focus.types.map((type) => (
          <Tile
            key={type.id}
            label={type.label}
            span
            aspect="3 / 1"
            selected={doc.focus?.type === type.id}
            onClick={() => {
              const focusType = type.id as Focus['type']
              editor.setFocus(
                doc.focus ? { ...doc.focus, type: focusType } : startingFocus(focusType),
              )
            }}
          >
            {thumbnails[type.id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbnails[type.id]} alt="" className="size-full object-cover" />
            ) : (
              <span className="block size-full bg-ed-tile" />
            )}
          </Tile>
        ))}
      </TileGrid>

      <p className="mt-3 text-[10px] leading-4 text-ed-dim">
        Drag the centre dot to move the focus and the outer dot to resize or rotate it.
      </p>
    </PanelShell>
  )
}
