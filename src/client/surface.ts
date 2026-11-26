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
 * print `007-dual-surface-and-draggable-split`.
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

/**
 * The popover's size as the user left it (specs/010).
 *
 * A plain value, not a DOM measurement: the store holds it, the dialog renders
 * it through `--panel-w` / `--panel-h`, and {@link decideSurface} reads it.
 */
export interface PanelSize {
  width: number
  height: number
}

/** Narrowest popover that still hosts a 180px tree and a 360px body. */
export const PANEL_MIN_WIDTH = 600

/** Shortest popover that still shows a usable tree and toolbar. */
export const PANEL_MIN_HEIGHT = 420

/**
 * Absolute ceilings for a *stored* value.
 *
 * The real maximum is the viewport and lives in {@link clampPanel}; these only
 * stop a corrupt preference from producing an absurd box the CSS would clip
 * anyway. They are deliberately far above any real screen.
 */
export const PANEL_MAX_WIDTH = 2400
export const PANEL_MAX_HEIGHT = 1600

/** Keyboard step for ← / → / ↑ / ↓ on the resize handle. */
export const PANEL_STEP = 16

/** `localStorage` key holding the last popover size (global, not per project). */
export const PANEL_STORAGE_KEY = 'leanspec.panel'

/** The size the popover uses before, and after a reset back from, a user drag. */
export const PANEL_DEFAULT: PanelSize = { width: PANEL_WIDTH, height: PANEL_HEIGHT }

/** Everything {@link clampPanel} needs to know about the room available. */
export interface PanelLimits {
  viewportWidth: number
  viewportHeight: number
  /** The popover's top edge in viewport coordinates. */
  anchorBottom?: number
  /** Edge gap the popover needs on every side it can touch. */
  edge?: number
}

/**
 * Clamp a desired popover size to what the viewport can actually show.
 *
 * The upper bound is the viewport, never the constants above: 100vw - 2 × edge
 * is the widest box that fits, and the anchor plus the bottom edge bound the
 * height. When the viewport is smaller than the minimum the minimum wins — CSS
 * still caps the rendered box, so the result can overflow but never go negative.
 */
export function clampPanel(desired: PanelSize, limits: PanelLimits): PanelSize {
  const edge = usableEdge(limits.edge)
  const anchor = usableAnchor(limits.anchorBottom)
  const maxWidth = Number.isFinite(limits.viewportWidth)
    ? Math.max(PANEL_MIN_WIDTH, Math.round(limits.viewportWidth - 2 * edge))
    : PANEL_MAX_WIDTH
  const maxHeight = Number.isFinite(limits.viewportHeight)
    ? Math.max(PANEL_MIN_HEIGHT, Math.round(limits.viewportHeight - anchor - edge))
    : PANEL_MAX_HEIGHT
  return {
    width: clampAxis(desired.width, PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, maxWidth)),
    height: clampAxis(desired.height, PANEL_MIN_HEIGHT, Math.min(PANEL_MAX_HEIGHT, maxHeight)),
  }
}

function clampAxis(desired: number, min: number, max: number): number {
  // Only NaN falls back to the minimum: Infinity is a real (if silly) request
  // and clamps to the bound like any other oversized number.
  if (Number.isNaN(desired)) return min
  const rounded = Math.round(desired)
  return Math.min(Math.max(rounded, min), Math.max(min, max))
}

/**
 * The size a drag lands on: the size it started from plus the pointer delta.
 *
 * Pulled out of the component so the arithmetic is unit-tested without React or
 * a DOM (specs/010 T2.1).
 */
export function panelFromDrag(
  start: PanelSize,
  dx: number,
  dy: number,
  limits: PanelLimits,
): PanelSize {
  const stepX = Number.isFinite(dx) ? dx : 0
  const stepY = Number.isFinite(dy) ? dy : 0
  return clampPanel(
    { width: start.width + stepX, height: start.height + stepY },
    limits,
  )
}

/**
 * Read a persisted popover size.
 *
 * Missing, malformed or out-of-range values fall back to the default rather
 * than throwing: a corrupt preference must not stop the panel opening
 * (REQ-4.3). A smaller-than-minimum value is *not* repaired to the floor: it
 * could not have been written by this plugin, so the default is the honest
 * answer.
 */
export function readStoredPanel(raw: string | null | undefined): PanelSize {
  if (raw === null || raw === undefined || raw.trim() === '') return PANEL_DEFAULT
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return PANEL_DEFAULT
  }
  if (typeof parsed !== 'object' || parsed === null) return PANEL_DEFAULT
  const record = parsed as { width?: unknown; height?: unknown }
  return {
    width: readStoredAxis(record.width, PANEL_MIN_WIDTH, PANEL_MAX_WIDTH, PANEL_WIDTH),
    height: readStoredAxis(record.height, PANEL_MIN_HEIGHT, PANEL_MAX_HEIGHT, PANEL_HEIGHT),
  }
}

function readStoredAxis(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  const rounded = Math.round(value)
  if (rounded < min || rounded > max) return fallback
  return rounded
}

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
  /**
   * The size the user left the popover at (specs/010).
   *
   * Absent means the 007 default, which keeps this function's answer identical
   * for a user who never resized (REQ-3.2). The size is compared **as stored**,
   * not capped to the viewport: capping first would turn 1087px into a popup at
   * 1039px and silently break 007's 1087 → tab boundary (design.md §2).
   */
  panel?: PanelSize
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
  const width = input.panel?.width ?? PANEL_WIDTH
  const height = input.panel?.height ?? PANEL_HEIGHT
  const roomy = Number.isFinite(input.viewportWidth)
    && Number.isFinite(input.viewportHeight)
    && input.viewportWidth >= width + 2 * edge
    && input.viewportHeight >= height + anchor + edge
  return roomy ? 'popup' : 'tab'
}
