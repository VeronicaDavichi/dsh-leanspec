import assert from 'node:assert/strict'
import { test } from 'node:test'

import { headerActions } from '../src/client/LeanspecHeaderAction.ts'
import { viewerStore } from '../src/client/store.ts'
import { createSurfaceFollower, planFollow } from '../src/client/surface-follow.ts'
import {
  applySidebarTab,
  leanspecTabIsOpen,
  noteTabMounted,
  noteTabUnmounted,
  openLeanspecTab,
  switchToTab,
  tabCapability,
} from '../src/client/tab-registration.ts'
import {
  LEANSPEC_TAB_ID,
  LEANSPEC_TAB_KIND,
  TAB_UNAVAILABLE_HOST,
  TAB_UNAVAILABLE_REGISTRATION,
  type Surface,
} from '../src/client/tab-surface.ts'
import { initialViewerState, reduceViewer, type ViewerAction } from '../src/client/viewer-state.ts'

/**
 * A stand-in for the pinned sidebar services (same shapes as
 * `test/tab-registration.test.ts`), narrowed to what switching needs: `openTab`
 * and the two keyed seats.
 *
 * There is deliberately no `close` / `closeTab` on this fake: since 2026-10-08
 * the plugin never closes a tab, so a fake that offered one would only test
 * dead wiring.
 */
interface Harness {
  ctx: Record<string, unknown>
  openCalls: Array<{ kind: string; options: Record<string, unknown> }>
  typeIds(): string[]
  seatCount(): number
  liveEffects(): number
  dispose(): void
}

function harness(options: {
  refuseOpen?: boolean
  /** The host declares `openTab` but refuses our seat: registration fails. */
  failSeat?: boolean
} = {}): Harness {
  const types = new Map<string, unknown>()
  const seats: unknown[] = []
  const openCalls: Harness['openCalls'] = []
  const pending = new Set<() => void>()

  function effect(callback: () => unknown): () => void {
    let settled = false
    const cleanup = callback()
    const dispose = (): void => {
      if (settled) return
      settled = true
      pending.delete(dispose)
      if (typeof cleanup === 'function') (cleanup as () => void)()
    }
    pending.add(dispose)
    return dispose
  }

  const registry = {
    register(definition: { id: string }): () => void {
      if (types.has(definition.id)) throw new Error(`tab type id "${definition.id}" is taken`)
      types.set(definition.id, definition)
      return () => {
        types.delete(definition.id)
      }
    },
  }

  const sidebar: Record<string, unknown> = {
    openTab(kind: string, openOptions: Record<string, unknown>): void {
      if (options.refuseOpen === true || ![...types.values()].some(
        entry => (entry as { kind?: string }).kind === kind,
      )) {
        throw new Error(`sidebarRight: no tab type is registered as "${kind}"`)
      }
      openCalls.push({ kind, options: openOptions })
    },
  }

  const slots = {
    inject(_name: string, factory: () => unknown): () => void {
      if (options.failSeat === true) throw new Error('slot "sidebar.right.pane.tab" is not declared')
      const disposeSeat = factory()
      return () => {
        if (typeof disposeSeat === 'function') (disposeSeat as () => void)()
      }
    },
    register(): () => void {
      const seat = {}
      seats.push(seat)
      return () => {
        const index = seats.indexOf(seat)
        if (index >= 0) seats.splice(index, 1)
      }
    },
  }

  const scope = {
    sidebarRightTabs: registry,
    sidebarRight: sidebar,
    slots,
    effect(callback: () => unknown): () => void {
      return effect(callback)
    },
  }

  const ctx = {
    inject(_requested: unknown, run: (target: unknown) => void): () => void {
      run(scope)
      return () => {
        for (const dispose of [...pending]) dispose()
      }
    },
  }

  return {
    ctx,
    openCalls,
    typeIds: () => [...types.keys()],
    seatCount: () => seats.length,
    liveEffects: () => pending.size,
    dispose: () => {
      for (const dispose of [...pending]) dispose()
    },
  }
}

/** Applies the wiring, runs the body, and always unloads (module singleton). */
function withTab<T>(ctx: unknown, body: () => T): T {
  const dispose = applySidebarTab(ctx)
  try {
    return body()
  } finally {
    dispose()
  }
}

