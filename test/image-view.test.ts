import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  RAW_ENDPOINT,
  canEditFile,
  imageLoadErrorText,
  rawUrl,
  shouldLoadText,
  viewModesFor,
} from '../src/client/image-view.ts'

test('rawUrl round-trips awkward names through the query string', () => {
  const url = rawUrl('/tmp/my project', 'specs/008/assets/a b&c#d 中文.png')
  const parsed = new URL(url, 'http://127.0.0.1')
  assert.equal(parsed.pathname, RAW_ENDPOINT)
  assert.equal(parsed.searchParams.get('root'), '/tmp/my project')
  // The `&` and `#` must survive inside the value instead of splitting the query.
  assert.equal(parsed.searchParams.get('path'), 'specs/008/assets/a b&c#d 中文.png')
  assert.equal(parsed.searchParams.size, 2)
})

test('rawUrl omits an unknown root so the server default applies', () => {
  const parsed = new URL(rawUrl('', 'a.png'), 'http://127.0.0.1')
  // `withRoot` omits the root for /tree and /file when it is unknown; sending
  // `root=` here was the one asymmetry that could break images while every other
  // request kept working, so this is pinned.
  assert.equal(parsed.searchParams.get('root'), null)
  assert.equal(parsed.searchParams.get('path'), 'a.png')
  assert.equal(parsed.searchParams.size, 1)
})

test('the toolbar offers a source toggle for svg only', () => {
  assert.deepEqual(viewModesFor('assets/logo.svg'), ['preview', 'source', 'edit'])
  assert.deepEqual(viewModesFor('assets/shot.png'), ['preview', 'edit'])
  assert.deepEqual(viewModesFor('specs/007/README.md'), ['preview', 'edit'])
  assert.deepEqual(viewModesFor(null), ['preview', 'edit'])
})

test('no image may be edited, whatever its type', () => {
  for (const image of ['a.png', 'a.jpg', 'a.jpeg', 'a.gif', 'a.webp', 'a.bmp', 'a.avif', 'a.ico', 'a.svg']) {
    assert.equal(canEditFile(image), false, image)
  }
  assert.equal(canEditFile('specs/007/README.md'), true)
  assert.equal(canEditFile('notes.txt'), true)
  assert.equal(canEditFile(null), true)
})

test('text is fetched for documents, and for svg source only', () => {
  assert.equal(shouldLoadText('specs/007/README.md', 'preview'), true)
  assert.equal(shouldLoadText('specs/007/README.md', 'edit'), true)
  assert.equal(shouldLoadText('assets/shot.png', 'preview'), false)
  assert.equal(shouldLoadText('assets/logo.svg', 'preview'), false)
  assert.equal(shouldLoadText('assets/logo.svg', 'source'), true)
  assert.equal(shouldLoadText(null, 'preview'), false)
})

test('failure text names the cause instead of showing a broken image', () => {
  assert.match(imageLoadErrorText(413), /20MB/)
  assert.match(imageLoadErrorText(415), /白名单/)
  assert.match(imageLoadErrorText(403), /不存在/)
  assert.match(imageLoadErrorText(200), /不是有效的图片/)
  assert.match(imageLoadErrorText(0), /网络错误/)
  assert.match(imageLoadErrorText(500), /HTTP 500/)
})

test('a 404 without a code blames the missing route, not the missing file', () => {
  const missingRoute = imageLoadErrorText(404)
  assert.match(missingRoute, /路由不存在/)
  assert.match(missingRoute, /重启/)
  const missingFile = imageLoadErrorText(404, 'not-found')
  assert.match(missingFile, /文件不存在/)
  assert.match(missingFile, /not-found/)
  // Same status, different sentence — that is the entire point of carrying `code`.
  assert.notEqual(missingRoute, missingFile)
})
