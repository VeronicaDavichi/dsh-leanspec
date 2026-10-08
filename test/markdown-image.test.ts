import assert from 'node:assert/strict'
import { test } from 'node:test'
import { RAW_ENDPOINT } from '../src/client/image-view.ts'
import { renderMarkdown, rewriteImageSrc } from '../src/client/markdown.ts'

/**
 * REQ-7: a rendered preview must reach a spec's own images through the raw
 * endpoint, while every src it cannot resolve stays exactly as authored.
 *
 * All assertions go through the endpoint's own URL parsing rather than string
 * comparison, so the rewrite is checked against what `src/http.ts` will actually
 * read back out of `root` and `path`.
 */
const ROOT = '/tmp/my project'

function srcsOf(html: string): string[] {
  return [...html.matchAll(/\ssrc=(["'])([^"']*)\1/g)].map(match => match[2] ?? '')
}

function parse(src: string): URL {
  return new URL(src, 'http://127.0.0.1')
}

function onlySrc(html: string): string {
  const srcs = srcsOf(html)
  assert.equal(srcs.length, 1, `expected exactly one src in ${html}`)
  return srcs[0] ?? ''
}

test('a relative src is rewritten to the raw endpoint of the resolved path', () => {
  const html = rewriteImageSrc(
    '<p><img src="img/x.png" alt="x"></p>',
    '001-alpha/README.md',
    ROOT,
  )
  const parsed = parse(onlySrc(html))
  assert.equal(parsed.pathname, RAW_ENDPOINT)
  assert.equal(parsed.searchParams.get('root'), ROOT)
  assert.equal(parsed.searchParams.get('path'), '001-alpha/img/x.png')
})

test('a ./ src resolves against the directory of the document', () => {
  const html = rewriteImageSrc(
    '<p><img src="./assets/shot.PNG" alt="x"></p>',
    '001-alpha/docs/design.md',
    ROOT,
  )
  assert.equal(parse(onlySrc(html)).searchParams.get('path'), '001-alpha/docs/assets/shot.PNG')
})

test('a ../ src climbs out of the document directory but stays inside specs', () => {
  const html = rewriteImageSrc(
    '<p><img src="../assets/shot.png" alt="x"></p>',
    '001-alpha/docs/design.md',
    ROOT,
  )
  assert.equal(parse(onlySrc(html)).searchParams.get('path'), '001-alpha/assets/shot.png')
})

test('several ../ segments keep resolving step by step', () => {
  const html = rewriteImageSrc(
    '<img src="../../b/./c.png">',
    '001-alpha/docs/deep/design.md',
    ROOT,
  )
  assert.equal(parse(onlySrc(html)).searchParams.get('path'), '001-alpha/b/c.png')
})

test('an absolute http or https src is left alone', () => {
  const html = '<img src="https://example.com/a.png"><img src="http://example.com/b.png">'
  assert.equal(rewriteImageSrc(html, '001-alpha/README.md', ROOT), html)
})

test('a data: payload is left alone', () => {
  const html = '<img src="data:image/png;base64,iVBORw0KGgo=">'
  assert.equal(rewriteImageSrc(html, '001-alpha/README.md', ROOT), html)
})

test('a protocol-relative src is left alone', () => {
  const html = '<img src="//cdn.example.com/a.png">'
  assert.equal(rewriteImageSrc(html, '001-alpha/README.md', ROOT), html)
})

test('a root-relative src is left alone: it has no project meaning here', () => {
  const html = '<img src="/specs/001-alpha/a.png">'
  assert.equal(rewriteImageSrc(html, '001-alpha/README.md', ROOT), html)
})

test('a src that already points at the endpoint is not rewritten twice', () => {
  const already = `${RAW_ENDPOINT}?root=%2Ftmp&path=001-alpha%2Fa.png`
  const html = `<img src="${already}">`
  assert.equal(rewriteImageSrc(html, '001-alpha/README.md', ROOT), html)
})

test('a src that climbs above the spec tree keeps its original value', () => {
  const html = '<img src="../../outside.png">'
  assert.equal(rewriteImageSrc(html, '001-alpha/README.md', ROOT), html)
  const deeper = '<img src="../../../outside.png">'
  assert.equal(rewriteImageSrc(deeper, '001-alpha/docs/design.md', ROOT), deeper)
})

test('single-quoted src values are rewritten in place', () => {
  const html = rewriteImageSrc("<img class='a' src='./x.png' width='3'>", '001-alpha/README.md', ROOT)
  assert.match(html, /class='a'/)
  assert.match(html, /width='3'/)
  assert.equal(parse(onlySrc(html)).searchParams.get('path'), '001-alpha/x.png')
})

test('data-src and srcset are not mistaken for src', () => {
  const html = '<img data-src="./lazy.png" srcset="./big.png 2x">'
  assert.equal(rewriteImageSrc(html, '001-alpha/README.md', ROOT), html)
})

test('a non-ASCII name survives the percent-encoding marked applies', () => {
  const html = rewriteImageSrc('<img src="./%E4%B8%AD%E6%96%87.png">', '001-alpha/README.md', ROOT)
  assert.equal(parse(onlySrc(html)).searchParams.get('path'), '001-alpha/中文.png')
})

test('a query or fragment suffix is dropped with the endpoint query string', () => {
  const html = rewriteImageSrc('<img src="./x.png?v=2#top">', '001-alpha/README.md', ROOT)
  const parsed = parse(onlySrc(html))
  assert.equal(parsed.searchParams.get('path'), '001-alpha/x.png')
  assert.equal(parsed.searchParams.size, 2, 'only root and path are sent')
})

test('html without an img tag is returned untouched', () => {
  const html = '<h1>标题</h1>\n<p><a href="./x.png">link</a></p>\n'
  assert.equal(rewriteImageSrc(html, '001-alpha/README.md', ROOT), html)
})

test('the rendered markdown of a spec document gets its images rewired', () => {
  const source = '# 标题\n\n![shot](./assets/shot.png)\n\n![web](https://example.com/a.png)\n'
  const rewritten = rewriteImageSrc(renderMarkdown(source).html, '008-image/README.md', ROOT)
  const srcs = srcsOf(rewritten)
  assert.equal(srcs.length, 2)
  assert.equal(parse(srcs[0] ?? '').searchParams.get('path'), '008-image/assets/shot.png')
  assert.equal(srcs[1], 'https://example.com/a.png')
})

test('a docPath without a directory resolves against the spec tree root', () => {
  const html = rewriteImageSrc('<img src="x.png">', 'README.md', ROOT)
  assert.equal(parse(onlySrc(html)).searchParams.get('path'), 'x.png')
})
