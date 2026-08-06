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
    checkpoint,
  } = editor

  const containerRef = useRef<HTMLDivElement>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const [drawing, setDrawing] = useState<number[] | null>(null)
  const [toolbarRect, setToolbarRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null)

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
  }, [drawing, relativePointer])

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
      // Alt or Shift momentarily flips whichever mode the panel is set to.
      const include = event.evt.altKey || event.evt.shiftKey ? !magic.include : magic.include
      const label: 0 | 1 = include ? 1 : 0
      editor.setMagic((current) => ({ ...current, points: [...current.points, { x, y, label }] }))
    },
    [editor, frame, magic.include, relativePointer, tool],
  )

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
          onPointerLeave={handlePointerUp}
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

      {editor.busy ? (
        <div className="magic-generating-overlay absolute inset-0 z-30 grid place-items-center bg-black/55 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-3">
            <span className="size-8 animate-spin rounded-full border-2 border-white/25 border-t-ed-accent" />
            <span className="text-[12px] font-medium text-white">{editor.busy}</span>
            <span className="relative h-0.5 w-40 overflow-hidden rounded-full bg-white/15">
              <span className="magic-generate-progress absolute inset-y-0 w-1/3 rounded-full bg-ed-accent" />
            </span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
