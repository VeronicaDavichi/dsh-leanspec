import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, test } from 'node:test'
import { apply } from '../src/index.ts'
import { handleLeanspecHttp } from '../src/http.ts'
import { NO_LEANSPEC_MESSAGE } from '../src/leanspec-fs.ts'

const fixtures: string[] = []

afterEach(() => {
  for (const dir of fixtures.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

function seed(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-leanspec-http-'))
  fixtures.push(root)
  const specs = path.join(root, 'specs')
  fs.mkdirSync(path.join(specs, '001-demo-change'), { recursive: true })
  fs.writeFileSync(path.join(specs, '001-demo-change', 'README.md'), '# Hello\n')
  fs.writeFileSync(path.join(specs, '001-demo-change', 'design.md'), '# Design\n')
  return root
}

function rootParams(root: string): URLSearchParams {
  return new URLSearchParams({ root })
}

test('GET /tree returns present=false when the project has no LeanSpec', async () => {
  const result = await handleLeanspecHttp({
    method: 'GET',
    pathname: '/leanspec-viewer/tree',
    searchParams: new URLSearchParams(),
  })
  assert.equal(result.status, 200)
  assert.deepEqual(result.body, { present: false, specs: [], files: [], dirs: [], message: NO_LEANSPEC_MESSAGE })
})

test('GET /tree returns present=false for a directory without specs/', async () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-leanspec-empty-'))
  fixtures.push(empty)
  const result = await handleLeanspecHttp({
    method: 'GET',
    pathname: '/leanspec-viewer/tree',
    searchParams: rootParams(empty),
  })
  assert.equal(result.status, 200)
  assert.deepEqual(result.body, { present: false, specs: [], files: [], dirs: [], message: NO_LEANSPEC_MESSAGE })
})

test('GET /tree lists every LeanSpec spec directory and files', async () => {
  const root = seed()
  const result = await handleLeanspecHttp({
    method: 'GET',
    pathname: '/leanspec-viewer/tree',
    searchParams: rootParams(root),
  })
  assert.equal(result.status, 200)
  const body = result.body as { present: boolean; specs: string[]; files: string[]; dirs: string[] }
  assert.equal(body.present, true)
  assert.deepEqual(body.specs, ['001-demo-change'])
  assert.equal(body.files.length, 2)
  assert.ok(body.files.includes('001-demo-change/README.md'))
  assert.ok(body.files.includes('001-demo-change/design.md'))
  assert.deepEqual(body.dirs, [])
})

test('GET /file returns content by path under specs/', async () => {
  const root = seed()
  const result = await handleLeanspecHttp({
    method: 'GET',
    pathname: '/leanspec-viewer/file',
    searchParams: new URLSearchParams({ root, path: '001-demo-change/README.md' }),
  })
  assert.equal(result.status, 200)
  assert.deepEqual(result.body, { content: '# Hello\n' })
})

test('GET /file rejects path traversal with 403 or 400', async () => {
  const root = seed()
  const result = await handleLeanspecHttp({
    method: 'GET',
    pathname: '/leanspec-viewer/file',
    searchParams: new URLSearchParams({
      root,
      path: '../secret.md',
    }),
  })
  assert.ok(result.status === 400 || result.status === 403)
  assert.equal(typeof (result.body as { error: string }).error, 'string')
})

test('PUT /file overwrites an existing file under specs/', async () => {
  const root = seed()
  const result = await handleLeanspecHttp({
    method: 'PUT',
    pathname: '/leanspec-viewer/file',
    searchParams: new URLSearchParams(),
    body: JSON.stringify({
      root,
      path: '001-demo-change/README.md',
      content: '# Saved\n',
    }),
  })
  assert.equal(result.status, 200)
  assert.equal(
    fs.readFileSync(path.join(root, 'specs', '001-demo-change', 'README.md'), 'utf8'),
    '# Saved\n',
  )
})

test('apply registers /leanspec-viewer and unregistering removes it', () => {
  const routes = new Map<string, unknown>()
  const captured: Array<() => void> = []
  const ctx2 = {
    webServer: {
      register(route: { path: string }) {
        routes.clear()
        routes.set(route.path, route)
        const dispose = () => { routes.delete(route.path) }
        captured.push(dispose)
        return dispose
      },
    },
    effect(fn: () => (() => void) | void) {
      const dispose = fn()
      if (typeof dispose === 'function') captured.push(dispose)
    },
  }
  apply(ctx2)
  assert.equal(routes.has('/leanspec-viewer'), true)
  for (const dispose of captured) dispose()
  assert.equal(routes.has('/leanspec-viewer'), false)
})
