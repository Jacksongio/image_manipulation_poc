'use client'

import { PanelButton, PanelSection, PanelShell, ToggleSwitch } from '../ui/panel'
import { Tile, TileGrid } from '../ui/tile-grid'
import type { Editor } from '../use-editor'

export function TransformPanel({ editor }: { editor: Editor }) {
  const { doc, fullFrame, render } = editor
  const crop = doc.crop ?? render.crop

  const setSize = (width: number, height: number) => {
    const nextWidth = Math.max(24, Math.min(Math.round(width), fullFrame.width))
    const nextHeight = Math.max(24, Math.min(Math.round(height), fullFrame.height))
    editor.setCrop({
      x: Math.max(0, Math.min(crop.x, fullFrame.width - nextWidth)),
      y: Math.max(0, Math.min(crop.y, fullFrame.height - nextHeight)),
      width: nextWidth,
      height: nextHeight,
    })
  }

  return (
    <PanelShell title="Transform">
      <PanelButton onClick={editor.resetTransform}>Reset to default</PanelButton>

      <div className="mt-3">
        <ToggleSwitch
          label="Keep Resolution"
          checked={doc.keepResolution}
          onChange={(value) => editor.update((current) => ({ ...current, keepResolution: value }))}
        />
      </div>

      <div className="mt-2">
        <span className="block text-[10px] font-medium text-ed-text">Crop Size</span>
        <div className="mt-1.5 flex items-center gap-1.5">
          <input
            type="number"
            aria-label="Crop width"
            value={Math.round(crop.width)}
            onChange={(event) => {
              const width = Number(event.target.value)
              if (!Number.isFinite(width)) return
              setSize(width, editor.cropRatio ? width / editor.cropRatio : crop.height)
            }}
            className="w-full min-w-0 rounded-[3px] border border-ed-line bg-[#1b1b1b] px-1.5 py-1 text-[10px] tabular-nums text-ed-text outline-none focus:border-ed-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-[9px] font-semibold text-ed-dim">W</span>
          <span className="text-[9px] text-ed-dim">×</span>
          <input
            type="number"
            aria-label="Crop height"
            value={Math.round(crop.height)}
            onChange={(event) => {
              const height = Number(event.target.value)
              if (!Number.isFinite(height)) return
              setSize(editor.cropRatio ? height * editor.cropRatio : crop.width, height)
            }}
            className="w-full min-w-0 rounded-[3px] border border-ed-line bg-[#1b1b1b] px-1.5 py-1 text-[10px] tabular-nums text-ed-text outline-none focus:border-ed-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-[9px] font-semibold text-ed-dim">H</span>
        </div>
      </div>

      <div className="mt-4">
        <PanelSection title="Common">
          <TileGrid>
            {editor.catalog.transform.aspectPresets.map((preset) => {
              const ratio = preset.ratio ?? 1.28
              const width = ratio >= 1 ? 30 : 30 * ratio
              const height = ratio >= 1 ? 30 / ratio : 30
              return (
                <Tile
                  key={preset.id}
                  label={preset.label}
                  labelPlacement="below"
                  selected={editor.aspect === preset.id}
                  onClick={() => editor.applyAspect(preset.id)}
                >
                  <span
                    className="block rounded-[1px] bg-[#8f8f8f]"
                    style={{ width, height, opacity: preset.ratio === null ? 0.55 : 1 }}
                  />
                </Tile>
              )
            })}
          </TileGrid>
        </PanelSection>
      </div>
    </PanelShell>
  )
}
