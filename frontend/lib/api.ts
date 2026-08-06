// Unset means the local dev backend; an empty string means same-origin
// (the single-container deployment where FastAPI serves the frontend).
const rawUrl = process.env.NEXT_PUBLIC_API_URL
const configuredUrl = rawUrl === undefined ? 'http://127.0.0.1:8008' : rawUrl.replace(/\/$/, '')

export function backendUrl(path: string) {
  return `${configuredUrl}${path}`
}

export async function apiFetch(path: string, init?: RequestInit) {
  let response: Response
  try {
    response = await fetch(backendUrl(path), init)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw new Error('The backend is offline. Start it with: pnpm dev:backend')
  }
  if (!response.ok) {
    const value: unknown = await response.json().catch(() => null)
    const detail = typeof value === 'object' && value !== null && 'detail' in value && typeof value.detail === 'string'
      ? value.detail
      : `The backend request failed (HTTP ${response.status})`
    throw new Error(detail)
  }
  return response
}
