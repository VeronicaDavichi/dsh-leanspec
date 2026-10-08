import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apply, inject, name } from '../src/client/index.ts'

test('client apply injects a header utility beside session log', () => {
  assert.deepEqual(inject, ['slots'])
  assert.equal(typeof name, 'string')
  const registrations: Array<{ options: Record<string, unknown> }> = []
  const ctx = {
    slots: {
      inject(slotName: string, factory: () => unknown) {
        assert.equal(slotName, 'conversation.session.header.utilities')
        factory()
      },
      register(options: Record<string, unknown>, component: unknown) {
        registrations.push({ options })
        assert.equal(typeof component, 'function')
        return options
      },
    },
  }
  apply(ctx)
  assert.equal(registrations.length, 1)
  assert.equal(registrations[0].options.name, 'conversation.session.header.utilities')
  assert.equal(registrations[0].options.id, 'leanspec-web-viewer')
  assert.equal(registrations[0].options.label, 'LeanSpec')
})

test('the header seat carries the host sidebarMounted hook when the host has one (REQ-1.6)', () => {
  const registrations: Array<{ options: Record<string, unknown> }> = []
  const mounted = (): boolean => true
  const ctx = {
    get: (name: string): unknown => (name === 'sidebarRight' ? { mounted } : undefined),
    slots: {
      inject: (_name: string, factory: () => unknown) => {
        factory()
      },
      register(options: Record<string, unknown>) {
        registrations.push({ options })
        return options
      },
    },
  }

  apply(ctx)

  const inject = registrations[0]?.options.inject as (() => Record<string, unknown>) | undefined
  assert.equal(typeof inject, 'function', 'the host resolves `inject` when it renders the seat')
  assert.deepEqual(inject?.(), { hooks: { sidebarMounted: mounted } })
})

test('a host without a right sidebar gets an empty injection, never a throw (REQ-8.1)', () => {
  const registrations: Array<{ options: Record<string, unknown> }> = []
  const ctx = {
    get: (): unknown => undefined,
    slots: {
      inject: (_name: string, factory: () => unknown) => {
        factory()
      },
      register(options: Record<string, unknown>) {
        registrations.push({ options })
        return options
      },
    },
  }

  apply(ctx)

  const inject = registrations[0]?.options.inject as (() => Record<string, unknown>) | undefined
  assert.deepEqual(inject?.(), {})

  // A `get` that throws is the same story: the popup must keep working.
  const hostile = {
    get: (): unknown => {
      throw new Error('the host changed shape')
    },
    slots: ctx.slots,
  }
  const before = registrations.length
  apply(hostile)
  const second = registrations[before]?.options.inject as (() => Record<string, unknown>) | undefined
  assert.deepEqual(second?.(), {}, 'a hostile probe degrades to "no hook", not to a broken header')
})
