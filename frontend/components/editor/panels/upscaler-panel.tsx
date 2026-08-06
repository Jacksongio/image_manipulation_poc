'use client'

import { useEffect, useState } from 'react'
import { type BackendHealth, fetchHealth, upscale } from '@/lib/editor/ai'
import { fetchUpscalePlans, type UpscalePlan } from '@/lib/editor/tools-api'
import { cn } from '@/lib/utils'
import { PanelButton, PanelHint, PanelShell, SegmentedControl } from '../ui/panel'
import { SliderRow } from '../ui/slider-row'
import type { Editor } from '../use-editor'
import { useAiRun } from './use-ai-run'

export function UpscalerPanel({
  editor,
  scale,
  setScale,
  strength,
  setStrength,
}: {
  editor: Editor
  scale: number
  setScale: (value: number) => void
  strength: number
  setStrength: (value: number) => void
}) {
  const run = useAiRun(editor)
  const [health, setHealth] = useState<BackendHealth | null>(null)
  const [plans, setPlans] = useState<UpscalePlan[]>([])

  useEffect(() => {
    let active = true
    void fetchHealth().then((value) => {
      if (active) setHealth(value)
    })
    return () => {
      active = false
    }
  }, [])

  // The backend decides the output size, so the readout asks rather than guesses.
  const { width, height } = editor.render.crop
  useEffect(() => {
    let active = true
    fetchUpscalePlans(width, height)
      .then((value) => {
        if (active) setPlans(value)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [width, height])

  const target = plans.find((plan) => plan.mode === 'faithful' && plan.scale === scale)
  const localReady = health?.cuda && health.upscalerInstalled
  const size = target ? `${target.width} × ${target.height}` : '…'

  return (
    <PanelShell title="Upscaler">
      <div className="mb-3 flex items-center gap-1.5">
        <span className={cn('size-1.5 rounded-full', localReady ? 'bg-[#39c46e]' : 'bg-[#f5883f]')} />
        <span className="text-[9px] text-ed-dim">
          {localReady ? health?.gpu ?? 'Local GPU ready' : 'Local upscaler unavailable'}
        </span>
      </div>

      <SliderRow
        label="Restoration Strength"
        min={25}
        max={100}
        step={5}
        value={Math.round(strength * 100)}
        onChange={(value) => setStrength(value / 100)}
      />

      <SegmentedControl
        label="Scale"
        value={String(scale)}
        options={editor.catalog.ai.upscaleScales.map((value) => ({
          id: String(value),
          name: `${value}×`,
        }))}
        onChange={(value) => setScale(Number(value))}
      />

      <div className="rounded-[3px] border border-ed-line px-2 py-1.5">
        <span className="block text-[9px] uppercase tracking-[0.1em] text-ed-dim">Output</span>
        <span className="mt-0.5 block text-[11px] tabular-nums text-ed-text">{size}</span>
      </div>

      {target && target.actualScale < scale - 0.1 ? (
        <p className="mt-2 rounded-[3px] bg-[#f5883f]/10 px-2 py-1.5 text-[9px] leading-4 text-[#f0a86a]">
          Capped at the highest supported resolution for this aspect ratio.
        </p>
      ) : null}

      <div className="mt-3">
        <PanelButton
          tone="accent"
          disabled={Boolean(editor.busy) || !localReady}
          onClick={() =>
            run('Upscaling image…', async (flattened) => {
              const result = await upscale({
                image: flattened,
                name: editor.doc.source.name,
                scale,
                strength,
              })
              return result.blob
            })
          }
        >
          Upscale to {size}
        </PanelButton>
      </div>

      <PanelHint>
        Real-ESRGAN runs locally on the GPU with no creative restyling.
      </PanelHint>
    </PanelShell>
  )
}
