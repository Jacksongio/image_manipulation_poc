export type SourceImage = {
  blob: Blob
  url: string
  width: number
  height: number
  name: string
}

export type Crop = { x: number; y: number; width: number; height: number }

export const ADJUST_KEYS = [
  'brightness',
  'contrast',
  'saturation',
  'gamma',
  'clarity',
  'shadows',
  'highlights',
  'exposure',
  'blacks',
  'whites',
  'temperature',
  'sharpness',
] as const

export type AdjustKey = (typeof ADJUST_KEYS)[number]
export type Adjust = Record<AdjustKey, number>

export const NEUTRAL_ADJUST: Adjust = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  gamma: 0,
  clarity: 0,
  shadows: 0,
  highlights: 0,
  exposure: 0,
  blacks: 0,
  whites: 0,
  temperature: 0,
  sharpness: 0,
}

export type FocusType = 'radial' | 'mirrored' | 'linear' | 'gaussian'

export type Focus = {
  type: FocusType
  intensity: number
  /** Centre of the focus region, in oriented-image pixels. */
  x: number
  y: number
  /** Radius of the sharp region, in oriented-image pixels. */
  radius: number
  /** Rotation of directional focus types, in degrees. */
  angle: number
}

export type TextAlign = 'left' | 'center' | 'right' | 'justify'

export type TextLayer = {
  kind: 'text'
  id: string
  x: number
  y: number
  width: number
  rotation: number
  scaleX: number
  scaleY: number
  text: string
  fontFamily: string
  fontSize: number
  fill: string
  background: string
  align: TextAlign
  lineHeight: number
}

export type TextDesignLayer = {
  kind: 'textDesign'
  id: string
  x: number
  y: number
  width: number
  rotation: number
  scaleX: number
  scaleY: number
  template: string
  variant: number
  lines: string[]
  color: string
  inverted: boolean
}

export type StrokeLayer = {
  kind: 'stroke'
  id: string
  points: number[]
  color: string
  size: number
  hardness: number
}

export type Layer = TextLayer | TextDesignLayer | StrokeLayer

export type Doc = {
  source: SourceImage
  crop: Crop | null
  /** Fine rotation in degrees, kept in the -45..45 range the slider exposes. */
  rotation: number
  /** Whole 90 degree turns applied before the fine rotation. */
  quarterTurns: number
  flipX: boolean
  flipY: boolean
  keepResolution: boolean
  adjust: Adjust
  filter: { id: string | null; intensity: number }
  focus: Focus | null
  layers: Layer[]
}

export function createDoc(source: SourceImage): Doc {
  return {
    source,
    crop: null,
    rotation: 0,
    quarterTurns: 0,
    flipX: false,
    flipY: false,
    keepResolution: false,
    adjust: { ...NEUTRAL_ADJUST },
    filter: { id: null, intensity: 50 },
    focus: null,
    layers: [],
  }
}

export function isAdjusted(adjust: Adjust) {
  return ADJUST_KEYS.some((key) => adjust[key] !== 0)
}

export function hasGeometry(doc: Doc) {
  return doc.crop !== null || doc.rotation !== 0 || doc.quarterTurns !== 0 || doc.flipX || doc.flipY
}

export function layerId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}
