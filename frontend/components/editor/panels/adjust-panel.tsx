'use client'

import type { AdjustKey } from '@/lib/editor/doc'
import { NEUTRAL_ADJUST } from '@/lib/editor/doc'
import { PanelButton, PanelSection, PanelShell } from '../ui/panel'
import { SliderRow } from '../ui/slider-row'
import type { Editor } from '../use-editor'

export function AdjustPanel({ editor }: { editor: Editor }) {
  const { doc, catalog } = editor
  const { groups, range } = catalog.adjust
  const dirty = Object.values(doc.adjust).some((value) => value !== 0)

  const set = (key: AdjustKey, value: number) =>
    editor.update(
      (current) => ({ ...current, adjust: { ...current.adjust, [key]: value } }),
      { checkpoint: false },
    )

  return (
    <PanelShell title="Adjust">
      {groups.map((group) => (
        <PanelSection key={group.id} title={group.label}>
          {group.sliders.map((slider) => (
            <SliderRow
              key={slider.id}
              label={slider.label}
              min={range.min}
              max={range.max}
              step={range.step}
              value={doc.adjust[slider.id as AdjustKey]}
              onCommitStart={editor.checkpoint}
              onChange={(value) => set(slider.id as AdjustKey, value)}
            />
          ))}
        </PanelSection>
      ))}
      <PanelButton
        disabled={!dirty}
        onClick={() => editor.update((current) => ({ ...current, adjust: { ...NEUTRAL_ADJUST } }))}
      >
        Reset adjustments
      </PanelButton>
    </PanelShell>
  )
}
