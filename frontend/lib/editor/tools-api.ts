/**
 * Client for the Python tool endpoints.
 *
 * Every sidebar control is described by the catalog and every pixel is produced
 * by the backend, so this module is the only place the editor learns what the
 * tools can do or what they look like.
 */

import { apiFetch } from '@/lib/api'
import type { Crop, Doc } from './doc'

// --- Catalog ---------------------------------------------------------------

export type Option = { id: string; label: string }
export type SliderDefinition = { id: string; label: string }
export type SliderRange = { min: number; max: number; step: number; neutral: number }

export type AdjustGroup = { id: string; label: string; sliders: SliderDefinition[] }

export type FilterPresetInfo = {
  id: string
  label: string
  spansFullWidth: boolean
  variants: Option[]
}

export type AspectPreset = { id: string; label: string; ratio: number | null }

export type TextDesignInfo = {
  id: string
  label: string
  lineCount: number
  variantCount: number
  sample: string[]
}

export type PrintSizeInfo = {
  id: string
  label: string
  detail: string
  portrait: { width: number; height: number }
  landscape: { width: number; height: number }
}

export type ArtStyleInfo = {
  id: string
  label: string
  detail: string
  /** A CSS filter hinting at the style, applied to a thumbnail in the grid. */
  previewFilter: string
}

export type ToolCatalog = {
  adjust: { groups: AdjustGroup[]; range: SliderRange }
  filters: FilterPresetInfo[]
  transform: { aspectPresets: AspectPreset[] }
  focus: { types: Option[] }
  text: {
    fontFamilies: Option[]
    defaults: {
      fontFamily: string
      fontSize: number
      fill: string
      background: string
      align: 'left' | 'center' | 'right' | 'justify'
      lineHeight: number
    }
  }
  textDesigns: TextDesignInfo[]
  brush: { defaults: { size: number; hardness: number; color: string } }
  colorSwatches: string[]
  ai: {
    artStyles: ArtStyleInfo[]
    styleIntensities: Option[]
    magicEditOperations: Array<Option & { detail: string }>
    printSizes: PrintSizeInfo[]
    upscaleScales: number[]
  }
}

let catalogRequest: Promise<ToolCatalog> | null = null

/** The catalog never changes at runtime, so it is fetched once per session. */
export function fetchCatalog(): Promise<ToolCatalog> {
  catalogRequest ??= apiFetch('/tools/catalog').then(
    (response) => response.json() as Promise<ToolCatalog>,
  )
  return catalogRequest
}

// --- Rendering -------------------------------------------------------------

export type LayerSprite = {
  id: string
  image: string
  x: number
  y: number
  width: number
  height: number
}

export type PreviewResult = {
  background: string
  orientedWidth: number
  orientedHeight: number
  crop: Crop
  scale: number
  layers: LayerSprite[]
}

/**
 * The document as the backend expects it. Layer position, rotation, and scale
 * are included so exports match, even though the canvas applies them locally.
 */
export function serializeDoc(doc: Doc) {
  return {
    crop: doc.crop,
    rotation: doc.rotation,
    quarterTurns: doc.quarterTurns,
    flipX: doc.flipX,
    flipY: doc.flipY,
    keepResolution: doc.keepResolution,
    adjust: doc.adjust,
    filter: doc.filter,
    focus: doc.focus,
    layers: doc.layers,
  }
}

/**
 * Values the backend needs to redraw. Layer transforms are deliberately left
 * out: moving a sprite is handled on the canvas and must not cost a round trip.
 */
export function renderKey(doc: Doc) {
  return JSON.stringify({
    crop: doc.crop,
    rotation: doc.rotation,
    quarterTurns: doc.quarterTurns,
    flipX: doc.flipX,
    flipY: doc.flipY,
    adjust: doc.adjust,
    filter: doc.filter,
    focus: doc.focus,
    layers: doc.layers.map((layer) =>
      layer.kind === 'stroke'
        ? layer
        : { ...layer, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    ),
  })
}

function documentBody(source: Blob, name: string, doc: Doc) {
  const body = new FormData()
  body.set('image', source, name)
  body.set('document', JSON.stringify(serializeDoc(doc)))
  return body
}

export async function renderPreview(
  source: Blob,
  name: string,
  doc: Doc,
  maxEdge: number,
  signal?: AbortSignal,
): Promise<PreviewResult> {
  const body = documentBody(source, name, doc)
  body.set('max_edge', String(Math.round(maxEdge)))
  const response = await apiFetch('/tools/preview', { method: 'POST', body, signal })
  return response.json() as Promise<PreviewResult>
}

/** The authoritative full-resolution flatten, used for Save and the AI tools. */
export async function composeDocument(source: Blob, name: string, doc: Doc): Promise<Blob> {
  const response = await apiFetch('/tools/compose', {
    method: 'POST',
    body: documentBody(source, name, doc),
  })
  return response.blob()
}

export type ThumbnailKind = 'filters' | 'focus'

export async function fetchThumbnails(
  source: Blob,
  name: string,
  kinds: ThumbnailKind[],
  signal?: AbortSignal,
): Promise<Partial<Record<ThumbnailKind, Record<string, string>>>> {
  const body = new FormData()
  body.set('image', source, name)
  body.set('kinds', kinds.join(','))
  const response = await apiFetch('/tools/thumbnails', { method: 'POST', body, signal })
  return response.json() as Promise<Partial<Record<ThumbnailKind, Record<string, string>>>>
}

export async function fetchTextDesignPreviews(
  color: string,
  signal?: AbortSignal,
): Promise<Record<string, string>> {
  const response = await apiFetch(
    `/tools/text-design-previews?color=${encodeURIComponent(color)}`,
    { signal },
  )
  return response.json() as Promise<Record<string, string>>
}

export type UpscalePlan = {
  mode: 'faithful' | 'ai'
  scale: number
  width: number
  height: number
  actualScale: number
}

export async function fetchUpscalePlans(width: number, height: number): Promise<UpscalePlan[]> {
  const response = await apiFetch(
    `/tools/upscale-plan?width=${Math.round(width)}&height=${Math.round(height)}`,
  )
  const payload = (await response.json()) as { plans: UpscalePlan[] }
  return payload.plans
}
