/**
 * Save plumbing. The pixels come from the backend's compose endpoint, so all
 * that is left here is handing the browser a download.
 */

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportFilename(sourceName: string, suffix: string) {
  const base = sourceName.replace(/\.[^.]+$/, '') || 'image'
  return `${base}-${suffix}.png`
}
