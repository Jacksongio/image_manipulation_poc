'use client'

import { useEffect, useState } from 'react'
import type { SourceImage } from '@/lib/editor/doc'
import { fetchTextDesignPreviews, fetchThumbnails, type ThumbnailKind } from '@/lib/editor/tools-api'

type Tiles = Record<string, string>

/**
 * Preview tiles for the Filters and Focus grids, rendered by the backend from
 * the user's own image. Fetched once per upload rather than per edit, since the
 * tiles show what each option does rather than the current state.
 */
export function useToolThumbnails(source: SourceImage, kind: ThumbnailKind): Tiles {
  const [tiles, setTiles] = useState<Tiles>({})

  useEffect(() => {
    const controller = new AbortController()
    fetchThumbnails(source.blob, source.name, [kind], controller.signal)
      .then((result) => setTiles(result[kind] ?? {}))
      .catch(() => undefined)
    return () => controller.abort()
  }, [source, kind])

  return tiles
}

/** Sample tiles for the Text Design grid, which depend only on the chosen colour. */
export function useTextDesignPreviews(color: string): Tiles {
  const [tiles, setTiles] = useState<Tiles>({})

  useEffect(() => {
    const controller = new AbortController()
    fetchTextDesignPreviews(color, controller.signal)
      .then(setTiles)
      .catch(() => undefined)
    return () => controller.abort()
  }, [color])

  return tiles
}
