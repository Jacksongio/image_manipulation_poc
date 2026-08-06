import type { SourceImage } from './doc'

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
export const MAX_SOURCE_EDGE = 2048

export function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong'
}

export function canvasBlob(canvas: HTMLCanvasElement, type = 'image/png') {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not prepare the image'))), type)
  })
}

export function createCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  return canvas
}

export function context2d(canvas: HTMLCanvasElement, options?: CanvasRenderingContext2DSettings) {
  const context = canvas.getContext('2d', options)
  if (!context) throw new Error('Canvas is unavailable in this browser')
  return context
}

/** Downscales an upload to a workable edit resolution and hands back a stable PNG blob. */
export async function normalizeImage(file: File): Promise<SourceImage> {
  if (!file.type.startsWith('image/')) throw new Error('Choose a PNG, JPEG, or WebP image')
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('Images must be 20 MB or smaller')

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SOURCE_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = createCanvas(width, height)
  context2d(canvas).drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await canvasBlob(canvas)
  return { blob, url: URL.createObjectURL(blob), width, height, name: file.name }
}

export async function sourceFromBlob(blob: Blob, name: string): Promise<SourceImage> {
  const bitmap = await createImageBitmap(blob)
  const { width, height } = bitmap
  bitmap.close()
  return { blob, url: URL.createObjectURL(blob), width, height, name }
}

/** Loads an image element from a URL or data URL, ready for Konva to draw. */
export function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not load the rendered image'))
    image.src = src
  })
}