/** Puts the shared store into a known state, the way the surfaces leave it. */
function seedStore(...actions: ViewerAction[]): void {
  let state = reduceViewer(initialViewerState, { type: 'set-project', root: '/repo', ready: true })
  for (const action of actions) state = reduceViewer(state, action)
  viewerStore.setState(state)
}

/** The nested expansion the tree tests use: a spec directory and its `docs/`. */
const NESTED_DIRS: ViewerAction[] = [
  { type: 'toggle-dir', path: 'specs/007-dual-surface-and-draggable-split' },
  { type: 'toggle-dir', path: 'specs/007-dual-surface-and-draggable-split/docs' },
]

test('switching to the tab opens exactly once and dismisses the popup (T2.3, REQ-3.1)', () => {
  const host = harness()
  withTab(host.ctx, () => {
    seedStore({ type: 'set-popup-open', open: true })
    assert.equal(viewerStore.getState().surface, 'popup')

    const result = switchToTab()

    assert.equal(result.ok, true)
    assert.equal(host.openCalls.length, 1, 'openTab is called exactly once per click')
    assert.equal(host.openCalls[0]?.kind, LEANSPEC_TAB_KIND)
    assert.deepEqual(host.openCalls[0]?.options, { params: {} })
    const state = viewerStore.getState()
    assert.equal(state.surface, 'tab', 'the tab owns the panel')
    assert.equal(state.popupOpen, false, 'the popup is gone, not hidden behind the tab')
    assert.equal(leanspecTabIsOpen(), true)
  })
})

test('the manual switch pins the surface, the automatic path does not (REQ-1.7, T3.2)', () => {
  const host = harness()
  withTab(host.ctx, () => {
    seedStore({ type: 'set-popup-open', open: true })

    // The automatic follow switches without a pin, so the next viewport change
    // may still take the choice back.
    assert.equal(switchToTab().ok, true)
    assert.equal(viewerStore.getState().pinned, false)

    // The in-popup button is the user speaking.
    viewerStore.setState(reduceViewer(viewerStore.getState(), { type: 'set-popup-open', open: true }))
    assert.equal(switchToTab({ pin: true }).ok, true)
    assert.equal(viewerStore.getState().pinned, true)

    // Closing the panel ends the pinned choice: the next open re-decides.
    viewerStore.setState(reduceViewer(viewerStore.getState(), { type: 'set-popup-open', open: false }))
    assert.equal(viewerStore.getState().pinned, false)
  })
})

test('the mount signal does not revoke the manual pin (REQ-1.7, T3.2)', () => {
  const host = harness()
  withTab(host.ctx, () => {
    seedStore({ type: 'set-popup-open', open: true })
    assert.equal(switchToTab({ pin: true }).ok, true)

    // The host mounts our body a moment later; that is not a user move.
    noteTabMounted()
    assert.equal(viewerStore.getState().pinned, true, 'mounting keeps the user\'s choice pinned')

    // Closing the panel is what ends it.
    noteTabUnmounted()
    assert.equal(viewerStore.getState().pinned, false)
  })
})

/**
 * A resize rig bound to the **real** store and the **real** tab module, so
 * "pinned blocks the follow" and "a closed panel resumes following" are tested
 * end to end instead of only through `planFollow`.
 */
function followRig(viewport: { width: number; height: number }): {
  fire(): void
  runTimers(): void
  applied: Surface[]
  follower: { dispose(): void }
} {
  const timers: Array<() => void> = []
  const applied: Surface[] = []
  let handler: (() => void) | null = null
  const follower = createSurfaceFollower({
    measure: () => ({ viewportWidth: viewport.width, viewportHeight: viewport.height, anchorBottom: 48 }),
    mounted: () => true,
    read: () => {
      const current = viewerStore.getState()
      return {
        surface: current.surface,
        pinned: current.pinned,
        dragging: current.dragging,
        panelVisible: current.popupOpen || leanspecTabIsOpen(),
        tabOpen: leanspecTabIsOpen(),
        tabAvailable: tabCapability().available,
      }
    },
    apply: surface => {
      applied.push(surface)
      if (surface === 'tab') {
        switchToTab()
        return
      }
      viewerStore.setState(reduceViewer(viewerStore.getState(), { type: 'set-popup-open', open: true }))
    },
    notify: () => undefined,
    subscribe: next => {
      handler = next
      return () => {
        handler = null
      }
    },
    setTimer: next => {
      timers.push(next)
      return timers.length
    },
    clearTimer: () => {
      timers.length = 0
    },
  })
  return {
    fire: () => handler?.(),
    runTimers: () => {
      for (const timer of timers.splice(0)) timer()
    },
    applied,
    follower,
  }
}

