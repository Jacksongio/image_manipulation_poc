'use client'

import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { Group, Image as KonvaImage, Rect } from 'react-konva'
import type { Layer } from '@/lib/editor/doc'
import type { LoadedSprite } from '@/lib/editor/use-render'

export type NodeHandlers = {
  onSelect: (id: string) => void
  onDragStart: () => void
  onChange: (id: string, patch: Record<string, number>) => void
}

/**
 * Draws one backend-rendered sprite.
 *
 * Position, rotation, and scale are applied here rather than server-side so a
 * drag stays at pointer speed; the sprite's contents are already final.
 */
export function LayerNode({
  layer,
  sprite,
  handlers,
  editing,
}: {
  layer: Extract<Layer, { kind: 'text' | 'textDesign' }>
  sprite: LoadedSprite | undefined
  handlers: NodeHandlers
  editing: boolean
}) {
  if (!sprite) return null

  const config: Konva.NodeConfig = {
    id: layer.id,
    name: 'layer-node',
    x: layer.x,
    y: layer.y,
    rotation: layer.rotation,
    scaleX: layer.scaleX,
    scaleY: layer.scaleY,
    draggable: !editing,
    visible: !editing,
    onMouseDown: () => handlers.onSelect(layer.id),
    onTap: () => handlers.onSelect(layer.id),
    onDragStart: handlers.onDragStart,
    onDragEnd: (event: KonvaEventObject<DragEvent>) =>
      handlers.onChange(layer.id, { x: event.target.x(), y: event.target.y() }),
    onTransformStart: handlers.onDragStart,
    onTransformEnd: (event: KonvaEventObject<Event>) => {
      const node = event.target
      handlers.onChange(layer.id, {
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        scaleX: node.scaleX(),
        scaleY: node.scaleY(),
      })
    },
  }

  return (
    <Group {...config}>
      {/* Groups have no hit area of their own, so this rect makes the whole sprite clickable. */}
      <Rect width={sprite.width} height={sprite.height} fill="rgba(0,0,0,0.001)" />
      <KonvaImage
        image={sprite.element}
        width={sprite.width}
        height={sprite.height}
        listening={false}
      />
    </Group>
  )
}

/** Brush strokes are not interactive, so they are just a positioned bitmap. */
export function StrokeNode({ sprite }: { sprite: LoadedSprite | undefined }) {
  if (!sprite) return null
  return (
    <KonvaImage
      image={sprite.element}
      x={sprite.x}
      y={sprite.y}
      width={sprite.width}
      height={sprite.height}
      listening={false}
      perfectDrawEnabled={false}
    />
  )
}
