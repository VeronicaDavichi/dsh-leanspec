import assert from 'node:assert/strict'
import fs from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
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

/** A real 1x1 PNG built at run time: no binary fixture is committed. */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
)

const PNG_REL = '001-demo-change/assets/tiny.png'
const OVERSIZE = 20 * 1024 * 1024

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

/**
 * The plain `seed()` plus a PNG and an HTML page. Kept separate so the file
 * count assertions above keep seeing exactly the two markdown files.
 */
function seedMedia(): { root: string; pngPath: string; bytes: Buffer } {
  const root = seed()
  const pngPath = path.join(root, 'specs', PNG_REL)
  fs.mkdirSync(path.dirname(pngPath), { recursive: true })
  fs.writeFileSync(pngPath, TINY_PNG)
  fs.writeFileSync(path.join(root, 'specs', '001-demo-change', 'page.html'), '<h1>secret page</h1>\n')
  return { root, pngPath, bytes: fs.readFileSync(pngPath) }
}

async function getRaw(root: string, relative: string, method = 'GET'): Promise<Awaited<ReturnType<typeof handleLeanspecHttp>>> {
  return await handleLeanspecHttp({
    method,
    pathname: '/leanspec-viewer/raw',
    searchParams: new URLSearchParams({ root, path: relative }),
  })
}

