'use client'

import { useState } from 'react'
import { PanelButton, PanelShell } from '../ui/panel'
import { SliderRow } from '../ui/slider-row'
import { Tile, TileGrid, VariantTileMenu } from '../ui/tile-grid'
import type { Editor } from '../use-editor'
import { useToolThumbnails } from './use-thumbnails'

export function FiltersPanel({ editor }: { editor: Editor }) {
  const { doc, catalog } = editor
  const thumbnails = useToolThumbnails(doc.source, 'filters')
  const [menuFor, setMenuFor] = useState<string | null>(null)

  const presets = catalog.filters
  const activePreset = presets.find((preset) =>
    preset.variants.some((variant) => variant.id === doc.filter.id),
  )

  const select = (id: string) =>
    editor.update((current) => ({ ...current, filter: { ...current.filter, id } }))

  return (
    <PanelShell title="Filters">
      <PanelButton
        disabled={!doc.filter.id}
        onClick={() =>
          editor.update((current) => ({ ...current, filter: { ...current.filter, id: null } }))
        }
      >
        Remove filter
      </PanelButton>

      <div className="mt-3">
        <SliderRow
          label="Filter Intensity"
          min={0}
          max={100}
          value={doc.filter.intensity}
          disabled={!doc.filter.id}
          onCommitStart={editor.checkpoint}
          onChange={(value) =>
            editor.update(
              (current) => ({ ...current, filter: { ...current.filter, intensity: value } }),
              { checkpoint: false },
            )
          }
        />
      </div>

      <TileGrid>
        {presets.map((preset) => {
          const isActive = activePreset?.id === preset.id
          const variant =
            (isActive ? preset.variants.find((entry) => entry.id === doc.filter.id) : null) ??
            preset.variants[0]
          const hasVariants = preset.variants.length > 1
          return (
            <Tile
              key={preset.id}
              label={preset.label}
              span={preset.spansFullWidth}
              selected={isActive}
              aspect={preset.spansFullWidth ? '3 / 1' : '1 / 1'}
              onClick={() =>
                hasVariants ? setMenuFor(menuFor === preset.id ? null : preset.id) : select(variant.id)
              }
              onCaretClick={
                hasVariants ? () => setMenuFor(menuFor === preset.id ? null : preset.id) : undefined
              }
              menu={
                menuFor === preset.id ? (
                  <VariantTileMenu
                    title={preset.label}
                    options={preset.variants.map((entry) => ({
                      id: entry.id,
                      name: entry.label,
                      thumbnail: thumbnails[entry.id],
                    }))}
                    value={variant.id}
                    onSelect={select}
                    onClose={() => setMenuFor(null)}
                  />
                ) : null
              }
            >
              {thumbnails[variant.id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbnails[variant.id]} alt="" className="size-full object-cover" />
              ) : (
                <span className="block size-full bg-ed-tile" />
              )}
            </Tile>
          )
        })}
      </TileGrid>
    </PanelShell>
  )
}
