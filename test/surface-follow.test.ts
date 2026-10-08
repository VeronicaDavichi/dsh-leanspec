import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  FOLLOW_THROTTLE_MS,
  SURFACE_DEFERRED_MOUNTED,
  createSurfaceFollower,
  planFollow,
  type FollowInput,
  type FollowSnapshot,
  type SurfaceFollowerDeps,
} from '../src/client/surface-follow.ts'
import type { Surface } from '../src/client/tab-surface.ts'

/**
 * T3.2 — the surface follow, with no React and no DOM.
 *
 * `planFollow` carries the whole policy, so the guards (pin, drag, mount, live
 * tab, capability) are pinned one by one; `createSurfaceFollower` is then driven
 * through an injected clock and subscription to prove the throttle, the
 * one-time deferral notice and the disposer really behave.
 */

const WIDE = { viewportWidth: 1920, viewportHeight: 1080 }
const NARROW = { viewportWidth: 900, viewportHeight: 1080 }

function snapshot(over: Partial<FollowSnapshot> = {}): FollowSnapshot {
  return {
    surface: 'popup',
    pinned: false,
    dragging: false,
    panelVisible: true,
    tabOpen: false,
    tabAvailable: true,
    ...over,
  }
}

function input(over: Partial<FollowInput> = {}): FollowInput {
  return { measured: WIDE, mounted: true, ...over }
}

test('nothing follows a panel that is not on screen', () => {
  const outcome = planFollow(snapshot({ panelVisible: false }), input({ measured: NARROW }))
  assert.deepEqual(outcome, { kind: 'idle', reason: 'no-panel' })
})

test('a decision that matches the current surface is not a switch', () => {
  assert.deepEqual(planFollow(snapshot({ surface: 'popup' }), input()), { kind: 'idle', reason: 'in-sync' })
  assert.deepEqual(
    planFollow(snapshot({ surface: 'tab', tabOpen: true }), input({ measured: NARROW })),
    { kind: 'idle', reason: 'in-sync' },
  )
})

test('a narrowing viewport switches the popup to the tab (REQ-1.3)', () => {
  assert.deepEqual(
    planFollow(snapshot({ surface: 'popup' }), input({ measured: NARROW })),
    { kind: 'switch', decided: 'tab' },
  )
})

test('widening again does not yank a live tab away (2026-10-08 decision)', () => {
  // The tab is one-way: only the host closes it, so a wide viewport leaves it be
  // rather than opening a popup next to it (REQ-3.3).
  assert.deepEqual(
    planFollow(snapshot({ surface: 'tab', tabOpen: true }), input({ measured: WIDE })),
    { kind: 'idle', reason: 'tab-wins' },
  )
  // And the popup is never *restored* automatically: this path only ever goes
  // popup → tab, so a popup that is already up on a wide viewport is in sync.
  assert.deepEqual(
    planFollow(snapshot({ surface: 'popup' }), input({ measured: WIDE })),
    { kind: 'idle', reason: 'in-sync' },
  )
})

test('a host without a usable tab surface keeps the popup however narrow it gets (REQ-8.1)', () => {
  assert.deepEqual(
    planFollow(snapshot({ surface: 'popup', tabAvailable: false }), input({ measured: NARROW })),
    { kind: 'idle', reason: 'in-sync' },
  )
})

test('a pinned choice outranks the viewport (REQ-1.7)', () => {
  assert.deepEqual(
    planFollow(snapshot({ surface: 'popup', pinned: true }), input({ measured: NARROW })),
    { kind: 'idle', reason: 'pinned' },
  )
})

test('a drag in progress defers the switch until it ends (REQ-1.5)', () => {
  assert.deepEqual(
    planFollow(snapshot({ surface: 'popup', dragging: true }), input({ measured: NARROW })),
    { kind: 'idle', reason: 'dragging' },
  )
})

test('a sidebar that is not up yet defers the tab switch and says so (REQ-1.6)', () => {
  const outcome = planFollow(
    snapshot({ surface: 'popup' }),
    input({ measured: NARROW, mounted: false }),
  )
  assert.deepEqual(outcome, { kind: 'deferred', reason: 'sidebar-not-mounted', decided: 'tab' })
})

test('the guards are ordered: no panel beats everything, in-sync beats the pin', () => {
  // `no-panel` first: a closed panel is never switched.
  assert.equal(
    planFollow(snapshot({ panelVisible: false, pinned: true, dragging: true }), input({ measured: NARROW })).kind,
    'idle',
  )
  // `in-sync` before `pinned` / `dragging`: nothing to do is nothing to report.
  const inSync = planFollow(snapshot({ surface: 'popup', pinned: true, dragging: true }), input())
  assert.equal(inSync.kind === 'idle' ? inSync.reason : inSync.kind, 'in-sync')
})

/**
 * The follower's world, with a hand-cranked clock and an injectable subscription.
 *
 * Everything the follower reads lives here, so a test changes one thing at a
 * time and then fires a resize (`fire`) or a timer (`runTimers`) explicitly.
 */
interface Rig {
  deps: SurfaceFollowerDeps
  applied: Surface[]
  notified: string[]
  ticks: number[]
  setState(next: Partial<FollowSnapshot>): void
  setMeasured(next: { viewportWidth: number; viewportHeight: number }): void
  setMounted(next: boolean): void
  setTabAvailable(next: boolean): void
  fire(): void
  runTimers(): void
  pendingTimers(): number
  listeners(): number
}

