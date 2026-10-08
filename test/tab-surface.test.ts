import test from 'node:test'
import assert from 'node:assert/strict'

import {
  LEANSPEC_TAB_ID,
  LEANSPEC_TAB_KIND,
  LEANSPEC_TAB_TITLE,
  NO_TAB_CAPABILITY,
  TAB_UNAVAILABLE_HOST,
  TAB_UNAVAILABLE_REGISTRATION,
  createTabController,
  detectTabCapability,
  leanspecTabDefinition,
  readService,
  tabAvailability,
  type TabCapability,
} from '../src/client/tab-surface.ts'

const OPENABLE = {
  sidebarRight: { openTab: () => undefined },
  sidebarRightTabs: { register: () => undefined },
}

function capabilityOf(ctx: unknown): TabCapability {
  return detectTabCapability(ctx)
}

test('a context without any sidebar services reports no tab and does not throw', () => {
  assert.deepEqual(capabilityOf({}), NO_TAB_CAPABILITY)
  assert.deepEqual(capabilityOf({ slots: {} }), NO_TAB_CAPABILITY)
})

test('hostile or absent contexts collapse to "no tab" instead of throwing', () => {
  const hostile = {
    get sidebarRight(): unknown {
      throw new Error('the host changed shape')
    },
  }
  for (const ctx of [null, undefined, 0, 'nope', [], hostile]) {
    assert.deepEqual(capabilityOf(ctx), NO_TAB_CAPABILITY)
  }
})

test('a callable property that throws is treated as missing', () => {
  const ctx = {
    sidebarRight: {
      get openTab(): unknown {
        throw new Error('boom')
      },
    },
    sidebarRightTabs: { register: () => undefined },
  }
  assert.equal(capabilityOf(ctx).canOpen, false)
})

test('both the registry and the open entry point are required (REQ-8.1)', () => {
  assert.equal(capabilityOf({ sidebarRight: { openTab: () => undefined } }).canOpen, false)
  assert.equal(capabilityOf({ sidebarRightTabs: { register: () => undefined } }).canOpen, false)
  assert.equal(capabilityOf({ sidebarRight: { openTab: 1 }, sidebarRightTabs: { register: 2 } }).canOpen, false)
  assert.equal(capabilityOf(OPENABLE).canOpen, true)
})

test('the capability no longer carries a close strategy (2026-10-08 decision)', () => {
  // The tab is one-way: we open and focus it, the host closes it. The measured
  // `close(tabId)` face stays documented in design.md §13 but is not probed, so
  // no code path can ever offer to close a tab.
  const capability = capabilityOf({
    sidebarRight: { openTab: () => undefined, closeTab: () => undefined, close: () => undefined },
    sidebarRightTabs: { register: () => undefined },
  })
  assert.deepEqual(Object.keys(capability).sort(), ['available', 'canOpen', 'registered', 'unavailableReason'])
})

test('the controller probes once at creation and caches the result (REQ-8.1)', () => {
  let probes = 0
  const controller = createTabController(() => {
    probes += 1
    return capabilityOf(OPENABLE)
  })
  assert.equal(probes, 1)
  controller.capability()
  controller.isOpen()
  assert.equal(probes, 1)
  controller.refresh()
  assert.equal(probes, 2)
})

test('the registration outcome is observable and only notifies on real change', () => {
  const controller = createTabController(() => capabilityOf(OPENABLE))
  const seen: boolean[] = []
  controller.subscribe(() => seen.push(controller.capability().available))

  controller.noteRegistration(true)
  assert.equal(controller.capability().available, true)
  assert.deepEqual(seen, [true])

  // A no-op repeat must not notify again.
  controller.noteRegistration(true)
  assert.deepEqual(seen, [true])

  controller.noteRegistration(false)
  assert.deepEqual(seen, [true, false])
})

test('open state is observable and only notifies on real change', () => {
  const controller = createTabController(() => capabilityOf(OPENABLE))
  let notifications = 0
  controller.subscribe(() => {
    notifications += 1
  })

  assert.equal(controller.isOpen(), false)
  controller.markOpen(false)
  assert.equal(notifications, 0)
  controller.markOpen(true)
  assert.equal(controller.isOpen(), true)
  assert.equal(notifications, 1)
  controller.markOpen(true)
  assert.equal(notifications, 1)
})

