import assert from 'node:assert/strict'
import { test } from 'node:test'

import { LEANSPEC_STYLES } from '../src/client/styles.ts'
import {
  ANCHOR_FALLBACK,
  BODY_MIN,
  PANEL_EDGE,
  PANEL_HEIGHT,
  PANEL_WIDTH,
  decideSurface,
} from '../src/client/surface.ts'

/**
 * T3.4 / REQ-2.1 / REQ-2.2 — the popover's real box, measured from the shipped
 * CSS rather than from the constants that were used to write it.
 *
 * The width/height declarations are *evaluated* here (a 40-line evaluator for
 * the restricted arithmetic we use: `min()`, `calc()`, `Npx`, `Nvw`, `Nvh` and
 * `var(--anchor, 48px)`), so a CSS edit that stops matching the decision in
 * `surface.ts` fails this file instead of silently overflowing on screen.
 *
 * What is *not* verified here: the real header gutter and the real anchor (no
 * browser), so the left-edge check uses the documented 24px assumption below.
 */

/**
 * The header's own right-hand padding.
 *
 * Not measured (T0.3 is still open). 24 is the value design.md §4 assumes, and
 * it is the *only* number in this file that could be wrong on the real machine:
 * with a 1040px popover on a 1088px viewport there are 48px to spare, so any
 * gutter up to 48px keeps the left edge inside the window.
 */
const HEADER_GUTTER = 24

/**
 * Worst case for the row above the panel body. It used to always hold the 26px
 * switch button (2px borders in a 6px-padded bar = 41px); since 2026-10-08 the
 * button lives on the tree pane's header row, so the popover pays for this row
 * only when there is a reason or a failure to show (6 + 6 padding + an 18px
 * line + 1px border = 31px). Subtracting the old 41px keeps `body` a lower
 * bound, which is exactly what the assertions below need.
 */
const SWITCHBAR_HEIGHT = 41

/** Splits on commas that are not inside parentheses. */
function splitTop(inner: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const char of inner) {
    if (char === '(') depth += 1
    if (char === ')') depth -= 1
    if (char === ',' && depth === 0) {
      parts.push(current)
      current = ''
      continue
    }
    current += char
  }
  parts.push(current)
  return parts.map(part => part.trim()).filter(part => part.length > 0)
}

interface View {
  vw: number
  vh: number
  /** `undefined` models "nothing measured yet" so the CSS fallback is exercised. */
  anchor?: number
}

function evalTerm(term: string, view: View): number {
  const match = /^([0-9.]+)(px|vw|vh)$/.exec(term.trim())
  if (match === null) throw new Error(`unsupported CSS term: ${term}`)
  const value = Number(match[1])
  if (match[2] === 'vw') return (value * view.vw) / 100
  if (match[2] === 'vh') return (value * view.vh) / 100
  return value
}

function evalSum(inner: string, view: View): number {
  // Only spaced `+` / `-` are operators, which leaves `--anchor` and `-24px`
  // alone; everything else is an operand `evalCss` can resolve.
  const parts = inner.split(/\s+([+-])\s+/)
  let total = evalCss(parts[0] ?? '0px', view)
  for (let index = 1; index < parts.length; index += 2) {
    const sign = parts[index] === '-' ? -1 : 1
    total += sign * evalCss(parts[index + 1] ?? '0px', view)
  }
  return total
}

function evalCss(expression: string, view: View): number {
  const text = expression.trim()
  const call = /^([a-z-]+)\((.*)\)$/s.exec(text)
  if (call === null) return evalTerm(text, view)
  const name = call[1]
  const inner = call[2] ?? ''
  if (name === 'min') return Math.min(...splitTop(inner).map(part => evalCss(part, view)))
  if (name === 'calc') return evalSum(inner, view)
  if (name === 'var') {
    const [variable, fallback] = splitTop(inner)
    if (variable !== '--anchor') throw new Error(`unsupported custom property: ${variable}`)
    return view.anchor ?? evalCss(fallback ?? '0px', view)
  }
  throw new Error(`unsupported CSS function: ${name}`)
}

/** Reads one declaration out of the shipped stylesheet, and it must exist. */
function declaration(selector: string, property: string): string {
  const rule = new RegExp(`\\${selector} \\{[^}]*\\}`).exec(LEANSPEC_STYLES)
  assert.ok(rule, `${selector} is defined in the shipped styles`)
  const found = new RegExp(`${property}:\\s*([^;]+);`).exec(rule[0])
  assert.ok(found, `${selector} declares ${property}`)
  return (found[1] ?? '').trim()
}

interface Box {
  width: number
  height: number
  left: number
  bottom: number
  body: number
}

