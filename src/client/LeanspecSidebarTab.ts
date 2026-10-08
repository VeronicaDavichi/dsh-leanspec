import { createElement, useEffect, type ReactElement } from 'react'
import { LeanspecViewer } from './LeanspecViewer.ts'
import { LEANSPEC_TAB_TITLE } from './tab-surface.ts'
import { noteTabMounted, noteTabUnmounted } from './tab-registration.ts'

/**
 * The right-sidebar tab body (specs/007 T2.2, T2.3, T2.6; REQ-3, REQ-4.1).
 *
 * Registered under the keyed `sidebar.right.pane.tab` seat, keyed by
 * `LEANSPEC_TAB_ID`. It is the *same* panel the popup renders — the host pane
 * already draws the tab frame, so wrapping this in the popup shell would nest a
 * second border, shadow and rounded corner.
 *
 * It always renders the panel: this component existing *is* the proof that the
 * host has our tab on screen (2026-10-08 decision — the tab is one-way, we never
 * close it, so there is no "the tab is gone but still mounted" state to draw
 * around). Mount and unmount are therefore the two facts the store needs, and
 * they are published from one effect.
 */
export function LeanspecSidebarTab(): ReactElement {
  useEffect(() => {
    noteTabMounted()
    return () => {
      noteTabUnmounted()
    }
  }, [])
  return createElement(LeanspecTabView)
}

/**
 * What the tab body draws. Hook-free, so the render tests can call it directly
 * and assert that the panel — and nothing else — is what a tab shows.
 */
export function LeanspecTabView(): ReactElement {
  return createElement(
    'div',
    { className: 'dsh-leanspec-tab' },
    createElement(LeanspecViewer, {}),
  )
}

/**
 * The tab chip's live title, registered under the keyed
 * `sidebar.right.pane.tab.title` seat with the same key.
 *
 * The host also captures `definition.title(address)` when the tab opens; this
 * one exists so the chip keeps its text independently of that snapshot, and so
 * a later state marker has one place to live. Hook-free and testable directly.
 */
export function LeanspecTabTitle(): ReactElement {
  return createElement('span', { className: 'dsh-leanspec-tab-title' }, LEANSPEC_TAB_TITLE)
}
