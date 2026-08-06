'use client'

import { useCallback, useMemo, useReducer } from 'react'
import type { Doc } from './doc'

const HISTORY_LIMIT = 40

type State = { past: Doc[]; present: Doc; future: Doc[] }

type Action =
  | { type: 'checkpoint' }
  | { type: 'update'; producer: (doc: Doc) => Doc; checkpoint: boolean }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'replace'; doc: Doc }

function push(past: Doc[], doc: Doc) {
  const next = past.length >= HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT + 1) : past
  return [...next, doc]
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'checkpoint':
      return { past: push(state.past, state.present), present: state.present, future: [] }
    case 'update': {
      const present = action.producer(state.present)
      if (present === state.present) return state
      if (!action.checkpoint) return { ...state, present, future: [] }
      return { past: push(state.past, state.present), present, future: [] }
    }
    case 'undo': {
      const previous = state.past.at(-1)
      if (!previous) return state
      return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future] }
    }
    case 'redo': {
      const [next, ...rest] = state.future
      if (!next) return state
      return { past: push(state.past, state.present), present: next, future: rest }
    }
    case 'replace':
      return { past: [], present: action.doc, future: [] }
  }
}

export function useDocHistory(initial: Doc) {
  const [state, dispatch] = useReducer(reducer, { past: [], present: initial, future: [] })

  const update = useCallback(
    (producer: (doc: Doc) => Doc, options?: { checkpoint?: boolean }) =>
      dispatch({ type: 'update', producer, checkpoint: options?.checkpoint ?? true }),
    [],
  )
  const checkpoint = useCallback(() => dispatch({ type: 'checkpoint' }), [])
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])
  const replace = useCallback((doc: Doc) => dispatch({ type: 'replace', doc }), [])

  return useMemo(
    () => ({
      doc: state.present,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      update,
      checkpoint,
      undo,
      redo,
      replace,
    }),
    [state.present, state.past.length, state.future.length, update, checkpoint, undo, redo, replace],
  )
}

export type DocHistory = ReturnType<typeof useDocHistory>
