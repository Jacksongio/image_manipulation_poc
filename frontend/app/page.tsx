'use client'

import { useCallback, useEffect, useState } from 'react'
import { EditorShell } from '@/components/editor/editor-shell'
import { UploadScreen } from '@/components/editor/upload-screen'
import type { SourceImage } from '@/lib/editor/doc'
import { messageFromError, normalizeImage } from '@/lib/editor/image'
import { fetchCatalog, type ToolCatalog } from '@/lib/editor/tools-api'

export default function Page() {
  const [source, setSource] = useState<SourceImage | null>(null)
  const [catalog, setCatalog] = useState<ToolCatalog | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The sidebar is built from the backend's tool catalog, so it loads up front.
  useEffect(() => {
    fetchCatalog()
      .then(setCatalog)
      .catch((cause: unknown) => setError(messageFromError(cause)))
  }, [])

  const load = useCallback(async (file: File) => {
    setBusy(true)
    setError(null)
    try {
      setSource(await normalizeImage(file))
    } catch (cause) {
      setError(messageFromError(cause))
    } finally {
      setBusy(false)
    }
  }, [])

  if (!source || !catalog) {
    return (
      <UploadScreen
        onFile={(file) => void load(file)}
        busy={busy || (!catalog && !error)}
        error={error}
      />
    )
  }

  return (
    <EditorShell
      key={source.url}
      source={source}
      catalog={catalog}
      onClose={() => setSource(null)}
    />
  )
}
