'use client'

import { cn } from '@/lib/utils'
import { AI_TOOLS, EDIT_TOOLS, type Tool, type ToolId } from './tools'

function RailButton({ tool, active, onSelect }: { tool: Tool; active: boolean; onSelect: (id: ToolId) => void }) {
  const Icon = tool.icon
  return (
    <button
      type="button"
      title={tool.label}
      aria-label={tool.label}
      aria-pressed={active}
      onClick={() => onSelect(tool.id)}
      className={cn(
        'group relative grid h-9 w-full place-items-center transition-colors',
        active ? 'text-ed-accent' : 'text-[#6f6f6f] hover:text-ed-text',
      )}
    >
      <Icon className="size-[15px]" strokeWidth={1.6} />
      {active ? <span className="absolute inset-y-1 left-0 w-[2px] rounded-r bg-ed-accent" /> : null}
      <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-[3px] bg-black/90 px-2 py-1 text-[10px] font-medium text-white shadow-lg group-hover:block">
        {tool.label}
      </span>
    </button>
  )
}

export function ToolRail({ active, onSelect }: { active: ToolId; onSelect: (id: ToolId) => void }) {
  return (
    <nav aria-label="Editor tools" className="flex w-11 shrink-0 flex-col items-center gap-0.5 border-r border-ed-line bg-ed-rail py-2">
      {EDIT_TOOLS.map((tool) => (
        <RailButton key={tool.id} tool={tool} active={active === tool.id} onSelect={onSelect} />
      ))}
      <div className="my-1.5 h-px w-5 bg-ed-line" />
      {AI_TOOLS.map((tool) => (
        <RailButton key={tool.id} tool={tool} active={active === tool.id} onSelect={onSelect} />
      ))}
    </nav>
  )
}
