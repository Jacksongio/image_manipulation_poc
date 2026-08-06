'use client'

import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

export function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
  onCommitStart,
  disabled,
  className,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  format?: (value: number) => string
  onChange: (value: number) => void
  /** Fired once when a drag starts so the editor can push a history checkpoint. */
  onCommitStart?: () => void
  disabled?: boolean
  className?: string
}) {
  const fill = ((value - min) / (max - min)) * 100

  return (
    <div className={cn('mb-3 last:mb-0', className)}>
      <span className="block text-[10px] font-medium text-ed-text">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="range"
          aria-label={label}
          className="ed-range flex-1"
          style={{ '--ed-fill': `${fill}%` } as CSSProperties}
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onPointerDown={onCommitStart}
          onKeyDown={(event) => {
            if (event.key.startsWith('Arrow')) onCommitStart?.()
          }}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span className="w-7 shrink-0 text-right text-[10px] tabular-nums text-ed-dim">
          {format ? format(value) : Math.round(value)}
        </span>
      </div>
    </div>
  )
}
