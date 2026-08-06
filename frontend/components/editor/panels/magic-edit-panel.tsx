'use client'

import { useEffect, useRef } from 'react'
import { magicEdit, type Operation, segment } from '@/lib/editor/ai'
import { messageFromError } from '@/lib/editor/image'
import { cn } from '@/lib/utils'
import { FieldLabel, PanelButton, PanelHint, PanelSection, PanelShell, SegmentedControl } from '../ui/panel'
import type { Editor } from '../use-editor'
import { useAiRun } from './use-ai-run'

export function MagicEditPanel({
  editor,
  operation,
  setOperation,
  instruction,
  setInstruction,
}: {
  editor: Editor
  operation: Operation
  setOperation: (value: Operation) => void
  instruction: string
  setInstruction: (value: string) => void
}) {
  const run = useAiRun(editor)
  const { magic, setMagic } = editor
  const pointsKey = JSON.stringify(magic.points)
  const lastRequest = useRef<string>('')

  // Each new point re-runs SAM 3 against the flattened frame.
  useEffect(() => {
    if (!magic.points.length) {
      setMagic((current) => ({ ...current, candidates: [], index: 0 }))
      return
    }
    if (lastRequest.current === pointsKey) return
    lastRequest.current = pointsKey

    let active = true
    const controller = new AbortController()
    editor.setBusy('Finding the object…')
    void editor
      .flatten()
      .then((flattened) => segment(flattened, editor.doc.source.name, magic.points, controller.signal))
      .then((candidates) => {
        if (active) setMagic((current) => ({ ...current, candidates, index: 0 }))
      })
      .catch((error: unknown) => {
        if (active && (error as Error)?.name !== 'AbortError') editor.setError(messageFromError(error))
      })
      .finally(() => {
        if (active) editor.setBusy(null)
      })

    return () => {
      active = false
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey])

  const candidate = magic.candidates[magic.index] ?? null
  const needsInstruction = operation !== 'remove'
  const ready = Boolean(candidate) && (!needsInstruction || instruction.trim().length > 0)

  // The backend hardens the mask and builds the subject reference from it.
  const apply = () =>
    run('Applying magic edit…', async (flattened) => {
      if (!candidate) throw new Error('Select an object on the canvas first')
      return magicEdit({
        image: flattened,
        name: editor.doc.source.name,
        maskUrl: `data:image/png;base64,${candidate.mask}`,
        operation,
        instruction: instruction.trim(),
      })
    })

  return (
    <PanelShell title="Magic Edit">
      <PanelSection title="1 · Select">
        <SegmentedControl
          value={magic.include ? 'include' : 'exclude'}
          options={[
            { id: 'include', name: 'Include' },
            { id: 'exclude', name: 'Exclude' },
          ]}
          onChange={(value) => setMagic((current) => ({ ...current, include: value === 'include' }))}
        />
        <PanelHint>
          Click the object on the canvas. Hold Alt or Shift while clicking to subtract an area.
        </PanelHint>
        {magic.candidates.length > 1 ? (
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {magic.candidates.map((entry, index) => (
              <button
                key={entry.score}
                type="button"
                onClick={() => setMagic((current) => ({ ...current, index }))}
                className={cn(
                  'overflow-hidden rounded-[3px] border bg-[#151515]',
                  index === magic.index ? 'border-ed-accent' : 'border-transparent hover:border-ed-line',
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`data:image/png;base64,${entry.mask}`} alt={`Option ${index + 1}`} className="aspect-square w-full object-contain" />
              </button>
            ))}
          </div>
        ) : null}
        <div className="mt-2">
          <PanelButton disabled={!magic.points.length} onClick={editor.resetMagic}>
            Clear selection
          </PanelButton>
        </div>
      </PanelSection>

      <PanelSection title="2 · Operation">
        <SegmentedControl
          value={operation}
          options={editor.catalog.ai.magicEditOperations.map((entry) => ({
            id: entry.id,
            name: entry.label,
          }))}
          onChange={(value) => setOperation(value as Operation)}
        />
      </PanelSection>

      <PanelSection title="3 · Instruction">
        <FieldLabel>{operation === 'remove' ? 'Optional detail' : 'Describe the result'}</FieldLabel>
        <textarea
          aria-label="Magic edit instruction"
          rows={3}
          value={instruction}
          placeholder={
            operation === 'replace' ? 'a vintage red bicycle' : operation === 'retouch' ? 'change the jacket to navy' : 'rebuild the background'
          }
          onChange={(event) => setInstruction(event.target.value)}
          className="ed-scroll mt-1 w-full resize-none rounded-[3px] border border-ed-line bg-[#1b1b1b] px-1.5 py-1.5 text-[10px] leading-4 text-ed-text outline-none placeholder:text-[#5f5f5f] focus:border-ed-accent"
        />
        <div className="mt-2">
          <PanelButton tone="accent" disabled={!ready || Boolean(editor.busy)} onClick={apply}>
            Apply magic edit
          </PanelButton>
        </div>
      </PanelSection>
    </PanelShell>
  )
}
