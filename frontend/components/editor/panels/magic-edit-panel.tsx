'use client'

import { useEffect, useRef } from 'react'
import { magicEdit, type Operation, segment } from '@/lib/editor/ai'
import { messageFromError } from '@/lib/editor/image'
import { cn } from '@/lib/utils'
import { FieldLabel, PanelButton, PanelHint, PanelSection, PanelShell, SegmentedControl } from '../ui/panel'
import type { Editor } from '../use-editor'

const SEGMENT_TIMEOUT_MS = 45_000

export function MagicEditPanel({
  editor,
  operation,
  setOperation,
  instruction,
  setInstruction,
  model,
  setModel,
  models,
}: {
  editor: Editor
  operation: Operation
  setOperation: (value: Operation) => void
  instruction: string
  setInstruction: (value: string) => void
  model: string
  setModel: (value: string) => void
  models: Array<{ id: string; label: string; detail: string }>
}) {
  const { magic, setMagic } = editor
  const requestKey = `${editor.doc.source.url}:${JSON.stringify(magic.points)}`
  const lastRequest = useRef<string>('')

  // Each new point re-runs SAM 3 against the flattened frame.
  useEffect(() => {
    if (!magic.points.length) {
      lastRequest.current = ''
      setMagic((current) => ({ ...current, candidates: [], index: 0 }))
      editor.setBusy((current) => (current === 'Finding the object…' ? null : current))
      return
    }
    if (lastRequest.current === requestKey) return
    lastRequest.current = requestKey

    let active = true
    let timedOut = false
    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, SEGMENT_TIMEOUT_MS)
    editor.setBusy('Finding the object…')
    void editor
      .flatten()
      .then((flattened) => segment(flattened, editor.doc.source.name, magic.points, controller.signal))
      .then((candidates) => {
        if (active) setMagic((current) => ({ ...current, candidates, index: 0 }))
      })
      .catch((error: unknown) => {
        if (!active) return
        if (timedOut) {
          editor.setError('SAM 3 took too long to respond. Move the pointer away and try again.')
        } else if ((error as Error)?.name !== 'AbortError') {
          editor.setError(messageFromError(error))
        }
      })
      .finally(() => {
        window.clearTimeout(timeout)
        if (active) editor.setBusy(null)
      })

    return () => {
      active = false
      window.clearTimeout(timeout)
      controller.abort()
      editor.setBusy((current) => (current === 'Finding the object…' ? null : current))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey])

  const candidate = magic.candidates[magic.index] ?? null
  const needsInstruction = operation !== 'remove'
  const ready = Boolean(candidate) && (!needsInstruction || instruction.trim().length > 0)

  // The backend hardens the mask and builds the subject reference from it.
  const apply = async () => {
    if (!candidate || editor.busy) return
    editor.setBusy('Applying magic edit…')
    editor.setError(null)
    try {
      const flattened = await editor.flatten()
      const result = await magicEdit({
        image: flattened,
        name: editor.doc.source.name,
        maskUrl: `data:image/png;base64,${candidate.mask}`,
        operation,
        instruction: instruction.trim(),
        model,
      })
      editor.setMagicPreview({
        beforeUrl: URL.createObjectURL(flattened),
        afterUrl: URL.createObjectURL(result),
        afterBlob: result,
      })
    } catch (error) {
      editor.setError(messageFromError(error))
    } finally {
      editor.setBusy(null)
    }
  }

  return (
    <PanelShell title="Magic Edit">
      <PanelSection title="1 · Select">
        <PanelHint>
          {magic.locked
            ? 'Selection locked. Click another part of the subject to grow the mask, or click a marker to remove that point.'
            : 'Hover over an object to preview its selection. Pause briefly for SAM 3 to outline it, then click to lock it.'}
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

      <PanelSection title="2 · Model">
        <SegmentedControl
          value={model}
          options={models.map((entry) => ({
            id: entry.id,
            name: entry.label,
          }))}
          onChange={setModel}
        />
        <PanelHint>{models.find((entry) => entry.id === model)?.detail}</PanelHint>
      </PanelSection>

      <PanelSection title="3 · Operation">
        <SegmentedControl
          value={operation}
          options={editor.catalog.ai.magicEditOperations.map((entry) => ({
            id: entry.id,
            name: entry.label,
          }))}
          onChange={(value) => setOperation(value as Operation)}
        />
      </PanelSection>

      <PanelSection title="4 · Instruction">
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
          <PanelButton tone="accent" disabled={!ready || Boolean(editor.busy) || Boolean(editor.magicPreview)} onClick={apply}>
            Apply magic edit
          </PanelButton>
        </div>
      </PanelSection>
    </PanelShell>
  )
}