test('GET /tree returns present=false when the project has no LeanSpec', async () => {
  const result = await handleLeanspecHttp({
    method: 'GET',
    pathname: '/leanspec-viewer/tree',
    searchParams: new URLSearchParams(),
  })
  assert.equal(result.status, 200)
  assert.deepEqual(result.body, {
    present: false,
    specs: [],
    files: [],
    dirs: [],
    statusByDir: {},
    message: NO_LEANSPEC_MESSAGE,
  })
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
  assert.deepEqual(result.body, {
    present: false,
    specs: [],
    files: [],
    dirs: [],
    statusByDir: {},
    message: NO_LEANSPEC_MESSAGE,
  })
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

test('GET /tree carries statusByDir parsed from each spec README', async () => {
  const root = seed()
  fs.writeFileSync(
    path.join(root, 'specs', '001-demo-change', 'README.md'),
    '---\nstatus: in-progress\n---\n\n# Hello\n',
  )
  const result = await handleLeanspecHttp({
    method: 'GET',
    pathname: '/leanspec-viewer/tree',
    searchParams: rootParams(root),
  })
  assert.equal(result.status, 200)
  const body = result.body as { statusByDir: Record<string, string> }
  assert.deepEqual(body.statusByDir, { '001-demo-change': 'in-progress' })
})

test('GET /tree returns an empty statusByDir when nothing parses', async () => {
  const root = seed()
  const result = await handleLeanspecHttp({
    method: 'GET',
    pathname: '/leanspec-viewer/tree',
    searchParams: rootParams(root),
  })
  assert.equal(result.status, 200)
  const body = result.body as { statusByDir: Record<string, string> }
  assert.deepEqual(body.statusByDir, {})
})

test('GET /raw serves the exact bytes with the fixed mime type and no-cache', async () => {
  const { root, bytes } = seedMedia()
  const result = await getRaw(root, PNG_REL)
  assert.equal(result.status, 200)
  assert.equal(result.body, undefined, 'a binary response carries no JSON envelope')
  assert.equal(result.binary?.contentType, 'image/png')
  assert.equal(result.binary?.headers?.['cache-control'], 'no-cache')
  assert.equal(result.binary?.bytes.equals(bytes), true, 'bytes must round-trip unchanged')
  assert.equal(result.binary?.bytes.length, TINY_PNG.length)
})

test('GET /raw without a path is a 400', async () => {
  const { root } = seedMedia()
  const attempts: URLSearchParams[] = [
    new URLSearchParams({ root }),
    new URLSearchParams({ root, path: '' }),
    new URLSearchParams({ root, path: '   ' }),
  ]
  for (const searchParams of attempts) {
    const result = await handleLeanspecHttp({ method: 'GET', pathname: '/leanspec-viewer/raw', searchParams })
    assert.equal(result.status, 400)
    assert.equal(result.binary, undefined)
  }
})

test('GET /raw refuses a type outside the allow-list without echoing any content', async () => {
  const { root } = seedMedia()
  const rejected = [
    '001-demo-change/page.html',
    '001-demo-change/README.md',
    '001-demo-change/no-extension',
    '001-demo-change/',
    '001-demo-change/index.html/',
  ]
  for (const relative of rejected) {
    const result = await getRaw(root, relative)
    assert.equal(result.status, 415, `${relative} must be refused as unsupported media`)
    assert.equal(result.binary, undefined)
    const serialised = JSON.stringify(result.body)
    assert.equal(serialised.includes('secret page'), false, `${relative} leaked its content`)
    assert.equal(serialised.includes('# Hello'), false, `${relative} leaked its content`)
    assert.equal(serialised.includes(root), false, `${relative} leaked the absolute path`)
  }
})

test('GET /raw is a 404 when an allow-listed file is missing', async () => {
  const { root } = seedMedia()
  const result = await getRaw(root, '001-demo-change/assets/missing.png')
  assert.equal(result.status, 404)
  assert.equal(result.binary, undefined)
  assert.equal(JSON.stringify(result.body).includes(root), false, 'the absolute path must not leak')
})

test('GET /raw is a 413 for an oversize file, decided before it is read', async () => {
  const { root, pngPath } = seedMedia()
  // Sparse: only the size in the stat matters, and the read must never happen.
  fs.truncateSync(pngPath, OVERSIZE + 1)
  const result = await getRaw(root, PNG_REL)
  assert.equal(result.status, 413)
  assert.equal(result.binary, undefined)
  assert.equal(fs.statSync(pngPath).size, OVERSIZE + 1)
})

test('GET /raw is a 403 when the path escapes the spec tree', async () => {
  const { root } = seedMedia()
  const outside = path.join(root, 'outside.png')
  fs.writeFileSync(outside, TINY_PNG)
  const attempts = ['../outside.png', '../../outside.png', '001-demo-change/../../outside.png', outside]
  for (const relative of attempts) {
    const result = await getRaw(root, relative)
    assert.equal(result.status, 403, `${relative} must be refused as out of root`)
    assert.equal(result.binary, undefined)
    assert.equal(JSON.stringify(result.body).includes('iVBOR'), false)
  }
})

test('GET /raw is a 403 for a directory instead of a regular file', async () => {
  const { root } = seedMedia()
  // A directory whose name still passes the allow-list: the suffix decides the
  // media type, and only the stat can tell that it is not a file at all.
  fs.mkdirSync(path.join(root, 'specs', '001-demo-change', 'assets', 'dir.png'), { recursive: true })
  const result = await getRaw(root, '001-demo-change/assets/dir.png')
  assert.equal(result.status, 403)
  assert.equal(result.binary, undefined)
})

test('HEAD /raw returns the same headers with an empty body', async () => {
  const { root, pngPath, bytes } = seedMedia()
  const result = await getRaw(root, PNG_REL, 'HEAD')
  assert.equal(result.status, 200)
  assert.equal(result.binary?.contentType, 'image/png')
  assert.equal(result.binary?.headers?.['cache-control'], 'no-cache')
  assert.equal(result.binary?.bytes.length, 0, 'HEAD must not carry the payload')
  assert.equal(bytes.length, TINY_PNG.length)

  fs.truncateSync(pngPath, OVERSIZE + 1)
  const oversize = await getRaw(root, PNG_REL, 'HEAD')
  assert.equal(oversize.status, 413, 'a failed load must be diagnosable with HEAD')
})

test('GET /raw rejects a symlink that points outside the spec tree', async () => {
  const { root } = seedMedia()
  const outside = path.join(root, 'outside.png')
  fs.writeFileSync(outside, TINY_PNG)
  const link = path.join(root, 'specs', '001-demo-change', 'assets', 'link.png')
  try {
    fs.symlinkSync(outside, link, 'file')
  } catch {
    // Windows without developer mode: the guard is already covered by ../ above.
    return
  }
  const result = await getRaw(root, '001-demo-change/assets/link.png')
  assert.equal(result.status, 403)
})

test('the host bridge answers nosniff on both branches and never trusts the request type', async () => {
  const { root, bytes } = seedMedia()
  const json = await throughHost('GET', `/leanspec-viewer/tree?${rootParams(root).toString()}`)
  assert.equal(json.status, 200)
  assert.equal(json.headers['content-type'], 'application/json; charset=utf-8')
  assert.equal(json.headers['x-content-type-options'], 'nosniff')
  assert.match(json.body.toString('utf8'), /001-demo-change/)

  const query = new URLSearchParams({ root, path: PNG_REL, type: 'text/html' })
  const raw = await throughHost('GET', `/leanspec-viewer/raw?${query.toString()}`, { accept: 'text/html' })
  assert.equal(raw.status, 200)
  assert.equal(raw.headers['content-type'], 'image/png', 'only the allow-list table decides the type')
  assert.equal(raw.headers['x-content-type-options'], 'nosniff')
  assert.equal(raw.headers['cache-control'], 'no-cache')
  assert.equal(raw.body.equals(bytes), true)

  const head = await throughHost('HEAD', `/leanspec-viewer/raw?${rootParams(root).toString()}&path=${encodeURIComponent(PNG_REL)}`)
  assert.equal(head.status, 200)
  assert.equal(head.body.length, 0)
  assert.equal(head.headers['content-type'], 'image/png')
})

/**
 * Drives the real registration through the host bridge (`src/index.ts`) instead
 * of the route table, which is the only place the response headers exist.
 */
async function throughHost(
  method: string,
  url: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; headers: Record<string, string>; body: Buffer }> {
  type Handler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  const handlers: Handler[] = []
  apply({
    webServer: {
      register(route: { kind: 'exact' | 'prefix'; path: string; handler: Handler }) {
        handlers.push(route.handler)
        return () => {}
      },
    },
    effect(fn: () => (() => void) | void) {
      fn()
    },
  })
  assert.equal(handlers.length, 1, 'the plugin registers exactly one prefix handler')

  const captured = { status: 0, headers: {} as Record<string, string>, body: Buffer.alloc(0) }
  const request = {
    method,
    url,
    headers: { host: '127.0.0.1', ...headers },
    async *[Symbol.asyncIterator]() {
      // No request body: these are read-only routes.
    },
  } as unknown as IncomingMessage
  const response = {
    writeHead(status: number, outgoing?: Record<string, string>) {
      captured.status = status
      captured.headers = { ...(outgoing ?? {}) }
      return this
    },
    end(chunk?: unknown) {
      captured.body = Buffer.isBuffer(chunk) ? Buffer.from(chunk) : Buffer.from(String(chunk ?? ''))
      return this
    },
  } as unknown as ServerResponse

  await handlers[0]?.(request, response)
  return captured
}
