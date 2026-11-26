import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ReactElement } from 'react'

import { LeanspecHeaderView } from '../src/client/LeanspecHeaderAction.ts'
import { PANEL_DEFAULT, PANEL_HEIGHT, PANEL_MIN_HEIGHT, PANEL_MIN_WIDTH, PANEL_WIDTH } from '../src/client/surface.ts'
import type { TabCapability } from '../src/client/tab-surface.ts'

/**
 * specs/010 — the popover's resize handle and the size it renders.
 *
 * Structural assertions only: no renderer, no DOM. The pointer arithmetic is
 * covered by `surface.test.ts` (`panelFromDrag`) and the CSS caps by
 * `popover-metrics.test.ts`; this file pins down what the header *shows*.
 */

const AVAILABLE: TabCapability = {
  canOpen: true,
  registered: true,
  available: true,
}

const BASE = {
  open: true,
  surface: 'popup' as const,
  capability: AVAILABLE,
  failure: null,
  onToggle: () => undefined,
  onSwitchToTab: () => undefined,
}

function walk(node: unknown, out: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, out)
    return out
  }
  if (node === null || typeof node !== 'object') return out
  const element = node as ReactElement & { props?: { children?: unknown } }
  if (element.props === undefined) return out
  out.push(element)
  walk(element.props.children, out)
  return out
}

function propsOf(tree: unknown, predicate: (props: Record<string, unknown>) => boolean): Record<string, unknown>[] {
  return walk(tree)
    .map(element => element.props as Record<string, unknown>)
    .filter(props => predicate(props))
}

function popoverOf(tree: unknown): Record<string, unknown> | undefined {
  return propsOf(tree, props => String(props.className ?? '') === 'dsh-leanspec-popover')[0]
}

function handleOf(tree: unknown): Record<string, unknown> | undefined {
  return propsOf(tree, props => props['data-leanspec-resize'] === 'true')[0]
}

test('the popover carries the user size as CSS custom properties (REQ-2.2, T2.3)', () => {
  const view = LeanspecHeaderView({
    ...BASE,
    anchor: 56,
    panel: { width: 820, height: 540 },
  })
  assert.deepEqual(popoverOf(view)?.style, {
    '--anchor': '56px',
    '--panel-w': '820px',
    '--panel-h': '540px',
  })
})

test('without a panel the style stays the pre-010 anchor-only object', () => {
  const view = LeanspecHeaderView({ ...BASE, anchor: 56 })
  assert.deepEqual(popoverOf(view)?.style, { '--anchor': '56px' })
  // And with neither a measurement nor a size, nothing is injected at all.
  assert.equal(popoverOf(LeanspecHeaderView({ ...BASE }))?.style, undefined)
})

test('the handle is a focusable, labelled control inside the dialog (REQ-6.1)', () => {
  const view = LeanspecHeaderView({ ...BASE, panel: PANEL_DEFAULT })
  const handle = handleOf(view)
  assert.ok(handle, 'the handle is rendered with the popover')
  assert.equal(handle.role, 'button')
  assert.equal(handle.tabIndex, 0)
  assert.match(String(handle['aria-label']), /调整弹窗大小/)
  // Never a nested interactive element: the dialog is not a button.
  assert.equal(popoverOf(view)?.role, 'dialog')
})

test('every resize gesture is wired to the host component (T2.1, T2.2)', () => {
  const calls: string[] = []
  const view = LeanspecHeaderView({
    ...BASE,
    panel: PANEL_DEFAULT,
    onResizePointerDown: () => { calls.push('down') },
    onResizePointerMove: () => { calls.push('move') },
    onResizeEnd: () => { calls.push('end') },
    onResizeKeyDown: () => { calls.push('key') },
    onResizeReset: () => { calls.push('reset') },
  })
  const handle = handleOf(view) as Record<string, unknown>
  for (const key of ['onPointerDown', 'onPointerMove', 'onPointerUp', 'onPointerCancel', 'onKeyDown', 'onDoubleClick']) {
    assert.equal(typeof handle[key], 'function', `${key} is routed`)
  }
  // The pointer-cancel handler is the release handler: both end the drag.
  assert.equal(handle.onPointerCancel, handle.onPointerUp)

  ;(handle.onPointerDown as () => void)()
  ;(handle.onPointerMove as () => void)()
  ;(handle.onPointerUp as () => void)()
  ;(handle.onPointerCancel as () => void)()
  ;(handle.onKeyDown as () => void)()
  ;(handle.onDoubleClick as () => void)()
  assert.deepEqual(calls, ['down', 'move', 'end', 'end', 'key', 'reset'])
})

test('no handle when the popover is closed or the tab owns the panel (REQ-7.2)', () => {
  for (const overrides of [{ open: false }, { surface: 'tab' as const }]) {
    const view = LeanspecHeaderView({ ...BASE, ...overrides, panel: PANEL_DEFAULT })
    assert.equal(handleOf(view), undefined, JSON.stringify(overrides))
  }
})

test('the defaults are the size 007 shipped, and the floor is the documented one (D-2, D-6)', () => {
  assert.deepEqual(PANEL_DEFAULT, { width: PANEL_WIDTH, height: PANEL_HEIGHT })
  assert.equal(PANEL_WIDTH, 1040)
  assert.equal(PANEL_HEIGHT, 640)
  assert.equal(PANEL_MIN_WIDTH, 600)
  assert.equal(PANEL_MIN_HEIGHT, 420)
})
