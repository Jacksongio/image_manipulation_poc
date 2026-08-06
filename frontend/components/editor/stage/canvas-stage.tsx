'use client'

import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Circle, Group, Image as KonvaImage, Layer, Line, Stage, Transformer } from 'react-konva'
import { cn } from '@/lib/utils'
import type { Editor } from '../use-editor'
import { CropOverlay } from './crop-overlay'
import { FocusHandle } from './focus-handle'
import { LayerNode, StrokeNode, type NodeHandlers } from './layer-nodes'
import { ObjectToolbar, type ObjectAction } from './object-toolbar'

function useImageElement(src: string | null) {
  const [element, setElement] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    if (!src) {
      setElement(null)
      return
    }
    const image = new Image()
    image.src = src
    let active = true
    void image.decode().then(
      () => {
        if (active) setElement(image)
      },
      () => undefined,
    )
    return () => {
      active = false
    }
  }, [src])
  return element
}

export function CanvasStage({ editor }: { editor: Editor }) {
  const {
    doc,
    tool,
    zoom,
    viewport,
    setViewport,
    frame,
    fullFrame,
    cropping,
    render,
    stageRef,
    selectedId,
    setSelectedId,
    editingId,
    setEditingId,
    brush,
    magic,
    magicPreview,
    borderExpansionPreview,
    checkpoint,
  } = editor

  const containerRef = useRef<HTMLDivElement>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const [drawing, setDrawing] = useState<number[] | null>(null)
  const [toolbarRect, setToolbarRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [comparePosition, setComparePosition] = useState(50)
  const [acceptingPreview, setAcceptingPreview] = useState(false)
  const magicHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastMagicHover = useRef<string>('')

  const activeCandidate = magic.candidates[magic.index] ?? null
  const maskElement = useImageElement(activeCandidate ? `data:image/png;base64,${activeCandidate.mask}` : null)

  useEffect(() => {
    const node = containerRef.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      setViewport({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [setViewport])

  const base = useMemo(
    () => ({
      x: (viewport.width - frame.width * zoom) / 2 - frame.x * zoom,
      y: (viewport.height - frame.height * zoom) / 2 - frame.y * zoom,
    }),
    [viewport, frame, zoom],
  )

  const borderPreviewSize = useMemo(() => {
    if (!borderExpansionPreview) return null
    const maxWidth = Math.max(1, viewport.width - 72)
    const maxHeight = Math.max(1, viewport.height - 72)
    const width = Math.min(maxWidth, maxHeight * borderExpansionPreview.targetAspectRatio)
    return { width, height: width / borderExpansionPreview.targetAspectRatio }
  }, [borderExpansionPreview, viewport.height, viewport.width])

  // The canvas never pans, so zooming keeps the frame centred instead of anchoring to the cursor.
  const handleWheel = useCallback(
    (event: KonvaEventObject<WheelEvent>) => {
      event.evt.preventDefault()
      const direction = event.evt.deltaY > 0 ? 1 / 1.09 : 1.09
      editor.zoomTo(zoom * direction)
    },
    [editor, zoom],
  )

  const relativePointer = useCallback(() => stageRef.current?.getRelativePointerPosition() ?? null, [stageRef])

  const clearMagicHover = useCallback(() => {
    if (magicHoverTimer.current !== null) {
      clearTimeout(magicHoverTimer.current)
      magicHoverTimer.current = null
    }
  }, [])

  const cancelMagicHoverPreview = useCallback(() => {
    clearMagicHover()
    // Leaving the actual image must cancel both the dwell timer and an
    // in-flight SAM request. Resetting points makes MagicEditPanel abort it.
    if (!magic.locked && magic.points.length) editor.resetMagic()
  }, [clearMagicHover, editor, magic.locked, magic.points.length])

  const queueMagicHover = useCallback(
    (x: number, y: number) => {
      const label: 1 = 1
      const key = `${x}:${y}:${label}`
      if (magic.locked || key === lastMagicHover.current) return

      clearMagicHover()
      magicHoverTimer.current = setTimeout(() => {
        lastMagicHover.current = key
        magicHoverTimer.current = null
        // A hover previews one object at a time. Replacing the point also makes
        // the previous mask disappear while SAM 3 resolves the next object.
        editor.setMagic((current) => {
          const currentPoint = current.points[0]
          if (
            current.points.length === 1 &&
            currentPoint?.x === x &&
            currentPoint.y === y &&
            currentPoint.label === label
          ) {
            return current
          }
          return { ...current, points: [{ x, y, label }], candidates: [], index: 0, locked: false }
        })
      }, 350)
    },
    [clearMagicHover, editor, magic.locked],
  )

  useEffect(() => clearMagicHover, [clearMagicHover])

  useEffect(() => {
    if (!magic.points.length) lastMagicHover.current = ''
  }, [magic.points.length])

  const handlePointerDown = useCallback(
    (event: KonvaEventObject<PointerEvent>) => {
      if (tool === 'brush') {
        const point = relativePointer()
        if (point) setDrawing([point.x, point.y])
        return
      }
      if (tool === 'magic-edit') return
      if (event.target === event.target.getStage() || event.target.name() === 'base-image') {
        setSelectedId(null)
        setEditingId(null)
      }
    },
    [relativePointer, setEditingId, setSelectedId, tool],
  )

  const handlePointerMove = useCallback(() => {
    if (tool === 'magic-edit') {
      if (magic.locked) return
      const point = relativePointer()
      if (!point) return
      const x = Math.round(point.x - frame.x)
      const y = Math.round(point.y - frame.y)
      if (x < 0 || y < 0 || x >= frame.width || y >= frame.height) {
        cancelMagicHoverPreview()
        return
      }
      queueMagicHover(x, y)
      return
    }
    if (!drawing) return
    const point = relativePointer()
    if (!point) return
    setDrawing((current) => {
      if (!current) return current
      // Skipping sub-pixel moves keeps the stroke light without visibly changing it.
      const dx = point.x - current[current.length - 2]
      const dy = point.y - current[current.length - 1]
      if (dx * dx + dy * dy < 4) return current
      return [...current, point.x, point.y]
    })
  }, [cancelMagicHoverPreview, drawing, frame, magic.locked, queueMagicHover, relativePointer, tool])

  const handlePointerUp = useCallback(() => {
    if (!drawing) return
    editor.addStroke(drawing)
    setDrawing(null)
  }, [drawing, editor])

  const handleClick = useCallback(
    (event: KonvaEventObject<MouseEvent>) => {
      if (tool !== 'magic-edit') return
      const point = relativePointer()
      if (!point) return
      const x = Math.round(point.x - frame.x)
      const y = Math.round(point.y - frame.y)
      if (x < 0 || y < 0 || x >= frame.width || y >= frame.height) return
      const clickedPointIndex = magic.points.findIndex(
        (storedPoint) => (storedPoint.x - x) ** 2 + (storedPoint.y - y) ** 2 <= (12 / zoom) ** 2,
      )

      if (magic.locked) {
        if (clickedPointIndex >= 0) {
          clearMagicHover()
          lastMagicHover.current = ''
          editor.setMagic((current) => {
            const points = current.points.filter((_, index) => index !== clickedPointIndex)
            return { ...current, points, candidates: [], index: 0, locked: points.length > 0 }
          })
        } else {
          // SAM 3 combines all positive points into one mask. Clicking another
          // part of the same subject grows the locked selection without
          // re-enabling hover previews.
          editor.setMagic((current) => ({
            ...current,
            points: [...current.points, { x, y, label: 1 }],
            candidates: [],
            index: 0,
            locked: true,
          }))
        }
        return
      }

      const label: 1 = 1
      clearMagicHover()
      if (magic.candidates.length) {
        // Keep the mask that was visible at the instant of the click.
        editor.setMagic((current) => ({ ...current, locked: true }))
        return
      }

      lastMagicHover.current = `${x}:${y}:${label}`
      editor.setMagic((current) => {
        const currentPoint = current.points[0]
        if (
          current.points.length === 1 &&
          currentPoint?.x === x &&
          currentPoint.y === y &&
          currentPoint.label === label
        ) {
          return current
        }
        return { ...current, points: [{ x, y, label }], candidates: [], index: 0, locked: true }
      })
    },
    [clearMagicHover, editor, frame, magic.candidates.length, magic.locked, magic.points, relativePointer, tool, zoom],
  )

  const handlePointerLeave = useCallback(() => {
    cancelMagicHoverPreview()
    handlePointerUp()
  }, [cancelMagicHoverPreview, handlePointerUp])

  const nodeHandlers: NodeHandlers = useMemo(
    () => ({
      onSelect: (id) => setSelectedId(id),
      onDragStart: checkpoint,
      onChange: (id, patch) => editor.patchLayer(id, patch, { checkpoint: false }),
    }),
    [checkpoint, editor, setSelectedId],
  )

  // Runs after every commit so the toolbar tracks live drags, but only writes state
  // when the measured box actually moved, otherwise it would re-render forever.
  useLayoutEffect(() => {
    const transformer = transformerRef.current
    const stage = stageRef.current
    if (!transformer || !stage) return
    // Measured even while editing (the node is hidden then) so the textarea can sit on top of it.
    const node = selectedId ? stage.findOne(`#${selectedId}`) : null
    transformer.nodes(node && !editingId ? [node] : [])
    const next = node ? node.getClientRect() : null
    setToolbarRect((current) => {
      if (!next) return current === null ? current : null
      if (
        current &&
        Math.abs(current.x - next.x) < 0.5 &&
        Math.abs(current.y - next.y) < 0.5 &&
        Math.abs(current.width - next.width) < 0.5 &&
        Math.abs(current.height - next.height) < 0.5
      ) {
        return current
      }
      return next
    })
  })

  const selectionActions = useMemo<ObjectAction[]>(() => {
    if (!editor.selected || editor.selected.kind === 'stroke') return []
    const id = editor.selected.id
    const isFront = doc.layers.at(-1)?.id === id
    const actions: ObjectAction[] = [
      { id: 'edit', label: 'Edit', onClick: () => setEditingId(id) },
      { id: 'front', label: 'Move To Front', disabled: isFront, onClick: () => editor.moveToFront(id) },
    ]
    if (editor.selected.kind === 'textDesign') {
      actions.push({ id: 'invert', label: 'Invert', onClick: () => editor.invertDesign(id) })
    }
    actions.push(
      { id: 'duplicate', label: 'Duplicate', onClick: () => editor.duplicateLayer(id) },
      { id: 'delete', label: 'Delete', onClick: () => editor.removeLayer(id) },
    )
    return actions
  }, [doc.layers, editor, setEditingId])

  const editingLayer = editingId ? doc.layers.find((layer) => layer.id === editingId) : null
  const cursor = tool === 'brush' || tool === 'magic-edit' ? 'crosshair' : 'default'
  const magicPoint = magic.points.at(-1)
  const findingObject = tool === 'magic-edit' && editor.busy === 'Finding the object…' && Boolean(magicPoint)

  useEffect(() => {
    setComparePosition(50)
  }, [magicPreview])

  const acceptMagicPreview = useCallback(async () => {
    if (!magicPreview || acceptingPreview) return
    setAcceptingPreview(true)
    try {
      await editor.replaceSource(magicPreview.afterBlob, editor.doc.source.name, {
        preserveMagicSelection: true,
      })
      editor.setMagicPreview(null)
    } catch (error) {
      editor.setError(error instanceof Error ? error.message : 'Could not accept the Magic Edit result')
    } finally {
      setAcceptingPreview(false)
    }
  }, [acceptingPreview, editor, magicPreview])

  const generationWords = editor.busy?.startsWith('Expanding')
    ? ['Reading the scene edges…', 'Imagining new surroundings…', 'Matching light and texture…', 'Blending the expanded canvas…']
    : editor.busy?.startsWith('Upscaling')
      ? ['Recovering fine detail…', 'Refining the image…', 'Balancing texture and edges…', 'Finishing the upscale…']
      : editor.busy?.startsWith('Painting')
        ? ['Painting your new style…', 'Preserving the composition…', 'Layering the final details…', 'Finishing the artwork…']
        : ['Working magic…', 'Generating your edit…', 'Preserving every detail…', 'Blending the final result…']

  return (
    <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden bg-ed-stage">
      {viewport.width > 0 && render.background ? (
        <Stage
          ref={stageRef}
          width={viewport.width}
          height={viewport.height}
          scaleX={zoom}
          scaleY={zoom}
          x={base.x}
          y={base.y}
          style={{ cursor }}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onClick={handleClick}
        >
          <Layer>
            <Group
              clipX={cropping ? undefined : frame.x}
              clipY={cropping ? undefined : frame.y}
              clipWidth={cropping ? undefined : frame.width}
              clipHeight={cropping ? undefined : frame.height}
            >
              {/* Drawn at document size: the bitmap may be a lower-resolution preview. */}
              <KonvaImage
                image={render.background}
                name="base-image"
                width={fullFrame.width}
                height={fullFrame.height}
              />
              {doc.layers.map((layer) =>
                layer.kind === 'stroke' ? (
                  <StrokeNode key={layer.id} sprite={render.sprites.get(layer.id)} />
                ) : (
                  <LayerNode
                    key={layer.id}
                    layer={layer}
                    sprite={render.sprites.get(layer.id)}
                    handlers={nodeHandlers}
                    editing={editingId === layer.id}
                  />
                ),
              )}
              {drawing ? (
                <Line
                  points={drawing}
                  stroke={brush.color}
                  strokeWidth={brush.size}
                  lineCap="round"
                  lineJoin="round"
                  tension={0.35}
                  shadowColor={brush.color}
                  shadowBlur={(1 - brush.hardness / 100) * brush.size * 0.9}
                  shadowOpacity={0.9}
                  listening={false}
                />
              ) : null}
            </Group>
          </Layer>

          <Layer listening={tool !== 'brush'}>
            {tool === 'magic-edit' && maskElement ? (
              <KonvaImage
                image={maskElement}
                x={frame.x}
                y={frame.y}
                width={frame.width}
                height={frame.height}
                opacity={0.55}
                listening={false}
              />
            ) : null}
            {tool === 'magic-edit'
              ? magic.points.map((point, index) => (
                  <Circle
                    key={`${point.x}-${point.y}-${index}`}
                    x={frame.x + point.x}
                    y={frame.y + point.y}
                    radius={5 / zoom}
                    fill={point.label === 1 ? '#39c46e' : '#e02020'}
                    stroke="#ffffff"
                    strokeWidth={1.5 / zoom}
                    listening={false}
                  />
                ))
              : null}

            {cropping ? (
              <CropOverlay
                frame={fullFrame}
                crop={doc.crop ?? fullFrame}
                zoom={zoom}
                onCommitStart={checkpoint}
                onChange={(crop) => editor.setCrop(crop, { checkpoint: false })}
              />
            ) : null}

            {tool === 'focus' && doc.focus ? (
              <FocusHandle
                focus={doc.focus}
                frame={frame}
                zoom={zoom}
                onCommitStart={checkpoint}
                onChange={(focus) => editor.setFocus(focus, { checkpoint: false })}
              />
            ) : null}

            <Transformer
              ref={transformerRef}
              rotateEnabled
              keepRatio={false}
              anchorSize={8}
              anchorStroke="#3f5bf6"
              anchorFill="#ffffff"
              borderStroke="#ffffff"
              borderStrokeWidth={1}
              rotateAnchorOffset={22}
              boundBoxFunc={(oldBox, newBox) => (newBox.width < 20 || newBox.height < 12 ? oldBox : newBox)}
            />
          </Layer>
        </Stage>
      ) : (
        <div className="grid h-full place-items-center text-[12px] text-ed-dim">Loading canvas…</div>
      )}

      {toolbarRect && selectionActions.length && !editingId ? (
        <ObjectToolbar rect={toolbarRect} actions={selectionActions} />
      ) : null}

      {editingLayer && toolbarRect ? (
        <textarea
          autoFocus
          defaultValue={editingLayer.kind === 'text' ? editingLayer.text : (editingLayer as { lines: string[] }).lines.join('\n')}
          onBlur={(event) => {
            const value = event.target.value
            if (editingLayer.kind === 'text') editor.patchLayer(editingLayer.id, { text: value })
            else editor.patchLayer(editingLayer.id, { lines: value.split('\n') })
            setEditingId(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setEditingId(null)
            event.stopPropagation()
          }}
          className={cn(
            'absolute z-20 resize-none rounded-[3px] border border-ed-accent bg-black/85 p-2 text-white outline-none',
            'text-center leading-tight',
          )}
          style={{
            left: toolbarRect.x,
            top: toolbarRect.y,
            width: Math.max(140, toolbarRect.width),
            height: Math.max(56, toolbarRect.height),
            fontSize: Math.max(11, Math.min(28, toolbarRect.height / 3)),
          }}
        />
      ) : null}

      {tool === 'border-expander' && borderExpansionPreview && borderPreviewSize && render.background ? (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-ed-stage/75 px-9 py-9">
          <div
            className="relative max-h-full max-w-full overflow-hidden rounded-[3px] bg-[#eee] shadow-2xl shadow-black/60"
            style={{ width: borderPreviewSize.width, height: borderPreviewSize.height }}
          >
            <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(63,91,246,0.18)_0px,rgba(63,91,246,0.18)_12px,rgba(63,91,246,0.06)_12px,rgba(63,91,246,0.06)_24px)]" />
            {/* The image uses contain sizing so its whole composition remains
                visible; the patterned area is exactly what AI will generate. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={render.background.src}
              alt="Original image positioned inside the expanded print"
              className="absolute inset-0 size-full object-contain shadow-[0_0_0_1px_rgba(255,255,255,0.8)]"
            />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-ed-accent/35 bg-white/90 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-ed-accent shadow-sm">
              AI expands here
            </span>
          </div>
        </div>
      ) : null}

      {magicPreview ? (
        <section className="absolute inset-0 z-40 overflow-hidden bg-black" aria-label="Magic Edit comparison">
          <img src={magicPreview.beforeUrl} alt="Before Magic Edit" className="absolute inset-0 size-full object-contain" />
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }}
          >
            <img src={magicPreview.afterUrl} alt="After Magic Edit" className="size-full object-contain" />
          </div>
          <div
            className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.9)]"
            style={{ left: `${comparePosition}%` }}
          />
          <input
            aria-label="Before and after comparison"
            type="range"
            min="0"
            max="100"
            value={comparePosition}
            onChange={(event) => setComparePosition(Number(event.target.value))}
            className="absolute inset-0 z-20 h-full w-full cursor-ew-resize opacity-0"
          />
          <div className="absolute inset-x-0 bottom-5 z-30 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => editor.setMagicPreview(null)}
              disabled={acceptingPreview}
              className="rounded-[3px] border border-white/35 bg-black/70 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-black disabled:opacity-50"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => void acceptMagicPreview()}
              disabled={acceptingPreview}
              className="rounded-[3px] bg-ed-accent px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:brightness-110 disabled:opacity-50"
            >
              {acceptingPreview ? 'Accepting…' : 'Accept and continue'}
            </button>
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-4 z-30 flex justify-between px-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-white drop-shadow">
            <span>Before</span>
            <span>After</span>
          </div>
        </section>
      ) : null}

      {findingObject && magicPoint ? (
        <div
          aria-label="Finding object"
          className="pointer-events-none absolute z-30 grid size-7 place-items-center rounded-full border border-white/25 bg-black/65 shadow-lg shadow-black/50"
          style={{
            left: base.x + (frame.x + magicPoint.x) * zoom,
            top: base.y + (frame.y + magicPoint.y) * zoom,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <span className="size-4 animate-spin rounded-full border-2 border-white/25 border-t-ed-accent" />
        </div>
      ) : null}

      {editor.busy && !findingObject ? (
        <div className="magic-generating-overlay absolute inset-0 z-30 grid place-items-center overflow-hidden bg-black/55 backdrop-blur-md">
          <span
            aria-hidden
            className="magic-generate-scan absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-ed-accent/35 to-transparent blur-2xl"
          />
          <div className="relative flex max-w-xs flex-col items-center px-6 text-center text-white">
            <span className="relative grid size-16 place-items-center rounded-2xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-md">
              <span className="size-7 animate-spin rounded-full border-2 border-white/25 border-t-ed-accent" />
              <span className="absolute -inset-2 -z-10 animate-ping rounded-3xl border border-ed-accent/35" />
            </span>
            <div className="mt-6 h-7 overflow-hidden">
              <div className="magic-generate-words">
                {generationWords.map((word) => (
                  <p key={word} className="h-7 text-lg font-semibold">
                    {word}
                  </p>
                ))}
              </div>
            </div>
            <p className="mt-2 text-xs leading-5 text-white/60">{editor.busy}</p>
            <span className="mt-6 h-1 w-52 overflow-hidden rounded-full bg-white/15">
              <span className="magic-generate-progress block h-full w-2/5 rounded-full bg-ed-accent shadow-[0_0_12px_rgba(63,91,246,0.8)]" />
            </span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
