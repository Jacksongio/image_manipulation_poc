'use client'

import { FieldLabel, PanelButton, PanelShell } from '../ui/panel'
import { SwatchRow } from '../ui/swatches'
import { Tile, TileGrid } from '../ui/tile-grid'
import type { Editor } from '../use-editor'
import { useTextDesignPreviews } from './use-thumbnails'

export function TextDesignPanel({ editor }: { editor: Editor }) {
  const selected = editor.selectedDesign
  const templates = editor.catalog.textDesigns
  const previews = useTextDesignPreviews('#ffffff')

  const color = selected?.color ?? editor.designColor

  return (
    <PanelShell title="Text Design">
      <PanelButton onClick={() => editor.addTextDesign(selected?.template ?? templates[0].id)}>
        New text design
      </PanelButton>
      <div className="mt-1.5">
        <PanelButton disabled={!selected} onClick={() => selected && editor.shuffleDesign(selected.id)}>
          Shuffle layout
        </PanelButton>
      </div>

      <div className="mt-3">
        <SwatchRow
          label="Text Color"
          value={color}
          onChange={(value) => {
            editor.setDesignColor(value)
            if (selected) editor.patchLayer(selected.id, { color: value })
          }}
        />
      </div>

      {selected ? (
        <div className="mb-3">
          <FieldLabel>Lines</FieldLabel>
          <textarea
            aria-label="Text design lines"
            rows={3}
            value={selected.lines.join('\n')}
            onFocus={editor.checkpoint}
            onChange={(event) =>
              editor.patchLayer(selected.id, { lines: event.target.value.split('\n') }, { checkpoint: false })
            }
            className="ed-scroll mt-1 w-full resize-none rounded-[3px] border border-ed-line bg-[#1b1b1b] px-1.5 py-1.5 text-[10px] leading-4 text-ed-text outline-none focus:border-ed-accent"
          />
        </div>
      ) : null}

      <TileGrid>
        {templates.map((template) => (
          <Tile
            key={template.id}
            label={template.label}
            selected={selected?.template === template.id}
            onClick={() => {
              if (selected) editor.patchLayer(selected.id, { template: template.id, variant: 0 })
              else editor.addTextDesign(template.id)
            }}
          >
            {previews[template.id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previews[template.id]}
                alt={template.label}
                className="size-full bg-[#1f1f1f] object-contain"
              />
            ) : (
              <span className="block size-full bg-ed-tile" />
            )}
          </Tile>
        ))}
      </TileGrid>
    </PanelShell>
  )
}