test('a pinned surface ignores a resize that crosses the breakpoint (REQ-1.7, T3.2)', () => {
  const host = harness()
  withTab(host.ctx, () => {
    seedStore({ type: 'set-popup-open', open: true })
    // The user manually sends the panel to the right sidebar.
    assert.equal(switchToTab({ pin: true }).ok, true)

    // The window grows back to a comfortable 1200x800 — the decision now says
    // `popup`, but the user's choice stands (REQ-1.7).
    const rig = followRig({ width: 1200, height: 800 })
    rig.fire()
    rig.runTimers()

    assert.deepEqual(rig.applied, [], 'a pinned surface is not switched')
    assert.equal(viewerStore.getState().surface, 'tab')
    assert.equal(viewerStore.getState().popupOpen, false, 'no popup is stacked next to the tab')

    // The pin — not the live-tab rule — is what held it: with the same store but
    // no tab open, the policy reports `pinned` before it would ever switch.
    const snapshot = {
      surface: 'tab' as const,
      pinned: true,
      dragging: false,
      panelVisible: true,
      tabOpen: false,
      tabAvailable: true,
    }
    const outcome = planFollow(snapshot, {
      measured: { viewportWidth: 1200, viewportHeight: 800, anchorBottom: 48 },
      mounted: true,
    })
    assert.equal(outcome.kind === 'idle' ? outcome.reason : outcome.kind, 'pinned')

    rig.follower.dispose()
  })
})

test('after the host closes the panel, following resumes (REQ-1.7, T3.2)', () => {
  const host = harness()
  withTab(host.ctx, () => {
    seedStore({ type: 'set-popup-open', open: true })
    assert.equal(switchToTab({ pin: true }).ok, true)
    assert.equal(viewerStore.getState().pinned, true)

    // The host × closes the tab: the body unmounts and the pin goes with it.
    noteTabUnmounted()
    assert.equal(viewerStore.getState().pinned, false)

    // Reopen the panel, then shrink the window under the breakpoint: the
    // automatic follow must work again (REQ-1.3).
    viewerStore.setState(reduceViewer(viewerStore.getState(), { type: 'set-popup-open', open: true }))
    const rig = followRig({ width: 1000, height: 800 })
    rig.fire()
    rig.runTimers()

    assert.deepEqual(rig.applied, ['tab'], 'the follow is live again after a fresh open')
    assert.equal(viewerStore.getState().surface, 'tab')
    assert.equal(host.openCalls.length, 2, 'the manual open plus the automatic one')

    rig.follower.dispose()
  })
})

test('a refused open keeps the popup up and reports why (REQ-8.2)', () => {
  const host = harness({ refuseOpen: true })
  withTab(host.ctx, () => {
    seedStore({ type: 'set-popup-open', open: true })

    const result = switchToTab()

    assert.equal(result.ok, false)
    assert.ok(!result.ok && result.reason.length > 0, 'the user gets a reason, not silence')
    assert.equal(host.openCalls.length, 0)
    const state = viewerStore.getState()
    assert.equal(state.popupOpen, true, 'failure must not close the working entrance')
    assert.equal(state.surface, 'popup')
    assert.equal(leanspecTabIsOpen(), false)
  })
})

test('with no tab surface at all the click never reaches the host (T3.5)', () => {
  // A host that has no scope form: `applySidebarTab` degrades to popup-only.
  const dispose = applySidebarTab({})
  try {
    seedStore({ type: 'set-popup-open', open: true })
    assert.equal(tabCapability().available, false)
    assert.equal(tabCapability().unavailableReason, TAB_UNAVAILABLE_HOST)
    assert.match(String(tabCapability().unavailableReason), /不支持/)

    const result = switchToTab()

    assert.equal(result.ok, false)
    assert.equal(result.ok === false && result.reason, TAB_UNAVAILABLE_HOST)
    assert.equal(viewerStore.getState().surface, 'popup', 'nothing moved')
  } finally {
    dispose()
  }
})

test('the tab body mounting takes the panel from the popup (T2.5 / REQ-3.3)', () => {
  const host = harness()
  withTab(host.ctx, () => {
    seedStore({ type: 'set-popup-open', open: true })

    // The host mounts our body: that alone proves the tab is on screen, and it
    // must never leave a second panel floating next to the sidebar.
    noteTabMounted()

    const state = viewerStore.getState()
    assert.equal(state.surface, 'tab')
    assert.equal(state.popupOpen, false)
    assert.equal(leanspecTabIsOpen(), true)
  })
})

