'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'

export const SWATCHES = [
  '#000000',
  '#ffffff',
  '#5b5b5b',
  '#2f6fed',
  '#39c5f3',
  '#39c46e',
  '#e02020',
  '#f5539b',
  '#f5883f',
  '#f7d13a',
]

export const TRANSPARENT = 'transparent'

export function SwatchRow({
  label,
  value,
  onChange,
  allowTransparent,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  allowTransparent?: boolean
}) {
  const inputId = useId()
  const options = allowTransparent ? [TRANSPARENT, ...SWATCHES] : SWATCHES
  const isCustom = !options.includes(value)

  return (
    <div className="mb-3 last:mb-0">
      <span className="block text-[10px] font-medium text-ed-text">{label}</span>
      <div className="mt-1.5 flex flex-wrap items-center gap-[3px]">
        {options.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color === TRANSPARENT ? 'No colour' : color}
            aria-pressed={value === color}
            onClick={() => onChange(color)}
            style={color === TRANSPARENT ? undefined : { backgroundColor: color }}
            className={cn(
              'size-[13px] rounded-[2px] outline-offset-1 transition-[outline]',
              color === TRANSPARENT &&
                'bg-[#1b1b1b] bg-[linear-gradient(45deg,transparent_44%,#e02020_44%,#e02020_56%,transparent_56%)]',
              color === '#ffffff' && 'ring-1 ring-inset ring-black/25',
              value === color ? 'outline outline-1 outline-ed-accent' : 'outline outline-1 outline-transparent',
            )}
          />
        ))}
        <label
          htmlFor={inputId}
          title="Custom colour"
          className={cn(
            'grid size-[13px] cursor-pointer place-items-center rounded-[2px] outline-offset-1',
            'bg-[conic-gradient(#e02020,#f7d13a,#39c46e,#39c5f3,#2f6fed,#f5539b,#e02020)]',
            isCustom ? 'outline outline-1 outline-ed-accent' : 'outline outline-1 outline-transparent',
          )}
        >
          <input
            id={inputId}
            type="color"
            aria-label={`${label} custom colour`}
            value={isCustom ? value : '#ffffff'}
            onChange={(event) => onChange(event.target.value)}
            className="size-0 opacity-0"
          />
        </label>
      </div>
    </div>
  )
}
