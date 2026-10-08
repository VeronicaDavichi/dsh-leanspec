import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createStore } from '../src/client/store.ts'

/**
 * REQ-3.4 / REQ-4.3 — the shared store's contract.
 *
 * Tiny on purpose, but it is what makes "two exits, one panel" true, so the
 * unsubscribe path gets tested rather than assumed: the plugin contract
 * requires every contribution to unload cleanly.
 */

test('createStore hands out the latest value and notifies subscribers', () => {
  const store = createStore({ count: 0 })
  const seen: number[] = []
  store.subscribe(() => { seen.push(store.getState().count) })

  store.setState({ count: 1 })
  store.setState({ count: 2 })

  assert.deepEqual(seen, [1, 2])
  assert.equal(store.getState().count, 2)
})

test('createStore stops notifying after unsubscribe (REQ-4.3)', () => {
  const store = createStore(0)
  let calls = 0
  const unsubscribe = store.subscribe(() => { calls += 1 })

  store.setState(1)
  unsubscribe()
  store.setState(2)

  assert.equal(calls, 1)
  assert.equal(store.getState(), 2, 'the value still moves — only the listener is gone')
})

test('createStore ignores an identical value so renders do not churn', () => {
  const store = createStore({ count: 0 })
  let calls = 0
  store.subscribe(() => { calls += 1 })

  store.setState(store.getState())

  assert.equal(calls, 0)
})

test('createStore tolerates a listener unsubscribing mid-notify', () => {
  const store = createStore(0)
  const seen: string[] = []
  const unsubscribeFirst = store.subscribe(() => {
    seen.push('first')
    unsubscribeFirst()
  })
  store.subscribe(() => { seen.push('second') })

  store.setState(1)
  store.setState(2)

  assert.deepEqual(seen, ['first', 'second', 'second'])
})
