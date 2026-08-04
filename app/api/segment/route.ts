import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const MAX_IMAGE_BYTES = 20 * 1024 * 1024

export async function GET() {
  const serviceUrl = process.env.SAM3_SERVICE_URL ?? 'http://127.0.0.1:8008'
  try {
    const response = await fetch(`${serviceUrl}/health`, { cache: 'no-store' })
    if (!response.ok) throw new Error('SAM 3 service is not ready')
    return NextResponse.json(await response.json())
  } catch {
    return NextResponse.json(
      { ok: false, detail: 'Start the local SAM 3 service with pnpm dev:sam3' },
      { status: 503 },
    )
  }
}

export async function POST(request: Request) {
  const input = await request.formData()
  const image = input.get('image')
  const points = input.get('points')

  if (!(image instanceof File) || typeof points !== 'string') {
    return NextResponse.json({ detail: 'An image and selection points are required' }, { status: 400 })
  }
  if (!image.type.startsWith('image/') || image.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ detail: 'Choose an image up to 20 MB' }, { status: 400 })
  }

  const serviceUrl = process.env.SAM3_SERVICE_URL ?? 'http://127.0.0.1:8008'
  const body = new FormData()
  body.set('image', image, 'source.png')
  body.set('points', points)

  try {
    const response = await fetch(`${serviceUrl}/segment`, { method: 'POST', body })
    const result: unknown = await response.json()
    if (!response.ok) {
      const detail =
        typeof result === 'object' && result !== null && 'detail' in result && typeof result.detail === 'string'
          ? result.detail
          : 'SAM 3 could not segment this image'
      return NextResponse.json({ detail }, { status: response.status })
    }
    return NextResponse.json(result)
  } catch {
    return NextResponse.json(
      { detail: 'The local SAM 3 service is offline. Run pnpm dev:sam3.' },
      { status: 503 },
    )
  }
}
