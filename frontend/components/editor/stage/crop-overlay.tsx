'use client'

import { Fragment } from 'react'
import { Group, Line, Rect } from 'react-konva'
import type { Crop } from '@/lib/editor/doc'

/**
 * Crop size is driven entirely from the Transform panel, so this overlay only
 * dims the discarded area, shows the thirds grid, and lets the box be repositioned.
 */
export function CropOverlay({
  frame,
  crop,
  zoom,
  onChange,
  onCommitStart,
}: {
  frame: Crop
  crop: Crop
  zoom: number
  onChange: (crop: Crop) => void
  onCommitStart: () => void
}) {
  const stroke = 1 / zoom
  const gridLines = [1, 2].flatMap((step) => [
    [crop.x + (crop.width * step) / 3, crop.y, crop.x + (crop.width * step) / 3, crop.y + crop.height],
    [crop.x, crop.y + (crop.height * step) / 3, crop.x + crop.width, crop.y + (crop.height * step) / 3],
  ])

  return (
    <Group>
      <Rect x={frame.x} y={frame.y} width={frame.width} height={crop.y - frame.y} fill="rgba(0,0,0,0.55)" listening={false} />
      <Rect
        x={frame.x}
        y={crop.y + crop.height}
        width={frame.width}
        height={frame.y + frame.height - (crop.y + crop.height)}
        fill="rgba(0,0,0,0.55)"
        listening={false}
      />
      <Rect x={frame.x} y={crop.y} width={crop.x - frame.x} height={crop.height} fill="rgba(0,0,0,0.55)" listening={false} />
      <Rect
        x={crop.x + crop.width}
        y={crop.y}
        width={frame.x + frame.width - (crop.x + crop.width)}
        height={crop.height}
        fill="rgba(0,0,0,0.55)"
        listening={false}
      />

      <Rect
        x={crop.x}
        y={crop.y}
        width={crop.width}
        height={crop.height}
        stroke="#ffffff"
        strokeWidth={stroke}
        draggable
        onDragStart={onCommitStart}
        onDragMove={(event) => {
          const node = event.target
          const x = Math.max(frame.x, Math.min(node.x(), frame.x + frame.width - crop.width))
          const y = Math.max(frame.y, Math.min(node.y(), frame.y + frame.height - crop.height))
          node.position({ x, y })
          onChange({ ...crop, x: Math.round(x), y: Math.round(y) })
        }}
        onMouseEnter={(event) => {
          const container = event.target.getStage()?.container()
          if (container) container.style.cursor = 'move'
        }}
        onMouseLeave={(event) => {
          const container = event.target.getStage()?.container()
          if (container) container.style.cursor = 'default'
        }}
      />

      {/* Rule-of-thirds grid, doubled with a dark line so it reads over light photos too. */}
      {gridLines.map((points, index) => (
        <Fragment key={`grid-${index}`}>
          <Line points={points} stroke="rgba(0,0,0,0.4)" strokeWidth={stroke * 2} listening={false} />
          <Line points={points} stroke="rgba(255,255,255,0.75)" strokeWidth={stroke} listening={false} />
        </Fragment>
      ))}
    </Group>
  )
}
