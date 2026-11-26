import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ANCHOR_FALLBACK,
  ANCHOR_GAP,
  BODY_MIN,
  PANEL_DEFAULT,
  PANEL_EDGE,
  PANEL_HEIGHT,
  PANEL_MAX_HEIGHT,
  PANEL_MAX_WIDTH,
  PANEL_MIN_HEIGHT,
  PANEL_MIN_WIDTH,
  PANEL_WIDTH,
  SPLIT_DEFAULT,
  SPLIT_MAX,
  SPLIT_MIN,
  SURFACE_MIN_HEIGHT,
  SURFACE_MIN_WIDTH,
  anchorBottomFromTrigger,
  clampPanel,
  clampSplit,
  decideSurface,
  panelFromDrag,
  readStoredPanel,
  readStoredSplit,
  splitUpperBound,
} from '../src/client/surface.ts'

/**
 * REQ-5.2 / REQ-5.3 / REQ-6.2 — the split's arithmetic, with no DOM in sight.
 *
 * The upper bound is the interesting one: it is *not* the constant 420 when the
 * panel is narrow, because the body keeps BODY_MIN no matter what.
 */

test('clampSplit holds a normal drag inside 180..420', () => {
  assert.equal(clampSplit(100, 2000), SPLIT_MIN, 'below the minimum snaps up')
  assert.equal(clampSplit(179, 2000), SPLIT_MIN)
  assert.equal(clampSplit(180, 2000), 180, 'the minimum itself is allowed')
  assert.equal(clampSplit(300, 2000), 300)
  assert.equal(clampSplit(420, 2000), SPLIT_MAX, 'the maximum itself is allowed')
  assert.equal(clampSplit(421, 2000), SPLIT_MAX, 'above the maximum snaps down')
  assert.equal(clampSplit(9999, 2000), SPLIT_MAX)
})

test('clampSplit shrinks the upper bound so the body keeps 360px (REQ-5.3)', () => {
  // 700px of panel: 420 tree + 360 body cannot both fit, so the tree gives way.
  assert.equal(clampSplit(420, 700), 700 - BODY_MIN)
  assert.equal(clampSplit(420, 640), 280)
  // 500px: the computed bound (140) is below the minimum, so the minimum wins —
  // a scrolling body beats a tree too narrow to print its own file names.
  assert.equal(clampSplit(420, 500), SPLIT_MIN)
  assert.equal(clampSplit(420, 400), SPLIT_MIN)
})

test('clampSplit rounds and survives silly numbers', () => {
  assert.equal(clampSplit(300.6, 2000), 301)
  assert.equal(clampSplit(300.4, 2000), 300)
  assert.equal(clampSplit(Number.NaN, 2000), SPLIT_DEFAULT, 'NaN falls back to the default')
  assert.equal(clampSplit(Number.POSITIVE_INFINITY, 2000), SPLIT_MAX)
  // An unmeasured panel (Infinity) means "assume there is room".
  assert.equal(clampSplit(300, Number.POSITIVE_INFINITY), 300)
  assert.equal(clampSplit(300, Number.NaN), 300)
})

test('splitUpperBound reports what the user can actually reach', () => {
  assert.equal(splitUpperBound(2000), SPLIT_MAX)
  assert.equal(splitUpperBound(700), 700 - BODY_MIN)
  assert.equal(splitUpperBound(500), SPLIT_MIN, 'never announces less than the minimum')
  assert.equal(splitUpperBound(Number.NaN), SPLIT_MAX)
})

test('readStoredSplit restores a valid width and rejects everything else', () => {
  assert.equal(readStoredSplit('320'), 320)
  assert.equal(readStoredSplit(' 300 '), 300, 'whitespace is tolerated')
  assert.equal(readStoredSplit('180'), SPLIT_MIN, 'the bounds themselves are valid')
  assert.equal(readStoredSplit('420'), SPLIT_MAX)
  assert.equal(readStoredSplit('319.6'), 320, 'rounds to whole pixels')
})

test('readStoredSplit falls back to 280 for unusable input (REQ-6.2)', () => {
  assert.equal(readStoredSplit(null), SPLIT_DEFAULT)
  assert.equal(readStoredSplit(undefined), SPLIT_DEFAULT)
  assert.equal(readStoredSplit(''), SPLIT_DEFAULT)
  assert.equal(readStoredSplit('   '), SPLIT_DEFAULT)
  assert.equal(readStoredSplit('abc'), SPLIT_DEFAULT)
  assert.equal(readStoredSplit('NaN'), SPLIT_DEFAULT)
  assert.equal(readStoredSplit('Infinity'), SPLIT_DEFAULT)
  assert.equal(readStoredSplit('179'), SPLIT_DEFAULT, 'below the range is not honoured')
  assert.equal(readStoredSplit('421'), SPLIT_DEFAULT, 'above the range is not honoured')
  assert.equal(readStoredSplit('-1'), SPLIT_DEFAULT)
})