const WIDTH_CAP = declaration('.dsh-leanspec-popover', 'width')
const HEIGHT_CAP = declaration('.dsh-leanspec-popover', 'height')

function boxAt(view: View): Box {
  const width = evalCss(WIDTH_CAP, view)
  const height = evalCss(HEIGHT_CAP, view)
  const anchor = view.anchor ?? ANCHOR_FALLBACK
  return {
    width,
    height,
    // `right: 0` against the header control: the box grows leftwards from there.
    left: view.vw - HEADER_GUTTER - width,
    bottom: anchor + height,
    body: height - SWITCHBAR_HEIGHT,
  }
}

const WIDTHS = [1920, 1440, 1088, 1087]
const HEIGHTS = [712, 711]

test('the caps really are the panel size, minus the edge and anchor room', () => {
  assert.equal(evalCss(WIDTH_CAP, { vw: 4000, vh: 4000 }), PANEL_WIDTH)
  assert.equal(evalCss(HEIGHT_CAP, { vw: 4000, vh: 4000, anchor: ANCHOR_FALLBACK }), PANEL_HEIGHT)
  assert.equal(evalCss(WIDTH_CAP, { vw: 1000, vh: 4000 }), 1000 - 2 * PANEL_EDGE)
  assert.equal(
    evalCss(HEIGHT_CAP, { vw: 4000, vh: 600, anchor: ANCHOR_FALLBACK }),
    600 - ANCHOR_FALLBACK - PANEL_EDGE,
  )
})

test('the CSS cap counts the very same breakpoint the decision does', () => {
  for (const vw of WIDTHS) {
    for (const vh of HEIGHTS) {
      const box = boxAt({ vw, vh })
      const fits = box.width === PANEL_WIDTH && box.height === PANEL_HEIGHT
      assert.equal(
        decideSurface({ viewportWidth: vw, viewportHeight: vh }),
        fits ? 'popup' : 'tab',
        `${vw}x${vh}: the decision and the real box agree`,
      )
    }
  }
})

test('no viewport in the matrix can push the popover off screen (REQ-2.2)', () => {
  for (const vw of WIDTHS) {
    for (const vh of HEIGHTS) {
      for (const anchor of [ANCHOR_FALLBACK - 8, ANCHOR_FALLBACK, ANCHOR_FALLBACK + 32]) {
        const box = boxAt({ vw, vh, anchor })
        assert.ok(box.left >= 0, `${vw}x${vh} anchor ${anchor}: left edge ${box.left} is inside the window`)
        assert.ok(box.bottom <= vh, `${vw}x${vh} anchor ${anchor}: bottom ${box.bottom} fits in ${vh}`)
        assert.ok(box.body >= BODY_MIN, `${vw}x${vh} anchor ${anchor}: body ${box.body} >= ${BODY_MIN}`)
        assert.ok(box.width <= PANEL_WIDTH && box.height <= PANEL_HEIGHT)
      }
    }
  }
})

test('the height cap follows a live anchor instead of a fixed guess', () => {
  // A taller header costs exactly its own extra height.
  assert.equal(evalCss(HEIGHT_CAP, { vw: 1440, vh: 800, anchor: 48 }), PANEL_HEIGHT)
  assert.equal(evalCss(HEIGHT_CAP, { vw: 1440, vh: 800, anchor: 88 }), PANEL_HEIGHT)
  assert.equal(evalCss(HEIGHT_CAP, { vw: 1440, vh: 740, anchor: 88 }), 628)
})

test('before the first measurement the fallback in the CSS keeps the box legal', () => {
  // `var(--anchor, 48px)`: no inline style at all is the first paint.
  assert.equal(evalCss(HEIGHT_CAP, { vw: 1088, vh: 712 }), PANEL_HEIGHT)
  assert.equal(evalCss(HEIGHT_CAP, { vw: 1088, vh: 711 }), 639)
})

test('the measured matrix, as recorded in tasks.md T3.4', () => {
  const rows = WIDTHS.flatMap(vw => HEIGHTS.map(vh => {
    const box = boxAt({ vw, vh })
    return `${vw}x${vh}: ${decideSurface({ viewportWidth: vw, viewportHeight: vh })} w=${box.width} h=${box.height} left=${box.left} bottom=${box.bottom} body=${box.body}`
  }))
  // Printed in the test output on failure-only runners; the assertions above are
  // the contract, this keeps the numbers easy to copy into the docs.
  assert.equal(rows.length, WIDTHS.length * HEIGHTS.length)
  for (const row of rows) assert.match(row, /^(1920|1440|1088|1087)x(712|711): (popup|tab) /)
})
