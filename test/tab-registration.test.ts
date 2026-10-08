import assert from 'node:assert/strict'
import { test } from 'node:test'

import { LeanspecViewer } from '../src/client/LeanspecViewer.ts'
import { LeanspecSidebarTab, LeanspecTabTitle, LeanspecTabView } from '../src/client/LeanspecSidebarTab.ts'
import { apply } from '../src/client/index.ts'
import {
  applySidebarTab,
  leanspecTabIsOpen,
  openLeanspecTab,
  subscribeTabCapability,
  tabCapability,
} from '../src/client/tab-registration.ts'
import {
  LEANSPEC_TAB_ID,
  LEANSPEC_TAB_KIND,
  LEANSPEC_TAB_TITLE,
  TAB_UNAVAILABLE_HOST,
  TAB_UNAVAILABLE_REGISTRATION,
} from '../src/client/tab-surface.ts'

/**
 * A stand-in for the pinned host: `SidebarRightTabRegistry` (id/kind conflicts
 * throw, `register` returns an idempotent disposer), the navigation controller,
 * the keyed slot seats, and `ctx.effect` / `ctx.inject`.
 *
 * The shapes are copied from the measured implementation in `app.asar` (see
 * design.md §13), so these tests fail when our registration stops looking like
 * something the real host would accept — not merely when it stops calling a mock.
 */
type Definition = { id: string; kind: string; title: (address: string) => string }
type Seat = { name: string; key: unknown; options: Record<string, unknown>; component: unknown }

interface HarnessOptions {
  /** A type registration that meets an id already in use. */
  duplicateType?: boolean
  /** A seat the host refuses to inject, because its slot is not declared. */
  failSeat?: string
  /** Keep the services away until `reveal()` — the "host not ready yet" case. */
  deferred?: boolean
  /** The navigation controller refuses every open (no Session on screen). */
  refuseOpen?: boolean
}

interface Harness {
  ctx: Record<string, unknown>
  seats: Seat[]
  openCalls: Array<{ kind: string; options: Record<string, unknown> }>
  effectLabels: string[]
  deps: unknown[]
  /** Registered types, by id. */
  typeIds(): string[]
  typeOf(kind: string): Definition | undefined
  /** Effects not yet cleaned up. */
  liveEffects(): number
  /** Lets the deferred services arrive. */
  reveal(): void
  /** What the host does on unload. */
  dispose(): void
}

function harness(options: HarnessOptions = {}): Harness {
  const types = new Map<string, Definition>()
  const seats: Seat[] = []
  const openCalls: Harness['openCalls'] = []
  const effectLabels: string[] = []
  const deps: unknown[] = []
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
    register(definition: Definition): () => void {
      if (options.duplicateType === true || types.has(definition.id)) {
        throw new Error(`sidebarRight: tab type id "${definition.id}" is already registered`)
      }
      types.set(definition.id, definition)
      return () => {
        types.delete(definition.id)
      }
    },
    get: (kind: string): Definition | undefined => [...types.values()].find(entry => entry.kind === kind),
    subscribe: (): (() => void) => () => undefined,
  }

  const sidebar = {
    openTab(kind: string, openOptions: Record<string, unknown>): void {
      if (options.refuseOpen === true || registry.get(kind) === undefined) {
        throw new Error(`sidebarRight: no tab type is registered as "${kind}"`)
      }
      openCalls.push({ kind, options: openOptions })
    },
  }

  const slots = {
    inject(name: string, factory: () => unknown): () => void {
      if (options.failSeat === name) throw new Error(`slot "${name}" is not declared`)
      const disposeSeat = factory()
      return () => {
        if (typeof disposeSeat === 'function') (disposeSeat as () => void)()
      }
    },
    register(seatOptions: Record<string, unknown>, component: unknown): () => void {
      const seat: Seat = {
        name: String(seatOptions.name),
        key: seatOptions.key,
        options: seatOptions,
        component,
      }
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
    effect(callback: () => unknown, label?: string): () => void {
      effectLabels.push(String(label))
      return effect(callback)
    },
  }

  let arrive: (() => void) | null = null
  const disposeScope = (): void => {
    for (const dispose of [...pending]) dispose()
  }

  const ctx = {
    slots: { inject: (): void => undefined, register: (): void => undefined },
    inject(requested: unknown, run: (target: unknown) => void): () => void {
      deps.push(requested)
      if (options.deferred === true) arrive = () => { run(scope) }
      else run(scope)
      return disposeScope
    },
  }

  return {
    ctx,
    seats,
    openCalls,
    effectLabels,
    deps,
    typeIds: () => [...types.keys()],
    typeOf: kind => [...types.values()].find(entry => entry.kind === kind),
    liveEffects: () => pending.size,
    reveal: () => { arrive?.() },
    dispose: disposeScope,
  }
}