test('the tab body unmounting hands the panel back to the popup (REQ-4.1, REQ-4.2)', () => {
  const host = harness()
  withTab(host.ctx, () => {
    seedStore({ type: 'set-popup-open', open: true })
    noteTabMounted()

    // The host's × (or an unload) unmounts the body.
    noteTabUnmounted()

    const state = viewerStore.getState()
    assert.equal(state.surface, 'popup', 'the popup may render again')
    assert.equal(state.popupOpen, false, 'but nothing popped up on its own')
    assert.equal(leanspecTabIsOpen(), false)
  })
})

test('selection, draft, split and the expanded tree survive popup → tab → popup (REQ-3.4 / T2.5)', () => {
  const host = harness()
  withTab(host.ctx, () => {
    seedStore(
      { type: 'select', path: 'specs/007-dual-surface-and-draggable-split/design.md' },
      { type: 'file-loaded', content: '# design\n' },
      { type: 'set-mode', mode: 'edit' },
      { type: 'edit', draft: '# design\n\nedited in the popup\n' },
      { type: 'set-split', split: 420 },
      ...NESTED_DIRS,
      { type: 'set-popup-open', open: true },
    )
    const before = viewerStore.getState()
    assert.equal(before.expanded.size, 2, 'the fixture really expands two levels')

    switchToTab()
    const inTab = viewerStore.getState()
    assert.equal(inTab.surface, 'tab')
    assert.equal(inTab.popupOpen, false, 'one exit at a time')
    assert.equal(inTab.selected, before.selected)
    assert.equal(inTab.draft, before.draft)
    assert.equal(inTab.split, before.split)
    assert.deepEqual(
      [...inTab.expanded].sort(),
      [...before.expanded].sort(),
      'the tab sees the tree the popup left open (bug 2026-10-08)',
    )

    // The host × closes the tab; the header button opens the popup again.
    noteTabUnmounted()
    viewerStore.setState(reduceViewer(viewerStore.getState(), { type: 'set-popup-open', open: true }))
    const back = viewerStore.getState()
    assert.equal(back.surface, 'popup')
    assert.equal(back.popupOpen, true)
    assert.equal(back.selected, before.selected)
    assert.equal(back.draft, before.draft, 'the unsaved draft is the same text, not a re-read')
    assert.equal(back.split, before.split)
    assert.equal(back.mode, 'edit')
    assert.deepEqual([...back.expanded].sort(), [...before.expanded].sort())
  })
})

test('both surfaces read one and the same expanded set (bug 2026-10-08)', () => {
  withTab(harness().ctx, () => {
    seedStore(...NESTED_DIRS)
    const fromPopup = viewerStore.getState().expanded
    assert.deepEqual([...fromPopup].sort(), [
      'specs/007-dual-surface-and-draggable-split',
      'specs/007-dual-surface-and-draggable-split/docs',
    ])

    // Switch to the tab: the surface moves, the set instance does not.
    switchToTab()
    const inTab = viewerStore.getState().expanded
    assert.equal(inTab, fromPopup, 'the same Set survives the switch, untouched')
    assert.deepEqual([...inTab].sort(), [...fromPopup].sort())

    // Collapsing inside the tab is visible to the popup immediately: one store,
    // no per-surface copy to reconcile.
    viewerStore.setState(reduceViewer(viewerStore.getState(), {
      type: 'toggle-dir',
      path: 'specs/007-dual-surface-and-draggable-split/docs',
    }))
    assert.deepEqual([...viewerStore.getState().expanded], ['specs/007-dual-surface-and-draggable-split'])

    noteTabUnmounted()
    assert.deepEqual(
      [...viewerStore.getState().expanded],
      ['specs/007-dual-surface-and-draggable-split'],
      'the popup reads the tree exactly as the tab left it',
    )
  })
})

