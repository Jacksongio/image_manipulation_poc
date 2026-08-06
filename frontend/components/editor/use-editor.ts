'use client'

import type Konva from 'konva'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Candidate, Point } from '@/lib/editor/ai'
import type {
  Crop,
  Doc,
  Focus,
  Layer,
  SourceImage,
  TextAlign,
  TextDesignLayer,
  TextLayer,
} from '@/lib/editor/doc'
import { createDoc, layerId, NEUTRAL_ADJUST } from '@/lib/editor/doc'
import { useDocHistory } from '@/lib/editor/history'
import { sourceFromBlob } from '@/lib/editor/image'
import type { ToolCatalog } from '@/lib/editor/tools-api'
import { composeDocument } from '@/lib/editor/tools-api'
import { useRender } from '@/lib/editor/use-render'
import type { ToolId } from './tools'

export type BrushSettings = { color: string; size: number; hardness: number }
export type TextSettings = {
  fontFamily: string
  fontSize: number
  fill: string
  background: string
  align: TextAlign
  lineHeight: number
}
export type MagicState = {
  /** Whether the next canvas click adds to or subtracts from the selection. */
  include: boolean
  points: Point[]
  candidates: Candidate[]
  index: number
}

const ZOOM_STEPS = [0.1, 0.15, 0.25, 0.35, 0.5, 0.66, 0.8, 1, 1.25, 1.5, 2, 3, 4, 6, 8]

