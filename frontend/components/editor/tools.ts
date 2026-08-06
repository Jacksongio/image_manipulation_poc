import {
  Aperture,
  Bookmark,
  Brush,
  Contrast,
  Crop,
  Droplet,
  Frame,
  type LucideIcon,
  Maximize2,
  Palette,
  Type,
  WandSparkles,
} from 'lucide-react'

export type ToolId =
  | 'transform'
  | 'adjust'
  | 'filters'
  | 'text'
  | 'text-design'
  | 'brush'
  | 'focus'
  | 'magic-edit'
  | 'art-style'
  | 'upscaler'
  | 'border-expander'

export type Tool = { id: ToolId; label: string; icon: LucideIcon }

export const EDIT_TOOLS: Tool[] = [
  { id: 'transform', label: 'Transform', icon: Crop },
  { id: 'adjust', label: 'Adjust', icon: Droplet },
  { id: 'filters', label: 'Filters', icon: Contrast },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'text-design', label: 'Text Design', icon: Bookmark },
  { id: 'brush', label: 'Brush', icon: Brush },
  { id: 'focus', label: 'Focus', icon: Aperture },
]

export const AI_TOOLS: Tool[] = [
  { id: 'magic-edit', label: 'Magic Edit', icon: WandSparkles },
  { id: 'art-style', label: 'Art Style', icon: Palette },
  { id: 'upscaler', label: 'Upscaler', icon: Maximize2 },
  { id: 'border-expander', label: 'Border Expander', icon: Frame },
]

export const ALL_TOOLS = [...EDIT_TOOLS, ...AI_TOOLS]

export function toolLabel(id: ToolId) {
  return ALL_TOOLS.find((tool) => tool.id === id)?.label ?? ''
}

export function isAiTool(id: ToolId) {
  return AI_TOOLS.some((tool) => tool.id === id)
}
