import { useEffect, useState } from 'react'
import {
  PANEL_STORAGE_KEY,
  SPLIT_STORAGE_KEY,
  readStoredPanel,
  readStoredSplit,
  type PanelSize,
} from './surface.ts'
import {
  initialViewerState,
  reduceViewer,
  type ViewerAction,
  type ViewerState,
} from './viewer-state.ts'

/** One immutable value plus a listener set — enough for a plugin-sized app. */
export interface Store<T> {
  getState(): T
  setState(next: T): void
  /** Returns the unsubscribe function: the plugin contract wants clean teardown. */
  subscribe(listener: () => void): () => void
}

/** Minimal observable. Kept generic so `test/store.test.ts` can drive it in Node. */
export function createStore<T>(initial: T): Store<T> {
  let current = initial
  const listeners = new Set<() => void>()
  return {
    getState: () => current,
    setState(next: T): void {
      if (Object.is(next, current)) return
      current = next
      // Copy first: a listener may unsubscribe (or subscribe) while we notify.
      for (const listener of [...listeners]) listener()
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/**
 * The panel's single source of truth.
 *
 * Module-level on purpose: the popup and the right-sidebar tab are two exits of
 * one panel, so the selected file, the draft and the split must not diverge
 * between them (design.md §3, REQ-3.4).
 */
export const viewerStore = createStore<ViewerState>(initialViewerState)

/**
 * Subscribe a component to {@link viewerStore}.
 *
 * Returns the same `[state, dispatch]` pair the component used to get from
 * `useReducer`, so the swap stays local to the hook call.
 */
export function useViewerStore(): [ViewerState, (action: ViewerAction) => void] {
  const [state, setState] = useState<ViewerState>(() => viewerStore.getState())
  useEffect(() => {
    return viewerStore.subscribe(() => {
      setState(viewerStore.getState())
    })
  }, [])
  return [
    state,
    (action: ViewerAction): void => {
      viewerStore.setState(reduceViewer(viewerStore.getState(), action))
    },
  ]
}

/** Last persisted tree width, or the default when storage is absent or blocked. */
export function loadPersistedSplit(): number {
  try {
    return readStoredSplit(window.localStorage.getItem(SPLIT_STORAGE_KEY))
  } catch {
    // No `window`, or storage denied by policy.
    return readStoredSplit(null)
  }
}

/** Persist the tree width. A blocked `localStorage` must not break the drag. */
export function persistSplit(value: number): void {
  try {
    window.localStorage.setItem(SPLIT_STORAGE_KEY, String(value))
  } catch {
    // Private mode / disabled storage: keep the in-memory value only.
  }
}

/**
 * Last persisted popover size, or the default when storage is absent or blocked.
 *
 * One key for the whole browser profile on purpose (specs/010 D-5): the size is
 * a property of the popover, not of a session or a project.
 */
export function loadPersistedPanel(): PanelSize {
  try {
    return readStoredPanel(window.localStorage.getItem(PANEL_STORAGE_KEY))
  } catch {
    // No `window`, or storage denied by policy.
    return readStoredPanel(null)
  }
}

/** Persist the popover size. A blocked `localStorage` must not break the drag. */
export function persistPanel(value: PanelSize): void {
  try {
    window.localStorage.setItem(
      PANEL_STORAGE_KEY,
      JSON.stringify({ width: value.width, height: value.height }),
    )
  } catch {
    // Private mode / disabled storage: keep the in-memory value only.
  }
}
