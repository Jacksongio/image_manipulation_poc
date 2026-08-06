'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function PanelShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="ed-panel-in flex h-full min-h-0 flex-col bg-ed-panel">
      <header className="shrink-0 border-b border-ed-line px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-ed-text">
        {title}
      </header>
      <div className="ed-scroll min-h-0 flex-1 overflow-y-auto px-3 py-3">{children}</div>
    </div>
  )
}

export function PanelSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mb-4 last:mb-0">
      {title ? (
        <h3 className="mb-2 border-b border-ed-line pb-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-ed-dim">
          {title}
        </h3>
      ) : null}
      {children}
    </section>
  )
}

export function PanelButton({
  children,
  onClick,
  disabled,
  tone = 'outline',
  className,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  tone?: 'outline' | 'accent'
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full rounded-[3px] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors disabled:cursor-default disabled:opacity-40',
        tone === 'outline'
          ? 'border border-ed-line bg-transparent text-ed-text hover:enabled:border-ed-dim hover:enabled:bg-white/[0.04]'
          : 'bg-ed-accent text-white hover:enabled:brightness-110',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function ToggleSwitch({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-1.5">
      <span className="text-[10px] font-medium text-ed-text">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-[13px] w-[26px] shrink-0 rounded-full transition-colors',
          checked ? 'bg-ed-accent' : 'bg-[#4d4d4d]',
        )}
      >
        <span
          className={cn(
            'absolute top-[2px] size-[9px] rounded-full bg-white transition-all',
            checked ? 'left-[15px]' : 'left-[2px]',
          )}
        />
      </button>
    </label>
  )
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="block text-[10px] font-medium text-ed-text">{children}</span>
}

export function NumberField({
  value,
  onChange,
  suffix,
  min,
  max,
  disabled,
  ariaLabel,
}: {
  value: number
  onChange: (value: number) => void
  suffix?: string
  min?: number
  max?: number
  disabled?: boolean
  ariaLabel: string
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        aria-label={ariaLabel}
        value={Math.round(value)}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(event) => {
          const next = Number(event.target.value)
          if (Number.isFinite(next)) onChange(next)
        }}
        className="w-full min-w-0 rounded-[3px] border border-ed-line bg-[#1b1b1b] px-1.5 py-1 text-[10px] text-ed-text outline-none focus:border-ed-accent disabled:opacity-40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {suffix ? <span className="text-[9px] font-semibold uppercase text-ed-dim">{suffix}</span> : null}
    </div>
  )
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string
  value: T
  options: Array<{ id: T; name: string }>
  onChange: (value: T) => void
}) {
  return (
    <div className="mb-3 last:mb-0">
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <div className={cn('flex gap-0.5 rounded-[3px] border border-ed-line p-0.5', label && 'mt-1')}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={value === option.id}
            className={cn(
              'flex-1 rounded-[2px] px-1 py-1 text-[9px] font-semibold uppercase tracking-[0.06em] transition-colors',
              value === option.id ? 'bg-ed-accent text-white' : 'text-ed-dim hover:bg-white/[0.06] hover:text-ed-text',
            )}
          >
            {option.name}
          </button>
        ))}
      </div>
    </div>
  )
}

export function PanelHint({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[10px] leading-4 text-ed-dim">{children}</p>
}

export function IconAction({
  label,
  active,
  onClick,
  children,
  disabled,
}: {
  label: string
  active?: boolean
  onClick: () => void
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'grid size-6 place-items-center rounded-[3px] transition-colors disabled:opacity-35',
        active ? 'bg-ed-accent text-white' : 'text-ed-dim hover:enabled:bg-white/[0.07] hover:enabled:text-ed-text',
      )}
    >
      {children}
    </button>
  )
}