export function useEditor(initialSource: SourceImage, catalog: ToolCatalog, onClose: () => void) {
  const history = useDocHistory(createDoc(initialSource))
  const { doc, update, checkpoint } = history

  const [tool, setTool] = useState<ToolId>('transform')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [zoomOverride, setZoomOverride] = useState<number | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [brush, setBrush] = useState<BrushSettings>(catalog.brush.defaults)
  const [designColor, setDesignColor] = useState(catalog.colorSwatches[0] ?? '#ffffff')
  const [textSettings, setTextSettings] = useState<TextSettings>(catalog.text.defaults)
  const [magic, setMagic] = useState<MagicState>({
    include: true,
    points: [],
    candidates: [],
    index: 0,
  })
  const [aspect, setAspect] = useState('custom')

  const stageRef = useRef<Konva.Stage>(null)

  // Python renders everything; this hook only keeps the canvas in step with it.
  const render = useRender(doc)

  const fullFrame = useMemo<Crop>(
    () => ({ x: 0, y: 0, width: render.orientedWidth, height: render.orientedHeight }),
    [render.orientedWidth, render.orientedHeight],
  )
  const cropping = tool === 'transform'
  const frame = cropping ? fullFrame : render.crop

  const fitZoom = useMemo(() => {
    if (!viewport.width || !viewport.height || !frame.width || !frame.height) return 1
    return Math.min((viewport.width - 72) / frame.width, (viewport.height - 72) / frame.height)
  }, [viewport, frame.width, frame.height])
  const zoom = zoomOverride ?? Math.min(1, Math.max(0.05, fitZoom))

  const zoomTo = useCallback(
    (value: number) => setZoomOverride(Math.min(8, Math.max(0.05, value))),
    [],
  )
  const zoomFit = useCallback(() => setZoomOverride(null), [])
  const zoomIn = useCallback(() => {
    zoomTo(ZOOM_STEPS.find((step) => step > zoom + 0.001) ?? 8)
  }, [zoom, zoomTo])
  const zoomOut = useCallback(() => {
    zoomTo([...ZOOM_STEPS].reverse().find((step) => step < zoom - 0.001) ?? 0.05)
  }, [zoom, zoomTo])

  const selected = useMemo(
    () => doc.layers.find((layer) => layer.id === selectedId) ?? null,
    [doc.layers, selectedId],
  )
  const selectedText = selected?.kind === 'text' ? selected : null
  const selectedDesign = selected?.kind === 'textDesign' ? selected : null

  const patchLayer = useCallback(
    (id: string, patch: Partial<Layer>, options?: { checkpoint?: boolean }) => {
      update(
        (current) => ({
          ...current,
          layers: current.layers.map((layer) =>
            layer.id === id ? ({ ...layer, ...patch } as Layer) : layer,
          ),
        }),
        options,
      )
    },
    [update],
  )

  const addLayer = useCallback(
    (layer: Layer) => {
      update((current) => ({ ...current, layers: [...current.layers, layer] }))
      setSelectedId(layer.id)
    },
    [update],
  )

  const addText = useCallback(() => {
    const rect = render.crop
    const width = Math.round(rect.width * 0.6)
    const fontSize = Math.max(14, Math.round(rect.width * 0.08))
    setTextSettings((current) => ({ ...current, fontSize }))
    addLayer({
      kind: 'text',
      id: layerId('text'),
      x: rect.x + Math.round((rect.width - width) / 2),
      y: rect.y + Math.round(rect.height * 0.42),
      width,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      text: 'Your text here',
      fontFamily: textSettings.fontFamily,
      fontSize,
      fill: textSettings.fill,
      background: textSettings.background,
      align: textSettings.align,
      lineHeight: textSettings.lineHeight,
    })
  }, [addLayer, render.crop, textSettings])

  const addTextDesign = useCallback(
    (templateId: string) => {
      const rect = render.crop
      const template =
        catalog.textDesigns.find((entry) => entry.id === templateId) ?? catalog.textDesigns[0]
      const width = Math.round(rect.width * 0.66)
      addLayer({
        kind: 'textDesign',
        id: layerId('design'),
        x: rect.x + Math.round((rect.width - width) / 2),
        y: rect.y + Math.round(rect.height * 0.32),
        width,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        template: template.id,
        variant: 0,
        lines: [...template.sample],
        color: designColor,
        inverted: false,
      })
    },
    [addLayer, catalog.textDesigns, designColor, render.crop],
  )

  const addStroke = useCallback(
    (points: number[]) => {
      if (points.length < 4) return
      update((current) => ({
        ...current,
        layers: [
          ...current.layers,
          {
            kind: 'stroke',
            id: layerId('stroke'),
            points,
            color: brush.color,
            size: brush.size,
            hardness: brush.hardness,
          },
        ],
      }))
    },
    [brush, update],
  )

  const removeLayer = useCallback(
    (id: string) => {
      update((current) => ({ ...current, layers: current.layers.filter((layer) => layer.id !== id) }))
      setSelectedId((current) => (current === id ? null : current))
      setEditingId((current) => (current === id ? null : current))
    },
    [update],
  )

  const duplicateLayer = useCallback(
    (id: string) => {
      const original = doc.layers.find((layer) => layer.id === id)
      if (!original || original.kind === 'stroke') return
      const offset = Math.round(render.crop.width * 0.03)
      const copy = {
        ...original,
        id: layerId(original.kind),
        x: original.x + offset,
        y: original.y + offset,
      } as Layer
      update((current) => ({ ...current, layers: [...current.layers, copy] }))
      setSelectedId(copy.id)
    },
    [doc.layers, render.crop.width, update],
  )

  const moveToFront = useCallback(
    (id: string) => {
      update((current) => {
        const target = current.layers.find((layer) => layer.id === id)
        if (!target) return current
        return { ...current, layers: [...current.layers.filter((layer) => layer.id !== id), target] }
      })
    },
    [update],
  )

  const invertDesign = useCallback(
    (id: string) => {
      const target = doc.layers.find((layer) => layer.id === id)
      if (target?.kind !== 'textDesign') return
      patchLayer(id, { inverted: !target.inverted } as Partial<TextDesignLayer>)
    },
    [doc.layers, patchLayer],
  )

  const shuffleDesign = useCallback(
    (id: string) => {
      const target = doc.layers.find((layer) => layer.id === id)
      if (target?.kind !== 'textDesign') return
      const template = catalog.textDesigns.find((entry) => entry.id === target.template)
      const count = Math.max(1, template?.variantCount ?? 1)
      patchLayer(id, { variant: (target.variant + 1) % count } as Partial<TextDesignLayer>)
    },
    [catalog.textDesigns, doc.layers, patchLayer],
  )

  const cropTween = useRef<number | null>(null)
  const cancelCropTween = useCallback(() => {
    if (cropTween.current !== null) {
      cancelAnimationFrame(cropTween.current)
      cropTween.current = null
    }
  }, [])
  useEffect(() => cancelCropTween, [cancelCropTween])

  const setCrop = useCallback(
    (crop: Crop | null, options?: { checkpoint?: boolean }) => {
      cancelCropTween()
      update((current) => ({ ...current, crop }), options)
    },
    [cancelCropTween, update],
  )

  /** Eases the crop box to a new size so preset changes read as a move, not a jump. */
  const tweenCrop = useCallback(
    (target: Crop | null) => {
      cancelCropTween()
      checkpoint()

      const from = doc.crop ?? fullFrame
      const to = target ?? fullFrame
      const land = () => update((current) => ({ ...current, crop: target }), { checkpoint: false })

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        land()
        return
      }

      const started = performance.now()
      const duration = 260
      const step = (now: number) => {
        const progress = Math.min(1, (now - started) / duration)
        if (progress >= 1) {
          cropTween.current = null
          land()
          return
        }
        const eased = 1 - (1 - progress) ** 3
        update(
          (current) => ({
            ...current,
            crop: {
              x: Math.round(from.x + (to.x - from.x) * eased),
              y: Math.round(from.y + (to.y - from.y) * eased),
              width: Math.round(from.width + (to.width - from.width) * eased),
              height: Math.round(from.height + (to.height - from.height) * eased),
            },
          }),
          { checkpoint: false },
        )
        cropTween.current = requestAnimationFrame(step)
      }
      cropTween.current = requestAnimationFrame(step)
    },
    [cancelCropTween, checkpoint, doc.crop, fullFrame, update],
  )

  const cropRatio = useMemo(
    () => catalog.transform.aspectPresets.find((preset) => preset.id === aspect)?.ratio ?? null,
    [aspect, catalog.transform.aspectPresets],
  )

  /** Mirrors the backend's fit_ratio so the tween has somewhere to land. */
  const applyAspect = useCallback(
    (id: string) => {
      setAspect(id)
      const ratio = catalog.transform.aspectPresets.find((entry) => entry.id === id)?.ratio
      if (!ratio) {
        tweenCrop(null)
        return
      }
      let width = fullFrame.width
      let height = width / ratio
      if (height > fullFrame.height) {
        height = fullFrame.height
        width = height * ratio
      }
      tweenCrop({
        x: Math.round((fullFrame.width - width) / 2),
        y: Math.round((fullFrame.height - height) / 2),
        width: Math.round(width),
        height: Math.round(height),
      })
    },
    [catalog.transform.aspectPresets, fullFrame, tweenCrop],
  )

  const resetTransform = useCallback(() => {
    setAspect('custom')
    // Rotation and flips resize the whole frame, so only a pure crop reset can be tweened.
    if (doc.rotation === 0 && doc.quarterTurns === 0 && !doc.flipX && !doc.flipY) {
      tweenCrop(null)
      return
    }
    cancelCropTween()
    update((current) => ({
      ...current,
      crop: null,
      rotation: 0,
      quarterTurns: 0,
      flipX: false,
      flipY: false,
    }))
  }, [cancelCropTween, doc, tweenCrop, update])

  const setFocus = useCallback(
    (focus: Focus | null, options?: { checkpoint?: boolean }) =>
      update((current) => ({ ...current, focus }), options),
    [update],
  )

  const resetMagic = useCallback(
    () => setMagic({ include: true, points: [], candidates: [], index: 0 }),
    [],
  )

  /** The backend's authoritative flatten, so AI tools see exactly what Save would. */
  const flatten = useCallback(
    () => composeDocument(doc.source.blob, doc.source.name, doc),
    [doc],
  )

  const replaceSource = useCallback(
    async (blob: Blob, name: string) => {
      const next = await sourceFromBlob(blob, name)
      setSelectedId(null)
      setEditingId(null)
      resetMagic()
      setAspect('custom')
      update((current) => ({
        ...current,
        source: next,
        crop: null,
        rotation: 0,
        quarterTurns: 0,
        flipX: false,
        flipY: false,
        adjust: { ...NEUTRAL_ADJUST },
        filter: { id: null, intensity: 50 },
        focus: null,
        layers: [],
      }))
    },
    [resetMagic, update],
  )

  useEffect(() => {
    if (tool !== 'text' && tool !== 'text-design') {
      setSelectedId(null)
      setEditingId(null)
    }
    if (tool !== 'magic-edit') resetMagic()
  }, [tool, resetMagic])

  useEffect(() => {
    if (render.error) setError(render.error)
  }, [render.error])

  useEffect(() => {
    if (!error) return
    const timer = window.setTimeout(() => setError(null), 6000)
    return () => window.clearTimeout(timer)
  }, [error])

  return {
    ...history,
    doc: doc as Doc,
    catalog,
    tool,
    setTool,
    selectedId,
    setSelectedId,
    selected,
    selectedText,
    selectedDesign,
    editingId,
    setEditingId,
    viewport,
    setViewport,
    zoom,
    zoomIn,
    zoomOut,
    zoomFit,
    zoomTo,
    isFit: zoomOverride === null,
    busy,
    setBusy,
    error,
    setError,
    brush,
    setBrush,
    designColor,
    setDesignColor,
    textSettings,
    setTextSettings,
    magic,
    setMagic,
    resetMagic,
    stageRef,
    render,
    frame,
    fullFrame,
    cropping,
    patchLayer,
    addText,
    addTextDesign,
    addStroke,
    removeLayer,
    duplicateLayer,
    moveToFront,
    invertDesign,
    shuffleDesign,
    setCrop,
    aspect,
    cropRatio,
    applyAspect,
    resetTransform,
    setFocus,
    flatten,
    replaceSource,
    checkpoint,
    onClose,
  }
}

export type Editor = ReturnType<typeof useEditor>
export type { TextDesignLayer, TextLayer }
