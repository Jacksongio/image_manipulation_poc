'use client'

import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function TileGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-1.5">{children}</div>
}

export function Tile({
  label,
  selected,
  span,
  onClick,
  onCaretClick,
  aspect = '1 / 1',
  labelPlacement = 'overlay',
  menu,
  children,
}: {
  label: string
  selected?: boolean
  span?: boolean
  onClick: () => void
  /** Rendered as the variant chevron seen on grouped filters. */
  onCaretClick?: () => void
  aspect?: string
  labelPlacement?: 'overlay' | 'below'
  menu?: ReactNode
  children: ReactNode
}) {
  return (
    <div className={cn('relative', span && 'col-span-2')}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={cn(
          'block w-full overflow-hidden rounded-[3px] border text-left transition-colors',
          selected ? 'border-ed-accent bg-ed-accent/15' : 'border-transparent bg-ed-tile hover:border-ed-line',
        )}
      >
        <div className="relative w-full overflow-hidden" style={{ aspectRatio: labelPlacement === 'overlay' ? aspect : undefined }}>
          {labelPlacement === 'overlay' ? (
            <>
              {children}
              <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1 pb-1 pt-3 text-center text-[9px] font-semibold text-white">
                {label}
              </span>
            </>
          ) : (
            <>
              <div className="grid place-items-center px-2 pb-1 pt-2.5">{children}</div>
              <span
                className={cn(
                  'block pb-1.5 text-center text-[9px] font-medium',
                  selected ? 'text-white' : 'text-ed-dim',
                )}
              >
                {label}
              </span>
            </>
          )}
        </div>
      </button>
      {onCaretClick ? (
        <button
          type="button"
          aria-label={`${label} variants`}
          onClick={onCaretClick}
          className="absolute bottom-0.5 right-1 grid size-4 place-items-center rounded-[2px] text-white/85 hover:bg-black/50 hover:text-white"
        >
          <ChevronDown className="size-3" />
        </button>
      ) : null}
      {menu}
    </div>
  )
}

export function VariantMenu({
  options,
  value,
  onSelect,
  onClose,
}: {
  options: Array<{ id: string; name: string }>
  value: string
  onSelect: (id: string) => void
  onClose: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} />
      <div className="absolute inset-x-1 bottom-6 z-30 overflow-hidden rounded-[3px] border border-ed-line bg-[#1b1b1b] shadow-xl shadow-black/60">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              onSelect(option.id)
              onClose()
            }}
            className={cn(
              'block w-full px-2 py-1.5 text-left text-[10px] transition-colors',
              option.id === value ? 'bg-ed-accent text-white' : 'text-ed-text hover:bg-white/[0.07]',
            )}
          >
            {option.name}
          </button>
        ))}
      </div>
    </>
  )
}

/**
 * A visual picker for a grouped tool tile. Keeping the images in the popover
 * means each category can have its own set of choices without filling the
 * primary sidebar grid with every variation.
 */
export function VariantTileMenu({
  title,
  options,
  value,
  onSelect,
  onClose,
}: {
  title: string
  options: Array<{ id: string; name: string; thumbnail?: string }>
  value: string
  onSelect: (id: string) => void
  onClose: () => void
}) {
  return (
    <section
      aria-label={`${title} variations`}
      className="mt-1.5 rounded-[4px] border border-ed-line bg-[#1b1b1b] p-2"
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold text-ed-text">{title}</p>
        <button
          type="button"
          onClick={onClose}
          className="text-[9px] text-ed-dim transition-colors hover:text-white"
        >
          Close
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              onSelect(option.id)
              onClose()
            }}
            aria-pressed={option.id === value}
            className={cn(
              'overflow-hidden rounded-[3px] border text-left transition-colors',
              option.id === value ? 'border-ed-accent' : 'border-transparent hover:border-ed-line',
            )}
          >
            <div className="aspect-square bg-ed-tile">
              {option.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={option.thumbnail} alt="" className="size-full object-cover" />
              ) : null}
            </div>
            <span
              className={cn(
                'block truncate px-1 py-1 text-center text-[8px] font-medium',
                option.id === value ? 'bg-ed-accent text-white' : 'text-ed-dim',
              )}
            >
              {option.name}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
