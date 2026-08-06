'use client'

import { cn } from '@/lib/utils'

export type ObjectAction = { id: string; label: string; disabled?: boolean; onClick: () => void }

export function ObjectToolbar({
  rect,
  actions,
}: {
  rect: { x: number; y: number; width: number; height: number }
  actions: ObjectAction[]
}) {
  return (
    <div
      className="pointer-events-none absolute z-20"
      style={{ left: rect.x + rect.width / 2, top: Math.max(4, rect.y - 8), transform: 'translate(-50%, -100%)' }}
    >
      <div className="pointer-events-auto flex overflow-hidden rounded-[3px] bg-[#1c1c1c] shadow-lg shadow-black/60 ring-1 ring-black/50">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            disabled={action.disabled}
            onClick={action.onClick}
            className={cn(
              'border-r border-black/60 px-2 py-1 text-[10px] font-medium transition-colors last:border-r-0',
              action.disabled ? 'cursor-default text-[#5a5a5a]' : 'text-ed-text hover:bg-white/[0.09] hover:text-white',
            )}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}