test('an unmount and remount of the viewer keeps the expanded set (bug 2026-10-08)', () => {
  withTab(harness().ctx, () => {
    seedStore(...NESTED_DIRS)
    const before = viewerStore.getState().expanded

    // A surface switch unmounts and remounts the viewer component. Component
    // state would be born empty here; store state is not.
    noteTabUnmounted()
    noteTabMounted()

    const after = viewerStore.getState().expanded
    assert.equal(after, before, 'the very same Set instance is still in the store')
    assert.deepEqual([...after].sort(), [
      'specs/007-dual-surface-and-draggable-split',
      'specs/007-dual-surface-and-draggable-split/docs',
    ])
    // And it is still mutable state, not a frozen snapshot: the tree can go on
    // expanding after the round trip.
    viewerStore.setState(reduceViewer(viewerStore.getState(), {
      type: 'toggle-dir',
      path: 'specs/007-dual-surface-and-draggable-split/docs/notes',
    }))
    assert.equal(viewerStore.getState().expanded.size, 3)
  })
})

test('unloading zeroes the registrations and a second apply works again (T2.6)', () => {
  const host = harness()

  const first = applySidebarTab(host.ctx)
  assert.deepEqual(host.typeIds(), [LEANSPEC_TAB_ID])
  assert.equal(host.seatCount(), 2)
  assert.ok(host.liveEffects() > 0)
  assert.equal(tabCapability().available, true)

  first()

  assert.deepEqual(host.typeIds(), [])
  assert.equal(host.seatCount(), 0)
  assert.equal(host.liveEffects(), 0, 'no effect, listener or seat outlives the unload')
  assert.equal(tabCapability().available, false)
  assert.equal(openLeanspecTab().ok, false, 'the opener is gone with the wiring')

  const second = applySidebarTab(host.ctx)
  try {
    assert.deepEqual(host.typeIds(), [LEANSPEC_TAB_ID])
    assert.equal(host.seatCount(), 2)
    assert.equal(tabCapability().available, true, 're-enabling restores the tab surface')
    seedStore()
    assert.equal(switchToTab().ok, true)
  } finally {
    second()
  }
})

test('reopening after the host closed the tab by its × still works (T2.6)', () => {
  const host = harness()
  withTab(host.ctx, () => {
    seedStore()
    assert.equal(switchToTab().ok, true)
    // The host's own × unmounts the body: the wiring stays, the store keeps the
    // selection, and the next click may open the tab again (page types dedup).
    noteTabUnmounted()

    const again = switchToTab()

    assert.equal(again.ok, true)
    assert.equal(host.openCalls.length, 2, 'one open per click, never a silent no-op')
    assert.equal(viewerStore.getState().surface, 'tab')
  })
})

test('the store itself keeps the two exits exclusive (T2.5 / REQ-3.3)', () => {
  // The renderers trust these two invariants instead of guessing, so pin them:
  // moving to the tab dismisses the popup, and raising the popup takes the panel
  // back. Neither action ever leaves both surfaces claiming the same panel.
  let state = reduceViewer(initialViewerState, { type: 'set-popup-open', open: true })
  assert.equal(state.surface, 'popup')

  state = reduceViewer(state, { type: 'set-surface', surface: 'tab' })
  assert.equal(state.surface, 'tab')
  assert.equal(state.popupOpen, false)

  state = reduceViewer(state, { type: 'set-surface', surface: 'tab' })
  assert.equal(state.popupOpen, false, 'idempotent: no stale popup comes back')

  state = reduceViewer(state, { type: 'set-popup-open', open: true })
  assert.equal(state.surface, 'popup', 'the popup owns the panel the moment it is up')
  assert.equal(state.popupOpen, true)

  // Closing the popup hands the panel back to nothing: the surface stays put and
  // the header button decides afresh on the next click.
  state = reduceViewer(state, { type: 'set-popup-open', open: false })
  assert.equal(state.popupOpen, false)
  assert.equal(state.surface, 'popup')
})

test('a disabled button never reaches a host that is still there (T3.5)', () => {
  // The host exposes `openTab`, but it refused our seat, so nothing is
  // registered and the surface is unavailable: the click must not sneak past
  // the disabled button and call the host anyway.
  const host = harness({ failSeat: true })
  const dispose = applySidebarTab(host.ctx)
  try {
    assert.equal(tabCapability().available, false)
    assert.equal(tabCapability().unavailableReason, TAB_UNAVAILABLE_REGISTRATION)
    assert.deepEqual(host.typeIds(), [], 'the failed registration was rolled back')
    seedStore({ type: 'set-popup-open', open: true })

    const failures: Array<string | null> = []
    const actions = headerActions({
      dispatch: action => {
        viewerStore.setState(reduceViewer(viewerStore.getState(), action))
      },
      setFailure: message => {
        failures.push(message)
      },
    })
    actions.switchToTab()

    assert.equal(host.openCalls.length, 0, 'openTab is never called while unavailable')
    assert.deepEqual(failures, [TAB_UNAVAILABLE_REGISTRATION], 'the user is told why')
    assert.equal(viewerStore.getState().popupOpen, true, 'and the popup stays usable')
  } finally {
    dispose()
  }
})

