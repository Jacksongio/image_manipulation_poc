'use client'

import { TriangleAlert, X } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState } from 'react'
import type { SourceImage } from '@/lib/editor/doc'
import { downloadBlob, exportFilename } from '@/lib/editor/export'
import { messageFromError } from '@/lib/editor/image'
import type { ToolCatalog } from '@/lib/editor/tools-api'
import { ToolPanel } from './tool-panel'
import { ToolRail } from './tool-rail'
import { TopBar } from './top-bar'
import { TransformBar } from './transform-bar'
import { useEditor } from './use-editor'

const CanvasStage = dynamic(() => import('./stage/canvas-stage').then((module) => module.CanvasStage), {
  ssr: false,
  loading: () => <div className="grid min-h-0 flex-1 place-items-center bg-ed-stage text-[12px] text-ed-dim">Loading canvas…</div>,
})

export function EditorShell({
  source,
  catalog,
  onClose,
}: {
  source: SourceImage
  catalog: ToolCatalog
  onClose: () => void
}) {
  const editor = useEditor(source, catalog, onClose)
  const [saving, setSaving] = useState(false)

  // Saving asks the backend to flatten, so the download is the authoritative render.
  const save = useCallback(async () => {
    setSaving(true)
    try {
      const blob = await editor.flatten()
      downloadBlob(blob, exportFilename(editor.doc.source.name, 'edited'))
    } catch (error) {
      editor.setError(messageFromError(error))
    } finally {
      setSaving(false)
    }
  }, [editor])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable
      const meta = event.metaKey || event.ctrlKey

      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) editor.redo()
        else editor.undo()
        return
      }
      if (meta && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        editor.redo()
        return
      }
      if (meta && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void save()
        return
      }
      if (typing) return
      if (event.key === 'Escape') {
        editor.setSelectedId(null)
        editor.setEditingId(null)
        return
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && editor.selectedId) {
        event.preventDefault()
        editor.removeLayer(editor.selectedId)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editor, save])

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ed-stage text-ed-text">
      <TopBar
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onUndo={editor.undo}
        onRedo={editor.redo}
        zoom={editor.zoom}
        onZoomIn={editor.zoomIn}
        onZoomOut={editor.zoomOut}
        onZoomFit={editor.zoomFit}
        onSave={() => void save()}
        onClose={onClose}
        saving={saving}
      />

      <div className="flex min-h-0 flex-1">
        <ToolRail active={editor.tool} onSelect={editor.setTool} />
        <ToolPanel editor={editor} />
        <div className="flex min-w-0 flex-1 flex-col">
          <CanvasStage editor={editor} />
          {editor.tool === 'transform' ? <TransformBar editor={editor} /> : null}
        </div>
      </div>

      {editor.error ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="pointer-events-auto flex max-w-md items-start gap-2 rounded-md bg-[#2a1414] px-3 py-2 text-[11px] leading-4 text-red-200 shadow-xl shadow-black/50 ring-1 ring-red-500/30">
            <TriangleAlert className="mt-px size-3.5 shrink-0" />
            <span className="flex-1">{editor.error}</span>
            <button type="button" aria-label="Dismiss" onClick={() => editor.setError(null)} className="text-red-200/70 hover:text-white">
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
