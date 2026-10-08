import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

/**
 * Guard for a mistake this repository has now made four times: writing a
 * backtick (or `${`) inside a CSS comment in `LEANSPEC_STYLES`.
 *
 * `LEANSPEC_STYLES` is a template literal, so one stray backtick ends the string
 * early and the rest of the stylesheet is parsed as TypeScript. The failure is
 * reported as a confusing `TS1005: ',' expected` deep inside the CSS, and it
 * takes three test files down with it — so this check reads the *source text*
 * instead of importing the module, which is the only way to catch it before the
 * parser does. Two backticks are expected: the opening and closing delimiters.
 */
const STYLES_SOURCE = new URL('../src/client/styles.ts', import.meta.url)

test('LEANSPEC_STYLES carries exactly its two template-literal delimiters', () => {
  const source = readFileSync(STYLES_SOURCE, 'utf8')
  const backticks = source.match(/`/g) ?? []
  assert.equal(
    backticks.length,
    2,
    `styles.ts must contain exactly 2 backticks (the delimiters) but has ${backticks.length}. `
    + 'A backtick inside a CSS comment ends the template literal early and breaks the build.',
  )
})

test('the stylesheet never interpolates by accident', () => {
  const source = readFileSync(STYLES_SOURCE, 'utf8')
  const start = source.indexOf('`')
  const end = source.lastIndexOf('`')
  const body = source.slice(start + 1, end)
  assert.equal(
    body.includes('${'),
    false,
    'a ${ inside the CSS body would be interpolated at runtime; escape or avoid it',
  )
})
