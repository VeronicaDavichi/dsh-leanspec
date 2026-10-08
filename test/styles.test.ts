import assert from 'node:assert/strict'
import { test } from 'node:test'
import { LEANSPEC_STYLES } from '../src/client/styles.ts'

test('viewer styles use Harness theme aliases instead of hardcoded palette', () => {
  for (const token of [
    '--dsw-alias-bg-layer-2',
    '--dsw-alias-label-primary',
    '--dsw-alias-border-l2',
    '--dsw-alias-interactive-bg-hover',
    '--dsw-specific-sidebar-fill',
    '--dsw-alias-state-business-primary',
    '--dsw-alias-markdown-code-block',
    '--dsw-font-family',
  ]) {
    assert.match(LEANSPEC_STYLES, new RegExp(token.replaceAll('-', '\\-')))
  }
  assert.doesNotMatch(LEANSPEC_STYLES, /#[0-9a-fA-F]{3,8}/)
})

test('file path sits below the toolbar instead of sharing the button row', () => {
  assert.match(LEANSPEC_STYLES, /\.dsh-leanspec-chrome \{[\s\S]*flex-direction: column/)
  assert.match(LEANSPEC_STYLES, /\.dsh-leanspec-path \{[\s\S]*display: block/)
  assert.match(LEANSPEC_STYLES, /\.dsh-leanspec-path \{[\s\S]*text-align: left/)
  assert.doesNotMatch(LEANSPEC_STYLES, /\.dsh-leanspec-path \{[\s\S]*margin-left: auto/)
})

test('the tab body keeps no styling for a switch it no longer has (2026-10-08)', () => {
  // The tab is one-way, so the placeholder notice and its text rule are gone
  // with the button that used to reach them. `.dsh-leanspec-switchbar` stays:
  // the popup still needs a row for a disabled control's reason or a failed
  // switch — it just no longer carries the button itself.
  assert.doesNotMatch(LEANSPEC_STYLES, /dsh-leanspec-tab-notice/)
  assert.match(LEANSPEC_STYLES, /\.dsh-leanspec-switchbar \{/)
})

test('the switch shares the tree pane header row and is pushed right (2026-10-08)', () => {
  const head = /\.dsh-leanspec-aside-head \{[\s\S]*?\}/.exec(LEANSPEC_STYLES)?.[0] ?? ''
  assert.notEqual(head, '', '.dsh-leanspec-aside-head is defined')
  assert.match(head, /display:\s*flex/)
  assert.match(head, /justify-content:\s*space-between/, 'the control goes to the right edge')
  assert.match(head, /align-items:\s*center/)
  assert.match(head, /flex:\s*0 0 auto/, 'the header row must never be squeezed by the tree')
  // One left edge for the whole column: the row carries the 14px that the title
  // and banner used to hold themselves (see the .dsh-leanspec-tree comment).
  assert.match(head, /padding:\s*8px 14px 6px/)

  // At the 180px splitter floor the label must give way first, or it would push
  // the control out of its own column.
  const title = /\.dsh-leanspec-aside-title \{[\s\S]*?\}/.exec(LEANSPEC_STYLES)?.[0] ?? ''
  assert.match(title, /min-width:\s*0/)
  assert.match(title, /text-overflow:\s*ellipsis/)
  assert.match(title, /white-space:\s*nowrap/)
  assert.doesNotMatch(title, /padding:/, 'the row owns the padding now')

  // The control is the one item that must not give way: a shrunken flex item
  // wrapped its label onto two lines at the 180px floor and grew the whole
  // header row (user report, 2026-10-08).
  const control = /\.dsh-leanspec-switch \{[\s\S]*?\}/.exec(LEANSPEC_STYLES)?.[0] ?? ''
  assert.match(control, /flex:\s*0 0 auto/, 'the control must not shrink')
  assert.match(control, /white-space:\s*nowrap/, 'and must never wrap')
})

test('the popover declares both caps in the shipped stylesheet (T3.3, REQ-2.1/2.3)', () => {
  const popover = /\.dsh-leanspec-popover \{[\s\S]*?\}/.exec(LEANSPEC_STYLES)?.[0] ?? ''
  assert.notEqual(popover, '', '.dsh-leanspec-popover is defined')

  // Both axes are capped by the same two numbers the decision uses, and both
  // carry a viewport limit so the box can never leave the window (REQ-2.2).
  assert.match(popover, /width:\s*min\(1040px,\s*calc\(100vw - 48px\)\)/)
  assert.match(
    popover,
    /height:\s*min\(640px,\s*calc\(100vh - var\(--anchor, 48px\) - 24px\)\)/,
  )
  // The tab body fills whatever the host pane gives it instead.
  const tab = /\.dsh-leanspec-tab \{[\s\S]*?\}/.exec(LEANSPEC_STYLES)?.[0] ?? ''
  assert.match(tab, /width:\s*100%/)
  assert.match(tab, /height:\s*100%/)
})

/**
 * Pinned fills, in the order design.md §5 freezes them.
 *
 * The RGB values are the resolved token values; `every spec status maps to its
 * frozen fill token` keeps the CSS and this table from drifting apart, so the
 * greyscale spacing below can never silently go stale.
 */
const STATUS_FILLS: Record<string, { token: string; rgb: [number, number, number] }> = {
  draft: {
    token: 'color-mix(in srgb, var(--dsw-static-blue-400) 44%, var(--dsw-static-green-400) 56%)',
    rgb: [86, 190, 181],
  },
  planned: {
    token: 'color-mix(in srgb, var(--dsw-static-deepseek-500) 60%, var(--dsw-static-blue-500) 40%)',
    rgb: [63, 123, 236],
  },
  'in-progress': { token: 'var(--dsw-static-amber-400)', rgb: [247, 173, 49] },
  complete: { token: 'var(--dsw-static-green-500)', rgb: [34, 197, 94] },
  archived: { token: 'var(--dsw-static-neutral-bluish-300)', rgb: [207, 211, 214] },
}

const BADGE_TEXT_RGB: [number, number, number] = [15, 17, 21]

/** Perceived brightness, the measure the 15-step spacing was designed against. */
function grey([r, g, b]: readonly [number, number, number]): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

function relativeLuminance([r, g, b]: readonly [number, number, number]): number {
  const channel = (value: number): number => {
    const scaled = value / 255
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrastBetween(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

function contrastRatio(fill: [number, number, number]): number {
  return contrastBetween(fill, BADGE_TEXT_RGB)
}

function ruleBody(selector: string): string {
  const match = new RegExp(`\\.${selector} \\{([\\s\\S]*?)\\}`).exec(LEANSPEC_STYLES)
  assert.ok(match !== null, `expected a rule for .${selector}`)
  return match[1] ?? ''
}

test('every spec status maps to its frozen fill token', () => {
  for (const [status, fill] of Object.entries(STATUS_FILLS)) {
    const body = ruleBody(`dsh-leanspec-spec-status-${status}`)
    assert.ok(
      body.includes(`background: ${fill.token}`),
      `expected the ${status} fill to be exactly ${fill.token}`,
    )
  }
  assert.doesNotMatch(LEANSPEC_STYLES, /#[0-9a-fA-F]{3,8}/)
})

test('the five status fills stay at least 15 grey steps apart', () => {
  const entries = Object.entries(STATUS_FILLS)
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const [nameA, a] = entries[i] as [string, { rgb: [number, number, number] }]
      const [nameB, b] = entries[j] as [string, { rgb: [number, number, number] }]
      const distance = Math.abs(grey(a.rgb) - grey(b.rgb))
      assert.ok(distance >= 15, `${nameA} and ${nameB} are only ${distance.toFixed(1)} grey steps apart`)
    }
  }
})

test('badge text keeps at least 4.5:1 against every fill', () => {
  for (const [status, fill] of Object.entries(STATUS_FILLS)) {
    const ratio = contrastRatio(fill.rgb)
    assert.ok(ratio >= 4.5, `${status} scores only ${ratio.toFixed(2)}:1`)
  }
})

test('the badge keeps its width and never flips its text colour with the theme', () => {
  const base = /\.dsh-leanspec-spec-status \{([\s\S]*?)\}/.exec(LEANSPEC_STYLES)
  assert.ok(base !== null, 'the base badge rule must exist')
  assert.match(base[1] ?? '', /flex: 0 0 auto/)
  assert.match(base[1] ?? '', /color: var\(--dsw-static-neutral-bluish-1000\)/)
  // label-primary turns light in dark mode and would drop below 4.5:1 here.
  assert.doesNotMatch(base[1] ?? '', /--dsw-alias-label-primary/)
})

/**
 * The placeholder is fill-less, so it sits on the panel surface (`bg-base` =
 * bluish-00 in light, bluish-950 in dark) and inherits
 * `--dsw-alias-label-tertiary`, which resolves to bluish-600 (#81858c) in light
 * and bluish-400 (#adb2b8) in dark. Both ratios are pinned so swapping the token
 * cannot quietly change them.
 */
const PLACEHOLDER_TEXT = { light: [129, 133, 140], dark: [173, 178, 184] } as const
const PANEL_SURFACE = { light: [255, 255, 255], dark: [21, 21, 23] } as const

test('the placeholder dash stays fill-less and reads from a theme-aware token', () => {
  const body = ruleBody('dsh-leanspec-spec-status-none')
  assert.doesNotMatch(
    body,
    /background/,
    'a sixth fill would collide with the five greyscale-spaced status colours',
  )
  assert.match(body, /color: var\(--dsw-alias-label-tertiary\)/)
  assert.doesNotMatch(
    body,
    /--dsw-static-/,
    'without a fill the text lands on the panel surface, so it must flip with the theme',
  )
  assert.equal(Object.hasOwn(STATUS_FILLS, 'none'), false, 'the placeholder is not a status fill')
})

test('the placeholder contrast is pinned for both themes', () => {
  const light = contrastBetween(PLACEHOLDER_TEXT.light, PANEL_SURFACE.light)
  const dark = contrastBetween(PLACEHOLDER_TEXT.dark, PANEL_SURFACE.dark)
  assert.equal(light.toFixed(2), '3.71', 'light mode is intentionally below AA: a dash marks an absence')
  assert.ok(dark >= 4.5, `dark mode should stay readable, got ${dark.toFixed(2)}:1`)
  assert.ok(light >= 3, 'the outline is a UI boundary, so WCAG 1.4.11 needs 3:1')
})

test('the placeholder is outlined in its own text colour', () => {
  const none = ruleBody('dsh-leanspec-spec-status-none')
  assert.match(
    none,
    /border: 1px solid currentColor/,
    'without a fill, an outline in the text colour is the only thing showing the chip shape',
  )
})

test('the placeholder keeps the same inner box as the filled badges', () => {
  const pad = (body: string): [number, number] => {
    // `0` carries no unit, so both values keep `px` optional.
    const match = /padding: (\d+)(?:px)? (\d+)(?:px)?/.exec(body)
    assert.ok(match !== null, 'expected a two-value padding shorthand')
    return [Number(match[1]), Number(match[2])]
  }
  const border = Number(/border: (\d+)px solid currentColor/.exec(ruleBody('dsh-leanspec-spec-status-none'))?.[1])
  const [baseY, baseX] = pad(ruleBody('dsh-leanspec-spec-status'))
  const [noneY, noneX] = pad(ruleBody('dsh-leanspec-spec-status-none'))
  // padding + border must add up to the filled badges' padding, otherwise the
  // outlined chip grows 2px and the statusless row gets taller than its siblings.
  assert.equal(noneY + border, baseY, 'vertical inset must match the filled badges')
  assert.equal(noneX + border, baseX, 'horizontal inset must match the filled badges')
})

/**
 * The shared width lives on the base rule, so all six badges inherit it. 42px is
 * the measured worst case plus slack: `done` is 25.47px in Segoe UI 11px/500 (the
 * host stack on Windows) and 27.05px in Verdana, and 42 - 12 = 30px of content
 * room holds both.
 */
test('all six badges share one pinned width and centre their label', () => {
  const base = ruleBody('dsh-leanspec-spec-status')
  assert.match(
    base,
    /box-sizing: border-box/,
    'declared explicitly so a host-wide border-box cannot move min-width onto the border box',
  )
  assert.match(base, /min-width: 42px/)
  assert.match(base, /text-align: center/)
  assert.match(base, /white-space: nowrap/, 'a pinned width must never let a label wrap')
  const none = ruleBody('dsh-leanspec-spec-status-none')
  assert.doesNotMatch(none, /min-width/, 'the placeholder inherits the shared width instead of opting out')
  assert.doesNotMatch(none, /box-sizing/, 'the placeholder inherits the box model too')
})

/**
 * Tables copy the Host's own markdown-table look. The Host keeps its rules behind
 * a CSS-module hash (`._tableScroll_1ypvv_192`), unreachable from a plugin, so the
 * same public tokens are applied here: row rules only, .5px, body cells at
 * border-l2 and the header at border-l3, with the first column trimmed of its
 * left padding so it lines up with the prose beside it.
 */
test('markdown tables reuse the host row-rule look instead of a full grid', () => {
  const sharedCells = /\.dsh-leanspec-preview th,\s*\.dsh-leanspec-preview td \{([\s\S]*?)\}/.exec(LEANSPEC_STYLES)?.[1] ?? ''
  const headCells = /\.dsh-leanspec-preview th \{([\s\S]*?)\}/.exec(LEANSPEC_STYLES)?.[1] ?? ''
  assert.notEqual(sharedCells, '', 'expected the shared th/td rule')
  assert.notEqual(headCells, '', 'expected the header rule')
  assert.match(
    sharedCells,
    /border-bottom: 0\.5px solid var\(--dsw-alias-border-l2\)/,
    'rows are separated by hairlines',
  )
  assert.doesNotMatch(sharedCells, /border: |border-(left|right)/, 'the Host draws rows only, so no vertical lines')
  assert.doesNotMatch(headCells, /border: /, 'the header must not grow a full box either')
  assert.match(
    headCells,
    /border-bottom-color: var\(--dsw-alias-border-l3\)/,
    'the header rule should out-weigh the body rules',
  )
  assert.match(headCells, /font: var\(--dsw-font-markdown-table-head\)/, 'host typography carries over')
  // The trailing semicolon disambiguates the body shorthand from -table-head.
  assert.match(
    LEANSPEC_STYLES,
    /\.dsh-leanspec-preview td \{\s*font: var\(--dsw-font-markdown-table\);/,
    'host typography carries over on body cells',
  )
  assert.match(
    LEANSPEC_STYLES,
    /border-collapse: collapse/,
    'separated borders would double every shared edge into two hairlines',
  )
  assert.match(
    LEANSPEC_STYLES,
    /\.dsh-leanspec-preview table \{[\s\S]*?overflow-x: auto/,
    'a genuinely too-wide table should scroll instead of stretching the panel',
  )
  assert.match(
    LEANSPEC_STYLES,
    /\.dsh-leanspec-preview th:first-child,\s*\.dsh-leanspec-preview td:first-child \{\s*padding-left: 0;?\s*\}/,
    'the first column aligns with the surrounding prose',
  )
  // Alignment: marked writes align="center|left|right" for :---: columns and
  // nothing otherwise. The browser centres bare headings, so the default must be
  // left — but it may only apply where no attribute exists, or CSS would beat the
  // author's marker.
  assert.match(
    LEANSPEC_STYLES,
    /\.dsh-leanspec-preview th:not\(\[align\]\) \{\s*text-align: left;?\s*\}/,
    'a bare heading needs an explicit left default, guarded by :not([align])',
  )
  assert.doesNotMatch(sharedCells, /text-align/, 'an unguarded text-align would beat marked’s alignment')
  assert.doesNotMatch(headCells, /text-align/, 'an unguarded text-align would beat marked’s alignment')
})

/** Only the gaps that break layout are filled; everything else stays on Host defaults. */
test('layout-breaking markdown gaps are filled from host tokens', () => {
  assert.match(
    LEANSPEC_STYLES,
    /\.dsh-leanspec-preview pre \{[\s\S]*?overflow-x: auto/,
    'a long code line must not overflow the panel',
  )
  assert.match(
    LEANSPEC_STYLES,
    /\.dsh-leanspec-preview pre \{[\s\S]*?background: var\(--dsw-alias-markdown-code-block\)/,
  )
  assert.match(
    LEANSPEC_STYLES,
    /\.dsh-leanspec-preview img \{\s*max-width: 100%;?\s*\}/,
    'an oversized image must not stretch the panel',
  )
  assert.match(
    LEANSPEC_STYLES,
    /\.dsh-leanspec-preview ul,\s*\.dsh-leanspec-preview ol \{/,
    'ordered lists need the same indent as unordered ones',
  )
  assert.match(LEANSPEC_STYLES, /\.dsh-leanspec-preview a \{\s*color: var\(--dsw-alias-link\);?\s*\}/)
  // A --- ruler must breathe: the browser default is a cramped 0.5em margin, the
  // Host uses 32px. border: none plus a background hairlines it, because a styled
  // hr would otherwise keep its default inset border.
  const ruler = /\.dsh-leanspec-preview hr \{([\s\S]*?)\}/.exec(LEANSPEC_STYLES)?.[1] ?? ''
  assert.match(ruler, /margin: 32px 0/, 'a ruler needs the Host gap, not the browser 0.5em')
  assert.match(ruler, /border: none/, 'the default inset border must go first')
  assert.match(ruler, /background: var\(--dsw-alias-border-l2\)/)
  assert.doesNotMatch(LEANSPEC_STYLES, /#[0-9a-fA-F]{3,8}/)
})

/**
 * Regression: the badge column must not depend on how long a row's text is.
 *
 * Flex distributes a row's deficit across its shrinkable items. With a name that
 * would not shrink and an arrow that would, the arrow lost width on long spec
 * names — measured in a replica at 14px collapsing to 10.1px — and dragged every
 * badge behind it about 4px to the left, which is what made the outermost spec
 * rows look misaligned. Long names must ellipsise instead of squeezing the arrow.
 */
test('the arrow column cannot shrink and the name absorbs the shrink', () => {
  assert.match(
    LEANSPEC_STYLES,
    /\.dsh-leanspec-chevron \{[\s\S]*?flex: 0 0 14px/,
    'a shrinkable arrow staggers every badge behind it',
  )
  assert.match(
    LEANSPEC_STYLES,
    /\.dsh-leanspec-file-name \{[\s\S]*?flex: 1 1 0/,
    'the name, not the arrow, must absorb the shrink',
  )
  assert.match(
    LEANSPEC_STYLES,
    /\.dsh-leanspec-file-name \{[\s\S]*?min-width: 0/,
    'without min-width 0 the name keeps its content width and overflows the row',
  )
})

/**
 * Regression: the collapsed and the expanded arrow must share one box.
 *
 * The arrow used to be a text glyph — U+25B6 collapsed, U+25BC expanded. Those
 * two characters ink differently, so no amount of column fixing made the two
 * states agree: rows drew visibly different triangles depending on whether they
 * were open. Drawing a single border triangle and only rotating it makes the ink
 * box identical by construction, and that shape has to be pinned here: switching
 * back to two glyphs would still satisfy every other assertion in this file.
 */
test('one rotated triangle draws both chevron states', () => {
  // Borders in fixed px: a 6x6 triangle that cannot inherit a font's advance.
  assert.match(
    LEANSPEC_STYLES,
    /\.dsh-leanspec-chevron::before \{[\s\S]*?border-left: 6px solid currentColor/,
    'the triangle must be drawn with borders, not a text glyph',
  )
  assert.match(LEANSPEC_STYLES, /\.dsh-leanspec-chevron::before \{[\s\S]*?border-top: 3px solid transparent/)
  assert.match(LEANSPEC_STYLES, /\.dsh-leanspec-chevron::before \{[\s\S]*?border-bottom: 3px solid transparent/)
  // Both states are the same pseudo-element, differing only by rotation.
  assert.match(
    LEANSPEC_STYLES,
    /\.dsh-leanspec-chevron::before \{[\s\S]*?transform: rotate\(0deg\)/,
    'the resting state must be the unrotated triangle',
  )
  assert.match(
    LEANSPEC_STYLES,
    /\.dsh-leanspec-chevron\.is-open::before \{[\s\S]*?transform: rotate\(90deg\)/,
    'the open state must be that same triangle rotated in place',
  )
  // And no triangle glyph survives anywhere in the stylesheet.
  assert.doesNotMatch(LEANSPEC_STYLES, /[▶▼►▸▾]/)
})