function rig(): Rig {
  const applied: Surface[] = []
  const notified: string[] = []
  const ticks: number[] = []
  const handlers = new Set<() => void>()
  const timers = new Map<number, () => void>()
  let nextId = 1
  let state = snapshot()
  let measured = WIDE
  let mounted = true
  let tabAvailable = true

  return {
    deps: {
      read: () => ({ ...state, tabAvailable }),
      measure: () => measured,
      mounted: () => mounted,
      apply: (surface: Surface) => {
        // Faithful to the store: applying a surface moves the panel, so the next
        // evaluation sees the new state instead of switching twice.
        applied.push(surface)
        state = { ...state, surface, ...(surface === 'tab' ? { tabOpen: true } : {}) }
      },
      notify: (reason: string) => {
        notified.push(reason)
      },
      onTick: () => {
        ticks.push(ticks.length + 1)
      },
      subscribe: handler => {
        handlers.add(handler)
        return () => {
          handlers.delete(handler)
        }
      },
      setTimer: handler => {
        const id = nextId
        nextId += 1
        timers.set(id, handler)
        return id
      },
      clearTimer: handle => {
        timers.delete(Number(handle))
      },
    },
    applied,
    notified,
    ticks,
    setState: next => {
      state = snapshot(next)
    },
    setMeasured: next => {
      measured = next
    },
    setMounted: next => {
      mounted = next
    },
    setTabAvailable: next => {
      tabAvailable = next
    },
    fire: () => {
      for (const handler of [...handlers]) handler()
    },
    runTimers: () => {
      for (const [id, handler] of [...timers]) {
        timers.delete(id)
        handler()
      }
    },
    pendingTimers: () => timers.size,
    listeners: () => handlers.size,
  }
}

test('one resize switches once, and the burst around it is coalesced (T3.2)', () => {
  const r = rig()
  const follower = createSurfaceFollower(r.deps)

  assert.deepEqual(r.applied, [], 'nothing happens before a resize')
  r.setMeasured(NARROW)
  r.fire()

  assert.deepEqual(r.applied, ['tab'], 'the leading edge reacts immediately')
  assert.equal(r.pendingTimers(), 1, 'and the window is now held')

  // A burst inside the window: no second evaluation, one trailing run.
  r.fire()
  r.fire()
  assert.deepEqual(r.applied, ['tab'])
  r.runTimers()
  assert.deepEqual(r.applied, ['tab'], 'the trailing run re-evaluates an already-synced state')

  follower.dispose()
})

test('a change that arrives inside the throttle window still lands on the trailing edge', () => {
  const r = rig()
  const follower = createSurfaceFollower(r.deps)

  r.fire()
  assert.deepEqual(r.applied, [], 'a wide viewport with the popup up is in sync')
  // The window is held for one throttle period...
  r.setMeasured(NARROW)
  r.fire()
  assert.deepEqual(r.applied, [], 'inside the window nothing is evaluated')
  // ...and the trailing tick picks the change up without another resize.
  r.runTimers()
  assert.deepEqual(r.applied, ['tab'])

  follower.dispose()
})

test('the throttle window is the documented 150 ms', () => {
  assert.equal(FOLLOW_THROTTLE_MS, 150)
})

test('a deferral is announced once per follower, not once per tick (REQ-1.6)', () => {
  const r = rig()
  r.setMeasured(NARROW)
  r.setMounted(false)
  const follower = createSurfaceFollower(r.deps)

  follower.evaluate()
  follower.evaluate()
  follower.evaluate()

  assert.deepEqual(r.notified, [SURFACE_DEFERRED_MOUNTED], 'one message, not a stream')
  assert.deepEqual(r.applied, [], 'and nothing was switched while it was deferred')

  // Once the sidebar is up, the switch happens and a later deferral may speak
  // again (it is a new state, not a repeat).
  r.setMounted(true)
  follower.evaluate()
  assert.deepEqual(r.applied, ['tab'])

  follower.dispose()
})

test('every tick refreshes the injected anchor before deciding (T3.3)', () => {
  const r = rig()
  const follower = createSurfaceFollower(r.deps)

  // Leading edge, then a second event inside the window, then the trailing run:
  // exactly two evaluations, so exactly two anchor refreshes.
  r.fire()
  r.fire()
  r.runTimers()
  assert.equal(r.ticks.length, 2, 'onTick ran for the leading and the trailing evaluation')

  follower.dispose()
})

test('dispose unsubscribes, drops the pending timer and goes quiet (REQ-4.3)', () => {
  const r = rig()
  const follower = createSurfaceFollower(r.deps)

  r.fire()
  assert.equal(r.pendingTimers(), 1)
  assert.equal(r.listeners(), 1)

  follower.dispose()
  assert.equal(r.pendingTimers(), 0, 'no timer outlives the plugin')
  assert.equal(r.listeners(), 0, 'and no listener either')

  // Even a handler that escaped the unsubscribe cannot do anything.
  r.fire()
  r.runTimers()
  assert.deepEqual(r.applied, [])
})

test('evaluate is callable directly, for guards that lift without a resize', () => {
  const r = rig()
  const follower = createSurfaceFollower(r.deps)
  r.setMeasured(NARROW)

  assert.deepEqual(follower.evaluate(), { kind: 'switch', decided: 'tab' })
  assert.deepEqual(r.applied, ['tab'])

  // The drag ended: the caller re-evaluates and the pending switch lands.
  r.setState({ surface: 'popup', dragging: true })
  assert.deepEqual(follower.evaluate(), { kind: 'idle', reason: 'dragging' })
  r.setState({ surface: 'popup', dragging: false })
  assert.deepEqual(follower.evaluate(), { kind: 'switch', decided: 'tab' })
  assert.deepEqual(r.applied, ['tab', 'tab'])

  follower.dispose()
})
