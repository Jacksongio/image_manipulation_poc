'use client'

import { AlignCenter, AlignJustify, AlignLeft, AlignRight } from 'lucide-react'
import type { TextAlign } from '@/lib/editor/doc'
import { FieldLabel, IconAction, PanelButton, PanelShell } from '../ui/panel'
import { SliderRow } from '../ui/slider-row'
import { SwatchRow } from '../ui/swatches'
import type { Editor } from '../use-editor'

const ALIGNMENTS: Array<{ id: TextAlign; label: string; icon: typeof AlignLeft }> = [
  { id: 'left', label: 'Align left', icon: AlignLeft },
  { id: 'center', label: 'Align centre', icon: AlignCenter },
  { id: 'right', label: 'Align right', icon: AlignRight },
  { id: 'justify', label: 'Justify', icon: AlignJustify },
]

export function TextPanel({ editor }: { editor: Editor }) {
  const layer = editor.selectedText
  const settings = layer ?? editor.textSettings

  /** Edits the selected layer when there is one, otherwise the defaults for the next text. */
  const apply = (patch: Partial<typeof editor.textSettings>, options?: { checkpoint?: boolean }) => {
    editor.setTextSettings((current) => ({ ...current, ...patch }))
    if (layer) editor.patchLayer(layer.id, patch, options)
  }

  return (
    <PanelShell title="Text">
      <PanelButton onClick={editor.addText}>New text</PanelButton>

      <div className="mt-3">
        <FieldLabel>Font Family</FieldLabel>
        <select
          aria-label="Font family"
          value={settings.fontFamily}
          onChange={(event) => apply({ fontFamily: event.target.value })}
          className="mt-1 w-full rounded-[3px] border border-ed-line bg-[#1b1b1b] px-1.5 py-1.5 text-[10px] text-ed-text outline-none focus:border-ed-accent"
        >
          {editor.catalog.text.fontFamilies.map((font) => (
            <option key={font.id} value={font.id}>
              {font.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 flex gap-2">
        <div className="w-16 shrink-0">
          <FieldLabel>Font Size</FieldLabel>
          <input
            type="number"
            aria-label="Font size"
            min={6}
            max={800}
            value={Math.round(settings.fontSize)}
            onChange={(event) => {
              const value = Number(event.target.value)
              if (Number.isFinite(value)) apply({ fontSize: Math.max(6, value) })
            }}
            className="mt-1 w-full rounded-[3px] border border-ed-line bg-[#1b1b1b] px-1.5 py-1 text-[10px] tabular-nums text-ed-text outline-none focus:border-ed-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
        <div className="min-w-0 flex-1">
          <FieldLabel>Alignment</FieldLabel>
          <div className="mt-1 flex gap-0.5">
            {ALIGNMENTS.map((alignment) => {
              const Icon = alignment.icon
              return (
                <IconAction
                  key={alignment.id}
                  label={alignment.label}
                  active={settings.align === alignment.id}
                  onClick={() => apply({ align: alignment.id })}
                >
                  <Icon className="size-3" />
                </IconAction>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-3">
        <SwatchRow label="Font Color" value={settings.fill} onChange={(fill) => apply({ fill })} />
        <SwatchRow
          label="Background Color"
          value={settings.background}
          allowTransparent
          onChange={(background) => apply({ background })}
        />
        <SliderRow
          label="Line Spacing"
          min={0.6}
          max={2.5}
          step={0.1}
          value={settings.lineHeight}
          format={(value) => value.toFixed(1)}
          onCommitStart={editor.checkpoint}
          onChange={(lineHeight) => apply({ lineHeight }, { checkpoint: false })}
        />
      </div>

      {layer ? (
        <div className="mt-1">
          <FieldLabel>Content</FieldLabel>
          <textarea
            aria-label="Text content"
            rows={3}
            value={layer.text}
            onChange={(event) => editor.patchLayer(layer.id, { text: event.target.value }, { checkpoint: false })}
            onFocus={editor.checkpoint}
            className="ed-scroll mt-1 w-full resize-none rounded-[3px] border border-ed-line bg-[#1b1b1b] px-1.5 py-1.5 text-[10px] leading-4 text-ed-text outline-none focus:border-ed-accent"
          />
        </div>
      ) : (
        <p className="mt-2 text-[10px] leading-4 text-ed-dim">
          Add a text box, then drag it on the canvas. Select it to restyle or use its toolbar to duplicate and reorder.
        </p>
      )}
    </PanelShell>
  )
}
