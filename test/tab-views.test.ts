import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ReactElement } from 'react'

import { LeanspecViewer } from '../src/client/LeanspecViewer.ts'
import { headerActions, LeanspecHeaderView } from '../src/client/LeanspecHeaderAction.ts'
import { LeanspecTabView } from '../src/client/LeanspecSidebarTab.ts'
import { viewerStore } from '../src/client/store.ts'
import { applySidebarTab, tabCapability } from '../src/client/tab-registration.ts'
import {
  LEANSPEC_TAB_KIND,
  NO_TAB_CAPABILITY,
  TAB_UNAVAILABLE_HOST,
  type TabCapability,
} from '../src/client/tab-surface.ts'
import { initialViewerState, reduceViewer, type ViewerAction } from '../src/client/viewer-state.ts'

/**
 * Every element in a rendered tree, so assertions can look for classes/props.
 *
 * `headAction` is followed as well: since 2026-10-08 the popup's 「在右栏打开」
 * button travels into the viewer through that prop (the viewer draws it on the
 * tree pane's header row), so a walker that only follows `children` would miss
 * the control entirely.
 */
function walk(node: unknown, out: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, out)
    return out
  }
  if (node === null || typeof node !== 'object') return out
  const element = node as ReactElement & { props?: { children?: unknown; headAction?: unknown } }
  if (element.props === undefined) return out
  out.push(element)
  walk(element.props.children, out)
  walk(element.props.headAction, out)
  return out
}

function findByClass(tree: unknown, className: string): ReactElement[] {
  return walk(tree).filter(element => String((element.props as { className?: string }).className ?? '')
    .split(/\s+/)
    .includes(className))
}

/** The viewer is a component element, so it is found by type, not by class. */
function viewers(tree: unknown): ReactElement[] {
  return walk(tree).filter(element => element.type === LeanspecViewer)
}

function findBySwitch(tree: unknown, value: string): ReactElement | undefined {
  return walk(tree).find(
    element => (element.props as Record<string, unknown>)['data-leanspec-switch'] === value,
  )
}

function textOf(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  const element = node as ReactElement & { props?: { children?: unknown } }
  return textOf(element.props?.children)
}

const AVAILABLE: TabCapability = {
  canOpen: true,
  registered: true,
  available: true,
}

function seedStore(...actions: ViewerAction[]): void {
  let state = reduceViewer(initialViewerState, { type: 'set-project', root: '/repo', ready: true })
  for (const action of actions) state = reduceViewer(state, action)
  viewerStore.setState(state)
}

/** A host that accepts everything, for the view tests that click for real. */
function host(): { ctx: Record<string, unknown>; openCalls: string[] } {
  const openCalls: string[] = []
  const scope = {
    sidebarRightTabs: {
      register: () => () => undefined,
    },
    sidebarRight: {
      openTab(kind: string): void {
        openCalls.push(kind)
      },
      close: () => undefined,
    },
    slots: {
      inject: (_name: string, factory: () => unknown) => {
        const disposeSeat = factory()
        return () => {
          if (typeof disposeSeat === 'function') (disposeSeat as () => void)()
        }
      },
      register: () => () => undefined,
    },
    effect: (callback: () => unknown) => {
      const cleanup = callback()
      return () => {
        if (typeof cleanup === 'function') (cleanup as () => void)()
      }
    },
  }
  return {
    ctx: {
      inject: (_requested: unknown, run: (target: unknown) => void): (() => void) => {
        run(scope)
        return () => undefined
      },
    },
    openCalls,
  }
}

test('the popover is drawn only while the popup owns the panel (T2.5 / REQ-3.3)', () => {
  const base = {
    capability: AVAILABLE,
    failure: null,
    onToggle: () => undefined,
    onSwitchToTab: () => undefined,
  }

  const open = LeanspecHeaderView({ ...base, open: true, surface: 'popup' })
  assert.equal(findByClass(open, 'dsh-leanspec-popover').length, 1)
  assert.equal(viewers(open).length, 1, 'exactly one viewer, never two')
  assert.ok(findBySwitch(open, 'tab'), 'the popup offers the way across')
  // …and it reaches the panel as `headAction`, which is what puts it on the
  // tree pane's header row (same line as 「LeanSpec」, right-aligned in that
  // column) instead of on a full-width bar above the panel — 2026-10-08.
  assert.equal(
    (viewers(open)[0]?.props as { headAction?: ReactElement }).headAction,
    findBySwitch(open, 'tab'),
    'the switch is handed to the viewer as its header action',
  )
  assert.equal(findByClass(open, 'dsh-leanspec-switch').length, 1, 'the control renders exactly once')
  // The visible label stays short (2026-10-08): it shares its row with the pane
  // title, and at the 180px splitter floor the five-character wording wrapped.
  // The full sentence lives in the tooltip and the accessible name instead.
  const control = findBySwitch(open, 'tab')
  const label = textOf(control)
  assert.ok(label.trim().length <= 4, `the visible label stays short: ${label}`)
  assert.equal(
    (control?.props as Record<string, unknown>)['aria-label'],
    '在右栏标签里打开 LeanSpec',
    'the full sentence stays available to assistive tech',
  )

  const closed = LeanspecHeaderView({ ...base, open: false, surface: 'popup' })
  assert.equal(findByClass(closed, 'dsh-leanspec-popover').length, 0)
  assert.equal(viewers(closed).length, 0)

  // A tab that is still open must not put a second viewer on screen.
  const tabOwns = LeanspecHeaderView({ ...base, open: true, surface: 'tab' })
  assert.equal(findByClass(tabOwns, 'dsh-leanspec-popover').length, 0)
  assert.equal(viewers(tabOwns).length, 0)
})