/** Applies the tab wiring and always tears it down, so the module singleton resets. */
function withTab<T>(ctx: unknown, body: () => T): T {
  const dispose = applySidebarTab(ctx)
  try {
    return body()
  } finally {
    dispose()
  }
}

/** Every element of a rendered tree, for class assertions without a renderer. */
function walk(node: unknown, out: Array<{ type: unknown; props: Record<string, unknown> }> = []) {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, out)
    return out
  }
  if (node === null || typeof node !== 'object') return out
  const element = node as { type: unknown; props: Record<string, unknown> }
  if (element.props === undefined || element.props === null) return out
  out.push(element)
  walk(element.props.children, out)
  return out
}

function findClass(tree: unknown, className: string): unknown[] {
  return walk(tree).filter(child => String(child.props.className ?? '')
    .split(/\s+/)
    .includes(className))
}

test('the type is registered first, then the body and the chip under its id (T2.2)', () => {
  const host = harness()
  withTab(host.ctx, () => {
    assert.deepEqual(host.deps, [['sidebarRightTabs', 'sidebarRight']])
    assert.deepEqual(host.typeIds(), [LEANSPEC_TAB_ID])
    assert.equal(host.seats.length, 2)

    const definition = host.typeOf(LEANSPEC_TAB_KIND)
    assert.equal(definition?.id, LEANSPEC_TAB_ID)
    assert.equal(definition?.title('sidebar://leanspec'), LEANSPEC_TAB_TITLE)

    const [body, title] = host.seats
    assert.equal(body.name, 'sidebar.right.pane.tab')
    assert.equal(body.key, LEANSPEC_TAB_ID)
    assert.equal(body.options.name, 'sidebar.right.pane.tab')
    assert.equal(body.component, LeanspecSidebarTab)

    assert.equal(title.name, 'sidebar.right.pane.tab.title')
    assert.equal(title.key, LEANSPEC_TAB_ID)
    assert.equal(title.component, LeanspecTabTitle)

    // Every registration is owned by an effect, so unload can reach it.
    assert.deepEqual(host.effectLabels, [
      'leanspec: sidebar tab type',
      'leanspec: sidebar.right.pane.tab',
      'leanspec: sidebar.right.pane.tab.title',
      'leanspec: sidebar tab opener',
      'leanspec: sidebar tab availability',
    ])
    assert.equal(host.liveEffects(), 5)
  })
})

test('the tab body is the existing panel, and nothing else (2026-10-08 decision)', () => {
  // The registered occupant is a hook shell (it publishes mount/unmount to the
  // store), so what a test can call is the view it renders.
  const element = LeanspecTabView()
  const viewer = walk(element).find(child => child.type === LeanspecViewer)
  assert.ok(viewer, 'the body renders the existing panel')
  assert.equal(findClass(element, 'dsh-leanspec-popover').length, 0,
    'no popover shell: the host pane already draws the tab frame')
  assert.equal(findClass(element, 'dsh-leanspec-shell').length, 0,
    'the viewer is a component element, not an inlined shell')
  // The tab is one-way: no bar, no button, no placeholder pointing at the popup.
  assert.equal(findClass(element, 'dsh-leanspec-switchbar').length, 0)
  assert.equal(findClass(element, 'dsh-leanspec-tab-notice').length, 0)
  assert.equal(
    walk(element).filter(child => child.props['data-leanspec-switch'] !== undefined).length,
    0,
    'no surface switch control exists inside the tab',
  )

  const title = LeanspecTabTitle()
  assert.equal(title.type, 'span')
  assert.deepEqual((title.props as { children?: unknown }).children, 'LeanSpec')
})

test('a host without the scope form degrades to popup-only without throwing', () => {
  withTab({ slots: { inject: () => undefined } }, () => {
    assert.equal(tabCapability().available, false)
    assert.equal(tabCapability().unavailableReason, TAB_UNAVAILABLE_HOST)
    assert.deepEqual(openLeanspecTab(), { ok: false, reason: TAB_UNAVAILABLE_HOST })
    assert.equal(leanspecTabIsOpen(), false)
  })
})

test('a host whose services arrive later becomes available on arrival', () => {
  const host = harness({ deferred: true })
  withTab(host.ctx, () => {
    assert.deepEqual(host.deps, [['sidebarRightTabs', 'sidebarRight']])
    assert.equal(tabCapability().available, false)
    assert.equal(tabCapability().unavailableReason, TAB_UNAVAILABLE_HOST)
    assert.deepEqual(host.typeIds(), [])

    host.reveal()
    assert.deepEqual(host.typeIds(), [LEANSPEC_TAB_ID])
    assert.equal(host.seats.length, 2)
    assert.equal(tabCapability().available, true)
    assert.equal(tabCapability().unavailableReason, undefined)
  })
})

