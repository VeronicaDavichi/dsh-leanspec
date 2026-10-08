/**
 * Pure geometry for the panel: which surface fits the viewport (T3.1) and how
 * the tree/body split is clamped (design.md §6).
 *
 * Deliberately free of DOM and `node:` imports: it runs in the browser, and
 * `test/surface.test.ts` unit-tests it in plain Node.
 */
import type { Surface } from './tab-surface.ts'

/** Default file-tree width in px — matches the shipped panel. */
export const SPLIT_DEFAULT = 280

/** Narrowest useful tree: a `NNN-name` row plus its 42px badge. */
export const SPLIT_MIN = 180

/** Widest the tree may get before the body starts to feel cramped. */
export const SPLIT_MAX = 420

/**
 * Room the body keeps however hard the tree is dragged.
 *
 * Measured, not guessed: at 358px the four-column tables in `design.md` start
 * scrolling sideways, so the body gets 360px.
 */
export const BODY_MIN = 360

/** Keyboard step for ← / → on the splitter (REQ-7.1). */
export const SPLIT_STEP = 16

/** `localStorage` key holding the last tree width. */
export const SPLIT_STORAGE_KEY = 'leanspec.split'

/**
 * Clamp a desired tree width to what the panel can actually give.
 *
 * The upper bound gives way first when the panel is narrow: 500px of panel
 * cannot host a 420px tree *and* a 360px body, so the tree shrinks instead of
 * squeezing the body below {@link BODY_MIN}. The lower bound wins only when
 * even that is impossible — a body that scrolls beats a tree too narrow to
 * print `006-status-demo-none`.
 */
export function clampSplit(desired: number, availableWidth: number): number {
  const usable = Number.isFinite(availableWidth) ? availableWidth - BODY_MIN : SPLIT_MAX
  const upper = Math.min(SPLIT_MAX, usable)
  if (upper <= SPLIT_MIN) return SPLIT_MIN
  // Only NaN falls back to the default: Infinity is a real (if silly) request
  // and clamps to the upper bound like any other oversized number.
  if (Number.isNaN(desired)) return SPLIT_DEFAULT
  return Math.min(Math.max(Math.round(desired), SPLIT_MIN), upper)
}

/**
 * Read a persisted tree width.
 *
 * Missing, unparsable or out-of-range values fall back to {@link SPLIT_DEFAULT}
 * rather than throwing: a corrupt preference must not stop the panel opening.
 */
export function readStoredSplit(raw: string | null | undefined): number {
  if (raw === null || raw === undefined || raw.trim() === '') return SPLIT_DEFAULT
  const value = Number(raw)
  if (!Number.isFinite(value)) return SPLIT_DEFAULT
  const rounded = Math.round(value)
  if (rounded < SPLIT_MIN || rounded > SPLIT_MAX) return SPLIT_DEFAULT
  return rounded
}

/**
 * The largest tree width the panel can offer at `availableWidth`.
 *
 * Shared by the drag clamp and the splitter's `aria-valuemax` so the announced
 * range is the range the user can actually reach (REQ-7.2).
 */
export function splitUpperBound(availableWidth: number): number {
  const usable = Number.isFinite(availableWidth) ? availableWidth - BODY_MIN : SPLIT_MAX
  return Math.max(SPLIT_MIN, Math.min(SPLIT_MAX, usable))
}

/* -------------------------------------------------------------------------
 * Surface decision (T3.1, REQ-1.1 / REQ-1.2 / REQ-1.4)
 *
 * One place for every magic number: the popover's own size, the edge gap, and
 * the anchor used when no live measurement is available. The breakpoints are
 * *derived*, never typed twice.
 * ---------------------------------------------------------------------- */

/** Popover size (REQ-2.1). Mirrored by the CSS caps in styles.ts. */
export const PANEL_WIDTH = 1040
export const PANEL_HEIGHT = 640

/** Gap kept between the popover and the viewport edges (design.md §4). */
export const PANEL_EDGE = 24

/** Gap between the header control's bottom and the popover's top edge. */
export const ANCHOR_GAP = 8

/**
 * Popover top offset used when there is no live measurement.
 *
 * 48 = a 40px header control plus {@link ANCHOR_GAP}. The brief pins the height
 * breakpoint at 712 = 640 + 48 + 24; design.md §4's older arithmetic (a 52px
 * anchor) would have given 716. The live path measures the real button, so this
 * value only decides the boundary before the first measurement (T0.3).
 */
export const ANCHOR_FALLBACK = 48

/** Smallest viewport that still fits the popover: 1040 + 2 × 24 = 1088. */
export const SURFACE_MIN_WIDTH = PANEL_WIDTH + 2 * PANEL_EDGE

/** Smallest viewport height that still fits the popover: 640 + 48 + 24 = 712. */
export const SURFACE_MIN_HEIGHT = PANEL_HEIGHT + ANCHOR_FALLBACK + PANEL_EDGE

/**
 * Everything the decision reads. `anchorBottom` and `edge` are the live values;
 * both fall back to the measured defaults when absent or unusable (REQ-1.4).
 */
export interface SurfaceDecisionInput {
  viewportWidth: number
  viewportHeight: number
  /** The popover's top edge in viewport coordinates (button bottom + 8). */
  anchorBottom?: number
  /** Edge gap; the popover needs one on each side. */
  edge?: number
}

function usableAnchor(anchorBottom: number | undefined): number {
  return typeof anchorBottom === 'number' && Number.isFinite(anchorBottom) && anchorBottom >= 0
    ? anchorBottom
    : ANCHOR_FALLBACK
}

function usableEdge(edge: number | undefined): number {
  return typeof edge === 'number' && Number.isFinite(edge) && edge >= 0 ? edge : PANEL_EDGE
}

/**
 * The popover's top offset for a header control whose rect bottom is `bottom`.
 *
 * The single place the +8 gap lives, so the decision and the injected CSS
 * variable can never disagree (REQ-1.4).
 */
export function anchorBottomFromTrigger(bottom: number | undefined): number {
  return typeof bottom === 'number' && Number.isFinite(bottom) && bottom >= 0
    ? bottom + ANCHOR_GAP
    : ANCHOR_FALLBACK
}

/**
 * Which surface the panel should use for a given viewport (REQ-1.1, REQ-1.2).
 *
 * Pure and total: a viewport that is not a finite number is *not* roomy, so the
 * answer is the narrow-window one (`'tab'`) and the caller's capability fallback
 * decides whether that is even possible (REQ-8.1).
 */
export function decideSurface(input: SurfaceDecisionInput): Surface {
  const edge = usableEdge(input.edge)
  const anchor = usableAnchor(input.anchorBottom)
  const roomy = Number.isFinite(input.viewportWidth)
    && Number.isFinite(input.viewportHeight)
    && input.viewportWidth >= PANEL_WIDTH + 2 * edge
    && input.viewportHeight >= PANEL_HEIGHT + anchor + edge
  return roomy ? 'popup' : 'tab'
}
