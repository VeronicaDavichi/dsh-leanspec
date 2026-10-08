export const LEANSPEC_STYLES = `
.dsh-leanspec-root {
  position: relative;
  display: inline-flex;
}
.dsh-leanspec-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 111px;
  height: 32px;
  padding: 6px 12px;
  gap: 4px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 18px;
  color: var(--dsw-alias-label-primary);
  background: transparent;
  font-family: var(--dsw-font-family);
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
  cursor: pointer;
}
.dsh-leanspec-trigger:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh-leanspec-trigger.is-open {
  background: var(--dsw-alias-button-ghost-active-fill);
  border-color: var(--dsw-alias-button-ghost-active-border);
}

.dsh-leanspec-popover {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  /* T3.3 / REQ-2.1: 1040x640, capped so it can never leave the viewport. The
     anchor is the popover's own top edge, injected inline by the header; the
     fallback covers the first paint, before anything has been measured. */
  width: min(1040px, calc(100vw - 48px));
  height: min(640px, calc(100vh - var(--anchor, 48px) - 24px));
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  box-shadow: 0 16px 40px var(--dsw-alias-bg-mask-2);
  font-family: var(--dsw-font-family);
}

/* Both exits put a fixed switch strip above one panel, so the panel takes the
   remaining height instead of its own height:100% overflowing the frame. */
.dsh-leanspec-popover > .dsh-leanspec-shell,
.dsh-leanspec-tab > .dsh-leanspec-shell {
  flex: 1 1 auto;
  height: auto;
  min-height: 0;
}

/* The tab body: the host pane already draws the tab frame, so this is a bare
   column — a second border/shadow/radius here would nest inside it. */
.dsh-leanspec-tab {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  color: var(--dsw-alias-label-primary);
  font-family: var(--dsw-font-family);
  font-size: 13px;
}

/* Notice row only: the switch button moved onto the tree pane's header row
   (2026-10-08), so this bar renders only when there is something to say — a
   disabled control's reason or a failed switch (REQ-8.2). Never an empty bar.
   The tab body has none either: the tab is one-way, so nothing in the sidebar
   points back at the popup. */
.dsh-leanspec-switchbar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
}

.dsh-leanspec-switch {
  display: inline-flex;
  align-items: center;
  /* The row's only incompressible item: the pane title gives way (min-width: 0
     + ellipsis), this must never shrink or wrap. Without nowrap a squeezed flex
     item breaks the two-character label onto two lines and the header row grows
     tall (user report, 2026-10-08). */
  flex: 0 0 auto;
  white-space: nowrap;
  height: 26px;
  padding: 0 10px;
  gap: 4px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font-family: var(--dsw-font-family);
  font-size: 12px;
  line-height: 18px;
  cursor: pointer;
}
.dsh-leanspec-switch:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh-leanspec-switch:disabled {
  color: var(--dsw-alias-label-tertiary);
  cursor: not-allowed;
}

/* A disabled control's reason, and a failed switch's message: never silent
   (REQ-8.2). */
.dsh-leanspec-notice-text {
  margin: 0;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}

.dsh-leanspec-shell {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  color: var(--dsw-alias-label-primary);
  font-family: var(--dsw-font-family);
  font-size: 13px;
}

/* Width is authoritative here (set inline by the shared store); 280px is the
   pre-hydration value. The right edge is drawn by .dsh-leanspec-splitter, so
   there is no border on the aside.
   Measured (tasks.md T1.3): flex 0-0-auto and 0-1-auto behave identically in
   this layout — the body is flex-basis 0 with min-width 0, so the flex line
   never overflows and nothing gets to shrink. What actually keeps the body at
   360px is the JS clamp in surface.ts, not this line. */
.dsh-leanspec-aside {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  width: 280px;
  background: var(--dsw-specific-sidebar-fill);
}
/* Splitter: a 5px grab area over a 1px rule, invisible at rest but easy to
   catch. touch-action: none stops trackpad and touch drags from scrolling the
   panel instead of moving the divider. */
.dsh-leanspec-splitter {
  flex: 0 0 auto;
  width: 5px;
  margin: 0 -2px;
  position: relative;
  z-index: 1;
  background: transparent;
  cursor: col-resize;
  touch-action: none;
}
.dsh-leanspec-splitter::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 2px;
  width: 1px;
  background: var(--dsw-alias-border-l2);
}
.dsh-leanspec-splitter:hover::before,
.dsh-leanspec-splitter:focus-visible::before,
.dsh-leanspec-splitter.is-dragging::before {
  background: var(--dsw-static-blue-500);
}
.dsh-leanspec-splitter:focus-visible {
  outline: 2px solid var(--dsw-static-blue-500);
  outline-offset: -2px;
}
.dsh-leanspec-shell.is-dragging {
  cursor: col-resize;
  user-select: none;
}
/* The tree pane's header row: the 「LeanSpec」 label and the panel's optional
   head control (the popup's 「在右栏打开」) share one line, with the control
   pushed to the right edge of this column (2026-10-08 adjustment).
   min-width: 0 on the label lets it ellipsize instead of shoving the control
   out of a narrow pane — the splitter bottoms out at 180px. */
.dsh-leanspec-aside-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 0 0 auto;
  gap: 8px;
  padding: 8px 14px 6px;
}
.dsh-leanspec-aside-title {
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  font-weight: 600;
  color: var(--dsw-alias-label-tertiary);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-leanspec-banner {
  margin: 0 14px 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--dsw-alias-state-warn-tertiary);
  color: var(--dsw-alias-state-warn-label);
  line-height: 1.45;
}
.dsh-leanspec-tree {
  flex: 1;
  overflow: auto;
  /* 6px + the row's own 8px of padding puts the first column at x=14, which is
     exactly where .dsh-leanspec-aside-title and .dsh-leanspec-banner start, so
     the whole panel shares one left edge. */
  padding: 4px 6px 12px;
}
.dsh-leanspec-tree ul {
  list-style: none;
  margin: 0;
  padding: 0 0 0 12px;
}
.dsh-leanspec-tree li {
  /* Stated explicitly: a host rule on li (padding or a marker) would shift
     whole rows and make the badge column look ragged. */
  margin: 0;
  padding: 0;
  list-style: none;
}
.dsh-leanspec-tree > ul {
  padding-left: 0;
}
.dsh-leanspec-dir,
.dsh-leanspec-file {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 6px;
  margin: 1px 0;
  padding: 5px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.dsh-leanspec-dir {
  color: var(--dsw-alias-label-secondary);
  font-weight: 500;
}
.dsh-leanspec-dir:hover,
.dsh-leanspec-file:hover {
  background: var(--dsw-specific-sidebar-nav-item-hover);
}
.dsh-leanspec-file.is-selected {
  background: var(--dsw-specific-sidebar-nav-item-active);
  color: var(--dsw-alias-label-primary);
}
/* Specificity hardening. Every rule above is a single class (0,1,0), while the
   Host sidebar ships rules like .dsh-sidebar button (0,1,1) that would win and
   replace our row with an inline-flex box. That silently drops gap/flex, so each
   row lays its badge out after the glyph — and because a collapsed arrow and an
   expanded one have different advance widths, the badge column staggers per row.
   Only the row (a button) and the arrow need this: the badge is a span, so a
   host button rule cannot reach it, and its pinned single-class rule stays the
   only match the styles tests find for it. */
.dsh-leanspec-shell .dsh-leanspec-dir,
.dsh-leanspec-shell .dsh-leanspec-file {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 6px;
  padding: 5px 8px;
}
.dsh-leanspec-shell .dsh-leanspec-dir > .dsh-leanspec-chevron {
  /* display is repeated on purpose: if a host rule such as button > span turns
     the arrow back into an inline box, width and flex are ignored. The glyph is
     a fixed-px pseudo-element (see below), so the ink box stays 6x6 either way
     and no longer depends on a font's advance width. */
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  flex: 0 0 14px;
  min-width: 14px;
  width: 14px;
}
/* The expand/collapse glyph.
   One pseudo-element, drawn once and only rotated between the two states, so the
   ink box is identical by construction. The previous Unicode triangles (U+25B8
   /U+25BE, then U+25B6 / U+25BC) each carried a different advance width, so the
   14px column could not make the two states agree: the collapsed and expanded
   arrows measured differently and the badge column staggered per row. Borders in
   fixed px remove the font from the equation entirely.
   Geometry: border-left 6px + transparent top/bottom 3px = a 6x6 right-pointing
   triangle; rotating it 90deg about its centre yields a 6x6 down-pointing one.
   Transforms do not affect layout, so both states occupy the same 6px. */
.dsh-leanspec-chevron {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  /* flex 0 0 14px, not just width: as a flex item the arrow would otherwise be
     shrinkable, and a per-row shrink would stagger every badge behind it. */
  flex: 0 0 14px;
  width: 14px;
  color: var(--dsw-alias-label-caption);
}
.dsh-leanspec-chevron::before {
  content: '';
  border-left: 6px solid currentColor;
  border-top: 3px solid transparent;
  border-bottom: 3px solid transparent;
  /* Collapsed: pointing right. */
  transform: rotate(0deg);
}
/* Open: the same triangle, rotated in place — never a second glyph. */
.dsh-leanspec-chevron.is-open::before {
  transform: rotate(90deg);
}
/* Spec status badge. Never squeezed (flex: 0 0 auto) — the file name carries
   the ellipsis instead. Text stays a fixed dark tone rather than label-primary,
   which flips light in dark mode and would fall under 4.5:1 on these fills.
   Fills come from static tokens so the greyscale spacing is deterministic;
   draft is a 44/56 blue-400 x green-400 mix, the closest reachable teal.
   All six badges are pinned to 42px so the spec names line up in a column.
   Measured in Segoe UI 11px/500 (the host stack on Windows): the widest label is
   "done" at 25.47px, not "draft"; the worst common fallback is Verdana at
   27.05px, so 30px of content room keeps about 3px of slack. border-box is
   declared explicitly because a host-wide border-box would otherwise move
   min-width onto the border box, leaving 18px of room and letting "done" grow
   past its siblings. min-width (not width) means a wider font cannot clip. */
.dsh-leanspec-spec-status {
  flex: 0 0 auto;
  box-sizing: border-box;
  min-width: 42px;
  text-align: center;
  padding: 1px 6px;
  border-radius: 6px;
  color: var(--dsw-static-neutral-bluish-1000);
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
}
.dsh-leanspec-spec-status-draft {
  background: color-mix(in srgb, var(--dsw-static-blue-400) 44%, var(--dsw-static-green-400) 56%);
}
.dsh-leanspec-spec-status-planned {
  /* deepseek-500 alone lands on 4.46:1 — under AA — so it is mixed toward
     blue-500: 4.73:1, and planned sits 18.6 grey steps below done instead of
     14.5. A single blue token could not hold both constraints. */
  background: color-mix(in srgb, var(--dsw-static-deepseek-500) 60%, var(--dsw-static-blue-500) 40%);
}
.dsh-leanspec-spec-status-in-progress {
  background: var(--dsw-static-amber-400);
}
.dsh-leanspec-spec-status-complete {
  background: var(--dsw-static-green-500);
}
.dsh-leanspec-spec-status-archived {
  background: var(--dsw-static-neutral-bluish-300);
}
/* No usable status. Deliberately NO fill: it sits directly on the panel surface,
   so its text must come from a theme-aware alias token (tertiary = bluish-600 in
   light, bluish-400 in dark) rather than the fixed dark tone used on the fills.
   Contrast is 3.71:1 light / 8.54:1 dark (measured, pinned by styles.test.ts) —
   the text is below AA in light mode on purpose (a dash marks an absence), but
   the outline is a UI boundary and clears WCAG 1.4.11's 3:1, which is what makes
   the chip's shape readable at all. Padding drops to 0 5px so the 1px border
   keeps the same 1px/6px inner inset as the filled badges and the row height
   cannot change. */
.dsh-leanspec-spec-status-none {
  color: var(--dsw-alias-label-tertiary);
  padding: 0 5px;
  border: 1px solid currentColor;
}
.dsh-leanspec-file-name {
  /* flex 1 1 0 + min-width 0 so a long name absorbs every pixel of shrink and
     ellipsises. Without it the name refuses its share, flex distributes the
     deficit onto the arrow, and the badge behind a shrunk arrow drifts left —
     which is what made long spec names look misaligned. */
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dsh-leanspec-main {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  background: var(--dsw-alias-bg-layer-1);
}
.dsh-leanspec-chrome {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-2);
}
.dsh-leanspec-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 6px;
}
.dsh-leanspec-path {
  display: block;
  box-sizing: border-box;
  width: 100%;
  margin: 0;
  padding: 0 12px 8px;
  color: var(--dsw-alias-label-caption);
  font-size: 12px;
  line-height: 1.45;
  text-align: left;
  overflow-wrap: anywhere;
  word-break: break-all;
}
.dsh-leanspec-chip {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  cursor: pointer;
}
.dsh-leanspec-chip:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh-leanspec-chip.is-active {
  background: var(--dsw-alias-button-ghost-active-fill);
  border-color: var(--dsw-alias-button-ghost-active-border);
  color: var(--dsw-alias-label-primary);
}
.dsh-leanspec-chip:disabled {
  opacity: 0.45;
  color: var(--dsw-alias-label-primary);
  cursor: default;
}
.dsh-leanspec-save {
  height: 28px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: var(--dsw-alias-state-business-primary);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  cursor: pointer;
}
.dsh-leanspec-save:hover:not(:disabled) {
  background: var(--dsw-alias-button-info-hover);
}
.dsh-leanspec-save:disabled {
  opacity: 0.45;
  color: var(--dsw-alias-label-primary);
  cursor: default;
}
.dsh-leanspec-status-ok {
  color: var(--dsw-alias-state-success-primary);
  font-size: 12px;
}
.dsh-leanspec-status-err {
  color: var(--dsw-alias-state-error-primary);
  font-size: 12px;
}

.dsh-leanspec-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 20px 24px 28px;
  color: var(--dsw-alias-label-primary);
}
.dsh-leanspec-empty {
  margin: 24px 0 0;
  color: var(--dsw-alias-label-tertiary);
}
.dsh-leanspec-preview h1,
.dsh-leanspec-preview h2,
.dsh-leanspec-preview h3,
.dsh-leanspec-preview h4 {
  margin: 0 0 12px;
  color: var(--dsw-alias-label-primary);
  font-weight: 600;
}
.dsh-leanspec-preview p,
.dsh-leanspec-preview li {
  margin: 0 0 8px;
  line-height: 1.65;
  color: var(--dsw-alias-label-secondary);
}
.dsh-leanspec-preview ul,
.dsh-leanspec-preview ol {
  margin: 0 0 12px;
  padding-left: 20px;
}
/* Tables copy the Host's own markdown-table look rather than inventing one: the
   Host draws row rules only — th a .5px border-l3, td a .5px border-l2 — with
   edge-trimmed padding so the first column lines up with the prose beside it.
   No vertical lines, on purpose. Typography and colours come from its tokens
   (--dsw-font-markdown-table / -table-head), so a Host restyle carries over.
   marked emits a bare table with no wrapper, so the Host's scroll container is
   replaced by making the table itself scroll. text-align is set ONLY on cells
   without an align attribute: marked writes align="center|left|right" for :---:
   columns, and a plain text-align would beat that presentational hint. */
.dsh-leanspec-preview table {
  display: block;
  max-width: 100%;
  margin: 0 0 12px;
  overflow-x: auto;
  border-collapse: collapse;
}
.dsh-leanspec-preview th,
.dsh-leanspec-preview td {
  padding: 10px 16px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
  vertical-align: top;
  max-width: min(30vw, 320px);
  min-width: 100px;
}
.dsh-leanspec-preview th {
  border-bottom-color: var(--dsw-alias-border-l3);
  font: var(--dsw-font-markdown-table-head);
}
.dsh-leanspec-preview td {
  font: var(--dsw-font-markdown-table);
}
.dsh-leanspec-preview th:first-child,
.dsh-leanspec-preview td:first-child {
  padding-left: 0;
}
.dsh-leanspec-preview td:last-child {
  padding-right: 0;
}
.dsh-leanspec-preview table code {
  font-size: 11px;
}
.dsh-leanspec-preview th:not([align]) {
  text-align: left;
}
.dsh-leanspec-preview code,
.dsh-leanspec-source {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  background: var(--dsw-alias-markdown-code-block);
  color: var(--dsw-alias-label-primary);
}
.dsh-leanspec-source {
  margin: 0;
  padding: 14px 16px;
  border-radius: 10px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.55;
  font-size: 12.5px;
}
/* Gaps filled in from Host tokens, each because the browser default is wrong for
   a document panel: a long code line would overflow, an oversized image would
   stretch the panel, a link would fall back to the browser blue, and a --- ruler
   would sit in the browser's cramped 0.5em gap instead of the Host's 32px. */
.dsh-leanspec-preview pre {
  margin: 0 0 12px;
  padding: 12px 14px;
  border-radius: 10px;
  overflow-x: auto;
  background: var(--dsw-alias-markdown-code-block);
}
.dsh-leanspec-preview hr {
  display: block;
  height: 0.5px;
  margin: 32px 0;
  border: none;
  background: var(--dsw-alias-border-l2);
}
.dsh-leanspec-preview a {
  color: var(--dsw-alias-link);
}
.dsh-leanspec-preview img {
  max-width: 100%;
}
.dsh-leanspec-editor {
  width: 100%;
  height: 100%;
  min-height: 280px;
  box-sizing: border-box;
  padding: 14px 16px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  background: var(--dsw-alias-markdown-code-block);
  color: var(--dsw-alias-label-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.55;
  resize: none;
  outline: none;
}
.dsh-leanspec-editor:focus {
  border-color: var(--dsw-alias-state-business-primary);
}
/* Image preview (008). The wrap fills the body's content box so
   max-height: 100% on the image has something definite to resolve against;
   height: 100% degrades to auto outside a sized ancestor, so an unknown panel
   height falls back to "as tall as the picture" plus the body's own scroll. */
.dsh-leanspec-image-wrap {
  display: flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 240px;
  overflow: auto;
}
/* The click target that opens the raw bytes in a new tab. It carries the height
   so the image inside it can be capped: a percentage max-height against an
   auto-height parent is ignored, which would let a large file stretch the wrap. */
.dsh-leanspec-image-link {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  max-width: 100%;
}
.dsh-leanspec-image {
  display: block;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  cursor: zoom-in;
}
/* Failure state. Same warning pair as the load banner: a message plus the one
   action that can help, never an empty box or a broken-image glyph. */
.dsh-leanspec-image-error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  margin: 24px 0 0;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--dsw-alias-state-warn-tertiary);
  color: var(--dsw-alias-state-warn-label);
  line-height: 1.45;
}
`

let inserted = false

export function ensureLeanspecStyles(): void {
  if (inserted || typeof document === 'undefined') return
  if (document.getElementById('dsh-leanspec-styles')) {
    inserted = true
    return
  }
  const style = document.createElement('style')
  style.id = 'dsh-leanspec-styles'
  style.textContent = LEANSPEC_STYLES
  document.head.appendChild(style)
  inserted = true
}