/* -------------------------------------------------------------------------
 * T3.1 / REQ-1.1 / REQ-1.2 / REQ-1.4 — the surface decision.
 *
 * The breakpoints are the brief's pinned numbers, written out here as literals
 * on purpose: if the constants ever drift, this file disagrees with the design
 * instead of quietly following it.
 * ---------------------------------------------------------------------- */

test('the breakpoints are derived from the panel, never typed twice', () => {
  assert.equal(PANEL_WIDTH, 1040)
  assert.equal(PANEL_HEIGHT, 640)
  assert.equal(PANEL_EDGE, 24)
  assert.equal(ANCHOR_GAP, 8)
  assert.equal(ANCHOR_FALLBACK, 48)
  assert.equal(SURFACE_MIN_WIDTH, 1088, '1040 + 2 x 24')
  assert.equal(SURFACE_MIN_HEIGHT, 712, '640 + 48 + 24')
})

test('the exact breakpoints: 1088 x 712 is a popup, one pixel less is a tab', () => {
  const roomy = { viewportWidth: 1088, viewportHeight: 712 }
  assert.equal(decideSurface(roomy), 'popup')
  assert.equal(decideSurface({ ...roomy, viewportWidth: 1087 }), 'tab', 'width boundary')
  assert.equal(decideSurface({ ...roomy, viewportHeight: 711 }), 'tab', 'height boundary')
  // Both boundaries are independent: one being short is enough.
  assert.equal(decideSurface({ viewportWidth: 1087, viewportHeight: 711 }), 'tab')
  assert.equal(decideSurface({ viewportWidth: 1920, viewportHeight: 712 }), 'popup')
})

test('a live anchor moves the height boundary instead of being ignored (REQ-1.4)', () => {
  // A taller header eats room: 712 - 48 + 60 = 724 is the new floor.
  assert.equal(decideSurface({ viewportWidth: 1440, viewportHeight: 723, anchorBottom: 60 }), 'tab')
  assert.equal(decideSurface({ viewportWidth: 1440, viewportHeight: 724, anchorBottom: 60 }), 'popup')
  // A shorter one relaxes it: 640 + 40 + 24 = 704 is the new floor.
  assert.equal(decideSurface({ viewportWidth: 1440, viewportHeight: 704, anchorBottom: 40 }), 'popup')
  assert.equal(decideSurface({ viewportWidth: 1440, viewportHeight: 703, anchorBottom: 40 }), 'tab')
})

test('a custom edge gap shifts the width boundary symmetrically', () => {
  assert.equal(decideSurface({ viewportWidth: 1064, viewportHeight: 800, edge: 12 }), 'popup')
  assert.equal(decideSurface({ viewportWidth: 1063, viewportHeight: 800, edge: 12 }), 'tab')
})

test('unusable measurements fall back to the measured defaults, never to NaN', () => {
  const fallback = { viewportWidth: 1088, viewportHeight: 712 }
  for (const input of [
    { ...fallback, anchorBottom: Number.NaN },
    { ...fallback, anchorBottom: -1 },
    { ...fallback, anchorBottom: Number.POSITIVE_INFINITY },
    { ...fallback, edge: Number.NaN },
    { ...fallback, edge: -5 },
  ]) {
    assert.equal(decideSurface(input), 'popup', 'the default anchor/edge is what the constants say')
  }
})

test('a viewport that is not a number is never treated as roomy', () => {
  for (const input of [
    { viewportWidth: Number.NaN, viewportHeight: 900 },
    { viewportWidth: 1600, viewportHeight: Number.NaN },
    { viewportWidth: Number.POSITIVE_INFINITY, viewportHeight: 900 },
    { viewportWidth: 1600, viewportHeight: Number.POSITIVE_INFINITY },
    { viewportWidth: 0, viewportHeight: 0 },
    { viewportWidth: -100, viewportHeight: -100 },
  ]) {
    assert.equal(decideSurface(input), 'tab', `${input.viewportWidth}x${input.viewportHeight}`)
  }
})

test('the trigger rect becomes the anchor through one shared +8 gap', () => {
  assert.equal(anchorBottomFromTrigger(40), 48)
  assert.equal(anchorBottomFromTrigger(0), 8)
  assert.equal(anchorBottomFromTrigger(undefined), ANCHOR_FALLBACK)
  assert.equal(anchorBottomFromTrigger(Number.NaN), ANCHOR_FALLBACK)
  assert.equal(anchorBottomFromTrigger(-3), ANCHOR_FALLBACK)
})

/* -------------------------------------------------------------------------
 * specs/010 — the popover's own size
 * ---------------------------------------------------------------------- */

