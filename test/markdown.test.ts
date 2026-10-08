import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderMarkdown, stripFrontmatter } from '../src/client/markdown.ts'

test('empty markdown is an empty preview state', () => {
  const result = renderMarkdown('')
  assert.equal(result.empty, true)
  assert.equal(result.html, '')
})

test('renders headings and lists', () => {
  const result = renderMarkdown('# Title\n\n- one\n- two\n')
  assert.equal(result.empty, false)
  assert.match(result.html, /<h1>/)
  assert.match(result.html, /Title/)
  assert.match(result.html, /<li>/)
  assert.match(result.html, /one/)
})

test('strips script tags from preview html', () => {
  const result = renderMarkdown('# Hi\n\n<script>alert(1)</script>\n')
  assert.doesNotMatch(result.html, /<script/i)
  assert.doesNotMatch(result.html, /alert\(1\)/)
})

test('strips inline event handlers and javascript urls', () => {
  const result = renderMarkdown('<a href="javascript:alert(1)" onclick="alert(2)">x</a>')
  assert.doesNotMatch(result.html, /javascript:/i)
  assert.doesNotMatch(result.html, /onclick/i)
})

test('renders GFM tables with thead and tbody', () => {
  const result = renderMarkdown('| Col1 | Col2 | Col3 |\n|------|------|------|\n| A    | B    | C    |\n')
  assert.equal(result.empty, false)
  assert.match(result.html, /<table>/)
  assert.match(result.html, /<thead>/)
  assert.match(result.html, /<tbody>/)
  assert.match(result.html, /<th>Col1<\/th>/)
  assert.match(result.html, /<th>Col2<\/th>/)
  assert.match(result.html, /<td>A<\/td>/)
  assert.match(result.html, /<td>B<\/td>/)
})

test('renders multi-row table data', () => {
  const result = renderMarkdown('| Name | Value |\n|------|-------|\n| Foo  | 100   |\n| Bar  | 200   |\n| Baz  | 300   |\n')
  assert.match(result.html, /<tr>/)
  assert.match(result.html, /Foo/)
  assert.match(result.html, /100/)
  assert.match(result.html, /Bar/)
  assert.match(result.html, /200/)
  assert.match(result.html, /Baz/)
  assert.match(result.html, /300/)
})

test('table content is sanitized for XSS', () => {
  const result = renderMarkdown('| Col1 | Col2 |\n|------|------|\n| <script>alert(1)</script> | Safe |\n')
  assert.doesNotMatch(result.html, /<script/i)
  assert.doesNotMatch(result.html, /alert\(1\)/)
  assert.match(result.html, /<table>/)
})

test('a leading YAML frontmatter block is not rendered as content', () => {
  const result = renderMarkdown('---\nstatus: draft\ncreated: 2026-01-01\ntags:\n  - spec\n---\n\n# 标题\n\n正文\n')
  assert.equal(result.empty, false)
  assert.doesNotMatch(result.html, /<hr>/, 'the fences must not become rulers')
  assert.doesNotMatch(result.html, /status/, 'the YAML must not become a heading')
  assert.match(result.html, /<h1>标题<\/h1>/)
  assert.match(result.html, /正文/)
})

test('frontmatter is stripped with CRLF endings and after a BOM', () => {
  const crlf = renderMarkdown('---\r\nstatus: in-progress\r\n---\r\n\r\n# 标题\r\n')
  assert.doesNotMatch(crlf.html, /status/)
  assert.match(crlf.html, /标题/)
  const bom = renderMarkdown('\uFEFF---\nstatus: draft\n---\n\n# 标题\n')
  assert.doesNotMatch(bom.html, /status/)
  assert.match(bom.html, /标题/)
})

test('a frontmatter-only file falls back to the empty state', () => {
  const result = renderMarkdown('---\nstatus: complete\ncreated: 2026-01-01\n---\n')
  assert.equal(result.empty, true)
  assert.equal(result.html, '')
})

test('a document that merely opens with a ruler keeps its content', () => {
  const source = '---\n\n# 标题\n\n---\n\n正文\n'
  assert.equal(stripFrontmatter(source), source)
  assert.match(renderMarkdown(source).html, /<h1>标题<\/h1>/)
})

test('an unclosed fence and an inner ruler are left alone', () => {
  const unclosed = renderMarkdown('---\nstatus: draft\n\n正文\n')
  assert.match(unclosed.html, /<hr>/, 'an unclosed fence is body text, not frontmatter')
  const inner = renderMarkdown('# 标题\n\n---\n\n正文\n')
  assert.match(inner.html, /<hr>/, 'a ruler after content is a separator, not frontmatter')
})

test('stripFrontmatter leaves frontmatter-free sources byte for byte', () => {
  const source = '# 标题\n\n| a | b |\n|---|---|\n| 1 | 2 |\n'
  assert.equal(stripFrontmatter(source), source)
})