test('an unusable switch button is disabled and says why (T3.5)', () => {
  const view = LeanspecHeaderView({
    open: true,
    surface: 'popup',
    capability: NO_TAB_CAPABILITY,
    failure: null,
    onToggle: () => undefined,
    onSwitchToTab: () => undefined,
  })

  const button = findBySwitch(view, 'tab')
  assert.ok(button, 'the control is still there, so the user learns why')
  assert.equal((button.props as { disabled?: boolean }).disabled, true)
  const text = walk(view).map(textOf).join(' ')
  assert.match(text, /不支持/, 'the reason quotes the host limitation')
  assert.equal(String((button.props as { title?: string }).title), TAB_UNAVAILABLE_HOST)
})

test('clicking the switch opens the tab once and closes the popup (T2.3 acceptance)', () => {
  const fake = host()
  const dispose = applySidebarTab(fake.ctx)
  try {
    seedStore({ type: 'set-popup-open', open: true })
    const dispatched: unknown[] = []
    const failures: Array<string | null> = []
    const actions = headerActions({
      dispatch: action => {
        dispatched.push(action)
        viewerStore.setState(reduceViewer(viewerStore.getState(), action))
      },
      setFailure: message => {
        failures.push(message)
      },
    })

    const view = LeanspecHeaderView({
      open: true,
      surface: 'popup',
      capability: tabCapability(),
      failure: null,
      onToggle: actions.togglePopover,
      onSwitchToTab: actions.switchToTab,
    })
    const button = findBySwitch(view, 'tab')
    assert.equal(
      (button?.props as { onClick?: unknown }).onClick,
      actions.switchToTab,
      'the button is wired to the real action',
    )

    ;(button?.props as { onClick: () => void }).onClick()

    assert.deepEqual(fake.openCalls, [LEANSPEC_TAB_KIND], 'openTab is called exactly once')
    assert.deepEqual(failures, [null], 'a success clears the message instead of showing one')
    assert.equal(viewerStore.getState().surface, 'tab')
    assert.equal(viewerStore.getState().popupOpen, false, 'the popup closes only after the tab opened')
    assert.equal(dispatched.length, 0, 'the action goes through the module, not the raw dispatch')
  } finally {
    dispose()
  }
})

test('a failing switch keeps the popup and hands the reason to the button (REQ-8.2)', () => {
  // No wiring at all: the click cannot reach a host, so it must say so.
  const failures: Array<string | null> = []
  const actions = headerActions({
    dispatch: () => undefined,
    setFailure: message => {
      failures.push(message)
    },
  })
  seedStore({ type: 'set-popup-open', open: true })

  actions.switchToTab()

  assert.deepEqual(failures, [TAB_UNAVAILABLE_HOST])
  assert.equal(viewerStore.getState().popupOpen, true, 'the popup the user has stays up')

  // And the message is rendered next to the disabled control.
  const view = LeanspecHeaderView({
    open: true,
    surface: 'popup',
    capability: tabCapability(),
    failure: failures[0] ?? null,
    onToggle: () => undefined,
    onSwitchToTab: actions.switchToTab,
  })
  assert.match(walk(view).map(textOf).join(' '), /不支持/)
})

test('the tab body draws the panel and nothing else (2026-10-08 decision)', () => {
  const view = LeanspecTabView()

  assert.equal(findByClass(view, 'dsh-leanspec-tab').length, 1)
  assert.equal(viewers(view).length, 1, 'the panel itself, no popup shell')
  assert.equal(findByClass(view, 'dsh-leanspec-popover').length, 0, 'never a framed popup inside a tab')
  // One-way: no reverse button, no placeholder, no second entrance.
  assert.equal(findByClass(view, 'dsh-leanspec-switchbar').length, 0)
  assert.equal(findByClass(view, 'dsh-leanspec-tab-notice').length, 0)
  assert.equal(findBySwitch(view, 'popup'), undefined)
  assert.equal(findBySwitch(view, 'tab'), undefined)
})

test('the popover receives the measured anchor, and no inline style without one (T3.3)', () => {
  const base = {
    open: true,
    surface: 'popup',
    capability: AVAILABLE,
    failure: null,
    onToggle: () => undefined,
    onSwitchToTab: () => undefined,
  } as const

  const measured = LeanspecHeaderView({ ...base, anchor: 56 })
  const popover = findByClass(measured, 'dsh-leanspec-popover')[0]
  assert.deepEqual((popover?.props as { style?: unknown }).style, { '--anchor': '56px' },
    'the CSS cap reads the same number the decision used')

  // Before the first measurement the CSS fallback applies, so nothing is injected.
  const unmeasured = LeanspecHeaderView({ ...base })
  const second = findByClass(unmeasured, 'dsh-leanspec-popover')[0]
  assert.equal((second?.props as { style?: unknown }).style, undefined)
})

test('the tab body never reads the host tab payload (it does not need the id)', () => {
  // The body used to take `useTabInfo` to learn its own tab id for the close
  // chain. With the tab one-way there is nothing to close, so the component
  // takes no props at all — a host hook could not change what it renders.
  assert.equal(LeanspecTabView.length, 0, 'no parameters: nothing can be injected')
})