const PANEL_LIMITS = { viewportWidth: 1600, viewportHeight: 1000, anchorBottom: 48, edge: 24 }

test('clampPanel holds both axes inside the minimum and the viewport (REQ-2.1/2.2)', () => {
  assert.deepEqual(
    clampPanel({ width: 100, height: 100 }, PANEL_LIMITS),
    { width: PANEL_MIN_WIDTH, height: PANEL_MIN_HEIGHT },
    'below the minimum snaps up on each axis',
  )
  assert.deepEqual(
    clampPanel({ width: 2000, height: 2000 }, PANEL_LIMITS),
    { width: 1600 - 2 * PANEL_EDGE, height: 1000 - 48 - PANEL_EDGE },
    'above the viewport snaps down to the room the viewport has',
  )
  assert.deepEqual(
    clampPanel({ width: 900, height: 500 }, PANEL_LIMITS),
    { width: 900, height: 500 },
    'a legal size passes through untouched',
  )
  assert.deepEqual(
    clampPanel({ width: 800.6, height: 500.4 }, PANEL_LIMITS),
    { width: 801, height: 500 },
    'and is rounded like the splitter',
  )
})

test('a viewport smaller than the minimum keeps the minimum, never a negative box (REQ-2.3)', () => {
  const tiny = { viewportWidth: 300, viewportHeight: 200, anchorBottom: 48, edge: 24 }
  assert.deepEqual(
    clampPanel({ width: 1000, height: 800 }, tiny),
    { width: PANEL_MIN_WIDTH, height: PANEL_MIN_HEIGHT },
  )
  // No measurement at all: only the absolute ceilings can answer.
  assert.deepEqual(
    clampPanel(
      { width: 5000, height: 5000 },
      { viewportWidth: Number.NaN, viewportHeight: Number.NaN },
    ),
    { width: PANEL_MAX_WIDTH, height: PANEL_MAX_HEIGHT },
  )
})

test('panelFromDrag adds the pointer delta, then clamps (REQ-1.1)', () => {
  assert.deepEqual(
    panelFromDrag({ width: 800, height: 500 }, 100, 50, PANEL_LIMITS),
    { width: 900, height: 550 },
  )
  assert.deepEqual(
    panelFromDrag({ width: 800, height: 500 }, -1000, -1000, PANEL_LIMITS),
    { width: PANEL_MIN_WIDTH, height: PANEL_MIN_HEIGHT },
    'a huge drag cannot cross the floor',
  )
  assert.deepEqual(
    panelFromDrag({ width: 800, height: 500 }, Number.NaN, Number.NaN, PANEL_LIMITS),
    { width: 800, height: 500 },
    'a broken delta is no movement, not NaN',
  )
})

test('readStoredPanel accepts a real size and refuses everything else (REQ-4.3)', () => {
  assert.deepEqual(
    readStoredPanel(JSON.stringify({ width: 900, height: 520 })),
    { width: 900, height: 520 },
  )
  for (const raw of [null, undefined, '', '   ', 'not json', '[]', '{}']) {
    assert.deepEqual(readStoredPanel(raw), PANEL_DEFAULT, `unusable: ${String(raw)}`)
  }
  assert.deepEqual(
    readStoredPanel('{"width":"900","height":520}'),
    { width: PANEL_WIDTH, height: 520 },
    'a non-numeric axis falls back alone; the other one survives',
  )
  assert.deepEqual(
    readStoredPanel('{"width":500,"height":520}'),
    { width: PANEL_WIDTH, height: 520 },
    'below the floor falls back on that axis only',
  )
  assert.deepEqual(
    readStoredPanel('{"width":99999,"height":520}'),
    { width: PANEL_WIDTH, height: 520 },
    'above the ceiling falls back on that axis only',
  )
  assert.deepEqual(
    readStoredPanel('{"width":900}'),
    { width: 900, height: PANEL_HEIGHT },
    'each axis falls back on its own',
  )
})

test('decideSurface uses the size the user set, and stays put for the default (REQ-3.1/3.2)', () => {
  const panel = { width: 700, height: 500 }
  assert.equal(decideSurface({ viewportWidth: 800, viewportHeight: 700, panel }), 'popup')
  assert.equal(
    decideSurface({ viewportWidth: 747, viewportHeight: 700, panel }),
    'tab',
    'one pixel short of 700 + 2 x 24 is still a tab',
  )
  // A user who never resized keeps 007's exact boundary.
  assert.equal(decideSurface({ viewportWidth: SURFACE_MIN_WIDTH, viewportHeight: SURFACE_MIN_HEIGHT }), 'popup')
  assert.equal(decideSurface({ viewportWidth: SURFACE_MIN_WIDTH - 1, viewportHeight: SURFACE_MIN_HEIGHT }), 'tab')
})
