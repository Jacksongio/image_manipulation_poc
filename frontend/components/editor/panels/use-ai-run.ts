'use client'

import { useCallback } from 'react'
import { messageFromError } from '@/lib/editor/image'
import type { Editor } from '../use-editor'

/**
 * Every AI tool works on the flattened frame and swaps the result in as the new
 * base image, so one Undo takes the user back to the pre-AI document.
 */
export function useAiRun(editor: Editor) {
  return useCallback(
    async (label: string, work: (flattened: Blob) => Promise<Blob>) => {
      if (editor.busy) return
      editor.setBusy(label)
      editor.setError(null)
      try {
        const flattened = await editor.flatten()
        const result = await work(flattened)
        await editor.replaceSource(result, editor.doc.source.name)
      } catch (error) {
        editor.setError(messageFromError(error))
      } finally {
        editor.setBusy(null)
      }
    },
    [editor],
  )
}