test('the header button follows the decision: wide opens the popup, narrow the tab (T3.1/T3.2)', () => {
  const host = harness()
  withTab(host.ctx, () => {
    const seen: Array<string | null> = []
    let decision: 'popup' | 'tab' = 'popup'
    const actions = headerActions({
      dispatch: action => {
        viewerStore.setState(reduceViewer(viewerStore.getState(), action))
      },
      setFailure: message => {
        seen.push(message)
      },
      decide: () => decision,
      tabAvailable: () => tabCapability().available,
    })

    seedStore()
    actions.togglePopover()
    assert.equal(viewerStore.getState().popupOpen, true, 'a roomy viewport keeps the popover')
    assert.equal(host.openCalls.length, 0)

    // Close it, narrow the window, click again: now the tab is the answer.
    actions.togglePopover()
    assert.equal(viewerStore.getState().popupOpen, false)
    decision = 'tab'
    actions.togglePopover()
    assert.equal(host.openCalls.length, 1)
    assert.equal(viewerStore.getState().surface, 'tab')
    assert.equal(viewerStore.getState().popupOpen, false)
    assert.deepEqual(seen, [null, null], 'no failure to report on the happy path')
  })
})

test('the header button focuses a live tab instead of stacking a popup (REQ-3.3)', () => {
  const host = harness()
  withTab(host.ctx, () => {
    seedStore()
    assert.equal(switchToTab().ok, true)
    assert.equal(host.openCalls.length, 1)

    const failures: Array<string | null> = []
    const actions = headerActions({
      dispatch: action => {
        viewerStore.setState(reduceViewer(viewerStore.getState(), action))
      },
      setFailure: message => {
        failures.push(message)
      },
      // The viewport is roomy again — the popup would fit, and a naive
      // implementation would open one next to the still-open tab.
      decide: () => 'popup',
    })
    actions.togglePopover()

    assert.equal(viewerStore.getState().popupOpen, false, 'never two panels at once')
    assert.equal(host.openCalls.length, 2, 'the host focuses the tab it already has')
    assert.deepEqual(failures, [null])
    // Focusing is not a manual surface choice, so it does not pin anything.
    assert.equal(viewerStore.getState().pinned, false)
  })
})

test('a narrow viewport on a host without a tab still gets the popup (REQ-8.1)', () => {
  const host = harness({ failSeat: true })
  const dispose = applySidebarTab(host.ctx)
  try {
    seedStore()
    const failures: Array<string | null> = []
    const actions = headerActions({
      dispatch: action => {
        viewerStore.setState(reduceViewer(viewerStore.getState(), action))
      },
      setFailure: message => {
        failures.push(message)
      },
      decide: () => 'tab',
      tabAvailable: () => tabCapability().available,
    })

    actions.togglePopover()

    assert.equal(host.openCalls.length, 0, 'the click never reaches the host')
    assert.equal(viewerStore.getState().popupOpen, true, 'the popup is the fallback, not nothing')
    assert.equal(viewerStore.getState().surface, 'popup')
    assert.deepEqual(failures, [null])
  } finally {
    dispose()
  }
})

test('a tab that refuses to open falls back to the popup on the header path (REQ-8.1)', () => {
  const host = harness({ refuseOpen: true })
  withTab(host.ctx, () => {
    seedStore()
    const failures: Array<string | null> = []
    const actions = headerActions({
      dispatch: action => {
        viewerStore.setState(reduceViewer(viewerStore.getState(), action))
      },
      setFailure: message => {
        failures.push(message)
      },
      decide: () => 'tab',
      tabAvailable: () => tabCapability().available,
    })
    assert.equal(tabCapability().available, true, 'the surface is offered, the host still refuses')

    actions.togglePopover()

    assert.equal(viewerStore.getState().surface, 'popup')
    assert.equal(viewerStore.getState().popupOpen, true, 'never a blank panel (REQ-8.1)')
    assert.equal(failures.length, 1)
    assert.match(String(failures[0]), /no tab type is registered/)
  })
})
