'use client'

import { useState } from 'react'
import type { Operation, Orientation } from '@/lib/editor/ai'
import { AdjustPanel } from './panels/adjust-panel'
import { ArtStylePanel } from './panels/art-style-panel'
import { BorderExpanderPanel } from './panels/border-expander-panel'
import { BrushPanel } from './panels/brush-panel'
import { FiltersPanel } from './panels/filters-panel'
import { FocusPanel } from './panels/focus-panel'
import { MagicEditPanel } from './panels/magic-edit-panel'
import { TextDesignPanel } from './panels/text-design-panel'
import { TextPanel } from './panels/text-panel'
import { TransformPanel } from './panels/transform-panel'
import { UpscalerPanel } from './panels/upscaler-panel'
import type { Editor } from './use-editor'

export function ToolPanel({ editor }: { editor: Editor }) {
  const { artStyles, styleIntensities, printSizes, upscaleScales } = editor.catalog.ai
  // An already-open editor can hold a catalog fetched before the backend was
  // restarted. Keep Magic Edit usable while that older payload is still around.
  const imageModels = editor.catalog.ai.imageModels ?? editor.catalog.ai.magicEditModels ?? [
    {
      id: 'gemini-3.1-flash-image',
      label: 'Current',
      detail: 'Configured model: gemini-3.1-flash-image',
    },
  ]

  // Kept here rather than inside each panel so switching tools does not lose the setup.
  const [operation, setOperation] = useState<Operation>('remove')
  const [instruction, setInstruction] = useState('')
  const [magicEditModel, setMagicEditModel] = useState(imageModels[0]?.id ?? 'gemini-3.1-flash-image')
  const [style, setStyle] = useState(artStyles[0]?.id ?? 'watercolor')
  const [styleIntensity, setStyleIntensity] = useState(styleIntensities[1]?.id ?? 'balanced')
  const [artStyleModel, setArtStyleModel] = useState(imageModels[0]?.id ?? 'gemini-3.1-flash-image')
  const [scale, setScale] = useState(upscaleScales[0] ?? 2)
  const [strength, setStrength] = useState(0.75)
  const [printSize, setPrintSize] = useState(printSizes[0]?.id ?? '4x6')
  const [orientation, setOrientation] = useState<Orientation>('landscape')
  const [borderModel, setBorderModel] = useState(imageModels[0]?.id ?? 'gemini-3.1-flash-image')

  return (
    <aside className="w-[228px] shrink-0 border-r border-ed-line bg-ed-panel">
      {editor.tool === 'transform' ? <TransformPanel editor={editor} /> : null}
      {editor.tool === 'adjust' ? <AdjustPanel editor={editor} /> : null}
      {editor.tool === 'filters' ? <FiltersPanel editor={editor} /> : null}
      {editor.tool === 'text' ? <TextPanel editor={editor} /> : null}
      {editor.tool === 'text-design' ? <TextDesignPanel editor={editor} /> : null}
      {editor.tool === 'brush' ? <BrushPanel editor={editor} /> : null}
      {editor.tool === 'focus' ? <FocusPanel editor={editor} /> : null}
      {editor.tool === 'magic-edit' ? (
        <MagicEditPanel
          editor={editor}
          operation={operation}
          setOperation={setOperation}
          instruction={instruction}
          setInstruction={setInstruction}
          model={magicEditModel}
          setModel={setMagicEditModel}
          models={imageModels}
        />
      ) : null}
      {editor.tool === 'art-style' ? (
        <ArtStylePanel
          editor={editor}
          style={style}
          setStyle={setStyle}
          intensity={styleIntensity}
          setIntensity={setStyleIntensity}
          model={artStyleModel}
          setModel={setArtStyleModel}
          models={imageModels}
        />
      ) : null}
      {editor.tool === 'upscaler' ? (
        <UpscalerPanel
          editor={editor}
          scale={scale}
          setScale={setScale}
          strength={strength}
          setStrength={setStrength}
        />
      ) : null}
      {editor.tool === 'border-expander' ? (
        <BorderExpanderPanel
          editor={editor}
          printSize={printSize}
          setPrintSize={setPrintSize}
          orientation={orientation}
          setOrientation={setOrientation}
          model={borderModel}
          setModel={setBorderModel}
          models={imageModels}
        />
      ) : null}
    </aside>
  )
}
