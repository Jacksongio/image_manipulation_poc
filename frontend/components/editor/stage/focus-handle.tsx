'use client'

import { Circle, Group, Line } from 'react-konva'
import type { Focus } from '@/lib/editor/doc'

export function FocusHandle({
  focus,
  frame,
  zoom,
  onChange,
  onCommitStart,
}: {
  focus: Focus
  frame: { width: number; height: number }
  zoom: number
  onChange: (focus: Focus) => void
  onCommitStart: () => void
}) {
  const stroke = 1.5 / zoom
  const knob = 5 / zoom
  const radians = (focus.angle * Math.PI) / 180
  const nx = Math.sin(radians)
  const ny = -Math.cos(radians)
  const handleX = focus.x + nx * focus.radius
  const handleY = focus.y + ny * focus.radius
  const span = Math.max(frame.width, frame.height)

  const guide = (offset: number) => [
    focus.x + nx * offset - ny * span,
    focus.y + ny * offset + nx * span,
    focus.x + nx * offset + ny * span,
    focus.y + ny * offset - nx * span,
  ]

  return (
    <Group>
      {focus.type === 'radial' || focus.type === 'gaussian' ? (
        <Circle
          x={focus.x}
          y={focus.y}
          radius={focus.radius}
          stroke="rgba(255,255,255,0.85)"
          strokeWidth={stroke}
          listening={false}
        />
      ) : null}
      {focus.type === 'mirrored' ? (
        <>
          <Line points={guide(focus.radius)} stroke="rgba(255,255,255,0.85)" strokeWidth={stroke} listening={false} />
          <Line points={guide(-focus.radius)} stroke="rgba(255,255,255,0.85)" strokeWidth={stroke} listening={false} />
        </>
      ) : null}
      {focus.type === 'linear' ? (
        <Line points={guide(0)} stroke="rgba(255,255,255,0.85)" strokeWidth={stroke} listening={false} />
      ) : null}

      <Circle
        x={focus.x}
        y={focus.y}
        radius={knob * 1.2}
        fill="rgba(255,255,255,0.95)"
        stroke="rgba(0,0,0,0.4)"
        strokeWidth={stroke}
        draggable
        onDragStart={onCommitStart}
        onDragMove={(event) => onChange({ ...focus, x: event.target.x(), y: event.target.y() })}
        onMouseEnter={(event) => {
          const container = event.target.getStage()?.container()
          if (container) container.style.cursor = 'move'
        }}
        onMouseLeave={(event) => {
          const container = event.target.getStage()?.container()
          if (container) container.style.cursor = 'default'
        }}
      />

      <Circle
        x={handleX}
        y={handleY}
        radius={knob}
        fill="#ffffff"
        stroke="rgba(0,0,0,0.4)"
        strokeWidth={stroke}
        draggable
        onDragStart={onCommitStart}
        onDragMove={(event) => {
          const dx = event.target.x() - focus.x
          const dy = event.target.y() - focus.y
          const radius = Math.max(20, Math.hypot(dx, dy))
          const angle = (Math.atan2(dx, -dy) * 180) / Math.PI
          onChange({ ...focus, radius, angle })
        }}
        onMouseEnter={(event) => {
          const container = event.target.getStage()?.container()
          if (container) container.style.cursor = 'grab'
        }}
        onMouseLeave={(event) => {
          const container = event.target.getStage()?.container()
          if (container) container.style.cursor = 'default'
        }}
      />
    </Group>
  )
}
