'use client'

import { useEffect, useRef, useState } from 'react'
import type { Doc } from './doc'
import { loadImageElement, messageFromError } from './image'
import type { LayerSprite, PreviewResult } from './tools-api'
import { renderKey, renderPreview } from './tools-api'

/** Longest edge requested while a control is being dragged. */
const INTERACTIVE_EDGE = 900
/** Longest edge requested once things settle, for a crisper canvas. */
const SETTLED_EDGE = 1600
/** How long to wait after the last change before asking the backend to redraw. */
const DEBOUNCE_MS = 90
/** How long after that to fetch the higher-resolution version. */
const SETTLE_MS = 400

export type LoadedSprite = LayerSprite & { element: HTMLImageElement }

export type RenderState = {
  background: HTMLImageElement | null
  sprites: Map<string, LoadedSprite>
  orientedWidth: number
  orientedHeight: number
  crop: { x: number; y: number; width: number; height: number }
  /** True while a redraw is in flight, so the UI can show it is catching up. */
  pending: boolean
  error: string | null
}

async function loadRender(result: PreviewResult) {
  const [background, sprites] = await Promise.all([
    loadImageElement(result.background),
    Promise.all(
      result.layers.map(async (layer) => ({
        ...layer,
        element: await loadImageElement(layer.image),
      })),
    ),
  ])
  return { background, sprites }
}

/**
 * Keeps the canvas in step with the backend renderer.
 *
 * Only changes that affect pixels trigger a request; moving or rotating a layer
 * is handled on the canvas, because the sprite it draws is already correct.
 */
export function useRender(doc: Doc): RenderState {
  const [state, setState] = useState<RenderState>({
    background: null,
    sprites: new Map(),
    orientedWidth: doc.source.width,
    orientedHeight: doc.source.height,
    crop: { x: 0, y: 0, width: doc.source.width, height: doc.source.height },
    pending: true,
    error: null,
  })

  const key = renderKey(doc)
  const latest = useRef(doc)
  latest.current = doc

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    let settleTimer = 0

    const request = async (maxEdge: number) => {
      const current = latest.current
      const result = await renderPreview(
        current.source.blob,
        current.source.name,
        current,
        maxEdge,
        controller.signal,
      )
      const loaded = await loadRender(result)
      if (cancelled) return
      setState({
        background: loaded.background,
        sprites: new Map(loaded.sprites.map((sprite) => [sprite.id, sprite])),
        orientedWidth: result.orientedWidth,
        orientedHeight: result.orientedHeight,
        crop: result.crop,
        pending: false,
        error: null,
      })
    }

    setState((current) => ({ ...current, pending: true }))

    const debounce = window.setTimeout(() => {
      request(INTERACTIVE_EDGE)
        .then(() => {
          // Re-request at full preview quality once the user stops interacting.
          settleTimer = window.setTimeout(() => {
            void request(SETTLED_EDGE).catch(() => undefined)
          }, SETTLE_MS)
        })
        .catch((error: unknown) => {
          if (cancelled || controller.signal.aborted) return
          setState((current) => ({ ...current, pending: false, error: messageFromError(error) }))
        })
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      controller.abort()
      window.clearTimeout(debounce)
      window.clearTimeout(settleTimer)
    }
  }, [key, doc.source])

  return state
}
