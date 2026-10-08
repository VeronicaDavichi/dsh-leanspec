import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  IMAGE_MIME,
  MAX_IMAGE_BYTES,
  imageMimeType,
  isImagePath,
  isSvgPath,
} from '../src/media.ts'

/**
 * The table is the security boundary for the raw endpoint, so it is pinned
 * rather than sampled: adding a type is meant to be a deliberate, visible edit.
 */
test('the allowed table is exactly the nine frozen types', () => {
  assert.deepEqual({ ...IMAGE_MIME }, {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    avif: 'image/avif',
    ico: 'image/x-icon',
    svg: 'image/svg+xml',
  })
})

test('every allowed extension resolves to its MIME type', () => {
  for (const [extension, mime] of Object.entries(IMAGE_MIME)) {
    assert.equal(imageMimeType(`specs/007/assets/shot.${extension}`), mime, extension)
    assert.equal(isImagePath(`specs/007/assets/shot.${extension}`), true, extension)
  }
})

test('the extension match ignores case', () => {
  assert.equal(imageMimeType('SHOT.PNG'), 'image/png')
  assert.equal(imageMimeType('shot.JpEg'), 'image/jpeg')
  assert.equal(isImagePath('assets/LOGO.SVG'), true)
})

test('paths that only look like images are refused', () => {
  const notImages = [
    'README', // no dot at all
    '', // empty path
    'dir.png/', // a directory, not a file
    '.png', // a dotfile named .png, not an extension
    'a.png.txt', // last segment wins
    'a.PNG.ZIP',
    'index.html', // the XSS-relevant one
    'notes.md',
    'client.js',
    'archive.svgz',
    'trailing.', // dot with nothing after it
  ]
  for (const relPath of notImages) {
    assert.equal(isImagePath(relPath), false, relPath)
    assert.equal(imageMimeType(relPath), undefined, relPath)
  }
})

test('separators are normalised so the server and the client agree', () => {
  assert.equal(imageMimeType('assets\\shot.png'), 'image/png')
  assert.equal(imageMimeType('assets/shot.png'), 'image/png')
  assert.equal(imageMimeType('C:\\proj\\assets\\shot.webp'), 'image/webp')
})

test('only svg reports a readable source form', () => {
  assert.equal(isSvgPath('assets/logo.svg'), true)
  assert.equal(isSvgPath('assets/logo.SVG'), true)
  assert.equal(isSvgPath('assets/shot.png'), false)
  assert.equal(isSvgPath('notes.md'), false)
})

test('the size cap is 20MB', () => {
  assert.equal(MAX_IMAGE_BYTES, 20 * 1024 * 1024)
})
