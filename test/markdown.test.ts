import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderMarkdown } from '../src/client/markdown.ts'

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