test('a duplicate type id is caught and reported, never thrown at the click', () => {
  const host = harness({ duplicateType: true })
  withTab(host.ctx, () => {
    assert.deepEqual(host.typeIds(), [])
    assert.equal(host.seats.length, 0)
    assert.equal(host.liveEffects(), 0)
    assert.equal(tabCapability().available, false)
    assert.equal(tabCapability().unavailableReason, TAB_UNAVAILABLE_REGISTRATION)
    assert.equal(openLeanspecTab().ok, false)
  })
})

test('a seat that cannot be injected rolls the whole registration back', () => {
  const host = harness({ failSeat: 'sidebar.right.pane.tab' })
  withTab(host.ctx, () => {
    // The type registered, the body did not: nothing may be left half-wired.
    assert.deepEqual(host.typeIds(), [])
    assert.equal(host.seats.length, 0)
    assert.equal(host.liveEffects(), 0)
    assert.equal(tabCapability().available, false)
    assert.equal(tabCapability().unavailableReason, TAB_UNAVAILABLE_REGISTRATION)
  })
})

test('unloading clears the opener, the type and both seats (REQ-4.3)', () => {
  const host = harness()
  const dispose = applySidebarTab(host.ctx)
  assert.equal(openLeanspecTab().ok, true)
  assert.equal(leanspecTabIsOpen(), true)

  dispose()
  assert.deepEqual(host.typeIds(), [])
  assert.equal(host.seats.length, 0)
  assert.equal(host.liveEffects(), 0)
  assert.equal(tabCapability().available, false)
  assert.equal(leanspecTabIsOpen(), false)
  assert.equal(openLeanspecTab().ok, false)
})

test('opening passes the kind and params the host contract expects', () => {
  const host = harness()
  withTab(host.ctx, () => {
    assert.deepEqual(openLeanspecTab(), { ok: true })
    assert.deepEqual(openLeanspecTab({ params: { source: 'popup' } }), { ok: true })
    assert.deepEqual(openLeanspecTab({ revealIfOpened: false }), { ok: true })

    assert.deepEqual(host.openCalls, [
      { kind: LEANSPEC_TAB_KIND, options: { params: {} } },
      { kind: LEANSPEC_TAB_KIND, options: { params: { source: 'popup' } } },
      { kind: LEANSPEC_TAB_KIND, options: { params: {}, revealIfOpened: false } },
    ])
    assert.equal(leanspecTabIsOpen(), true)
  })
})

test('a host that refuses the tab yields a reason instead of an exception (REQ-8.2)', () => {
  const host = harness({ refuseOpen: true })
  withTab(host.ctx, () => {
    const result = openLeanspecTab()
    assert.equal(result.ok, false)
    assert.match(result.ok ? '' : result.reason, /no tab type is registered/)
    assert.equal(leanspecTabIsOpen(), false)
  })
})

test('capability changes are observable for the future disabled control (T3.5)', () => {
  const host = harness()
  const seen: boolean[] = []
  const off = subscribeTabCapability(() => seen.push(tabCapability().available))
  const dispose = applySidebarTab(host.ctx)
  try {
    assert.equal(tabCapability().available, true)
    // The arrival of the services flipped `available` to true, and the listener saw it.
    assert.equal(seen.includes(true), true)

    off()
    const afterUnsubscribe = seen.length
    dispose()
    // Unsubscribed: the teardown notification is not delivered here.
    assert.equal(seen.length, afterUnsubscribe)
    assert.equal(tabCapability().available, false)
    assert.equal(leanspecTabIsOpen(), false)
  } finally {
    dispose()
  }
})

test('the client entry wires the header entry and the right-sidebar tab together', () => {
  const host = harness()
  const headers: Array<Record<string, unknown>> = []
  const ctx = {
    slots: {
      inject(name: string, factory: () => unknown): void {
        assert.equal(name, 'conversation.session.header.utilities')
        factory()
      },
      register(options: Record<string, unknown>): unknown {
        headers.push(options)
        return options
      },
    },
    inject: host.ctx.inject,
  }

  apply(ctx)
  try {
    assert.equal(headers.length, 1)
    assert.equal(headers[0].label, 'LeanSpec')
    assert.deepEqual(host.typeIds(), [LEANSPEC_TAB_ID])
    assert.deepEqual(host.seats.map(seat => seat.name), [
      'sidebar.right.pane.tab',
      'sidebar.right.pane.tab.title',
    ])
  } finally {
    host.dispose()
  }
})