test('refresh picks up a host that grew a tab capability later', () => {
  let capability = NO_TAB_CAPABILITY
  const controller = createTabController(() => capability)
  assert.equal(controller.capability().canOpen, false)

  capability = capabilityOf({ sidebarRight: { openTab: () => undefined }, sidebarRightTabs: { register: () => undefined } })
  const seen: boolean[] = []
  controller.subscribe(() => seen.push(controller.capability().canOpen))
  controller.refresh()

  assert.equal(controller.capability().canOpen, true)
  assert.deepEqual(seen, [true])
})

test('unsubscribing stops notifications, including from inside a notification', () => {
  const controller = createTabController(() => capabilityOf(OPENABLE))
  const log: string[] = []
  const off = controller.subscribe(() => log.push('first'))
  controller.subscribe(() => {
    log.push('second')
    off()
  })

  controller.markOpen(true)
  assert.deepEqual(log, ['first', 'second'])

  controller.markOpen(false)
  assert.deepEqual(log, ['first', 'second', 'second'])
})

test('the contributed tab type is a page type with our own id (T2.2)', () => {
  const definition = leanspecTabDefinition()
  assert.equal(definition.id, LEANSPEC_TAB_ID)
  assert.equal(definition.kind, LEANSPEC_TAB_KIND)
  assert.equal(definition.title('sidebar://leanspec'), LEANSPEC_TAB_TITLE)
  // A package-style id, never the reserved first-party prefix.
  assert.equal(LEANSPEC_TAB_ID.startsWith('@deepseek-ai'), false)
  // A page type: the registry consults patterns/canOpen for resource addresses
  // only, and priority is left to the host's own DEFAULT_BAND.
  assert.equal('patterns' in definition, false)
  assert.equal('canOpen' in definition, false)
  assert.equal('priority' in definition, false)
})

test('services are read through get() first, then the plain property', () => {
  assert.equal(
    readService({ get: () => 'from-get', sidebarRightTabs: 'from-prop' }, 'sidebarRightTabs'),
    'from-get',
  )
  assert.equal(readService({ get: () => undefined, slots: 'from-prop' }, 'slots'), 'from-prop')
  assert.equal(
    readService({ get() { throw new Error('older host') }, slots: 'from-prop' }, 'slots'),
    'from-prop',
  )
  assert.equal(readService(null, 'sidebarRight'), undefined)
})

test('a host exposing only get() is probed through it', () => {
  const registry = { register: () => undefined }
  const sidebar = { openTab: () => undefined }
  const ctx = {
    get: (name: string): unknown => (name === 'sidebarRightTabs' ? registry : name === 'sidebarRight' ? sidebar : undefined),
  }
  assert.equal(capabilityOf(ctx).canOpen, true)
})

test('availability needs both the host shape and a registration (REQ-8.2)', () => {
  assert.deepEqual(tabAvailability({ canOpen: true, registered: true }), {
    available: true,
    unavailableReason: undefined,
  })
  assert.deepEqual(tabAvailability({ canOpen: true, registered: false }), {
    available: false,
    unavailableReason: TAB_UNAVAILABLE_REGISTRATION,
  })
  assert.deepEqual(tabAvailability({ canOpen: false, registered: true }), {
    available: false,
    unavailableReason: TAB_UNAVAILABLE_HOST,
  })
})

test('an unregistered openable host reports why it is not usable yet', () => {
  const capability = capabilityOf(OPENABLE)
  assert.equal(capability.canOpen, true)
  assert.equal(capability.registered, false)
  assert.equal(capability.available, false)
  assert.equal(capability.unavailableReason, TAB_UNAVAILABLE_REGISTRATION)
  assert.equal(capabilityOf({}).unavailableReason, TAB_UNAVAILABLE_HOST)
})

test('a held registration makes the surface available, losing it does not', () => {
  const controller = createTabController(() => capabilityOf(OPENABLE))
  const states: Array<boolean | undefined> = []
  controller.subscribe(() => states.push(controller.capability().available))

  controller.noteRegistration(true)
  assert.equal(controller.capability().registered, true)
  assert.equal(controller.capability().available, true)
  assert.equal(controller.capability().unavailableReason, undefined)
  assert.deepEqual(states, [true])

  // A no-op repeat must not notify again.
  controller.noteRegistration(true)
  assert.deepEqual(states, [true])

  controller.noteRegistration(false)
  assert.equal(controller.capability().available, false)
  assert.equal(controller.capability().unavailableReason, TAB_UNAVAILABLE_REGISTRATION)
  assert.deepEqual(states, [true, false])
})
