import { SPEC_STATUS_LABELS } from '../spec-status.ts'

/**
 * Badge descriptors for the spec tree.
 *
 * This module is deliberately free of React imports: the descriptor is plain
 * data, so the render rules can be unit tested without a DOM or a renderer,
 * and `LeanspecViewer` stays the only place that turns it into an element.
 */

export const SPEC_STATUS_BADGE_CLASS = 'dsh-leanspec-spec-status'

export type SpecStatusBadge = {
  className: string
  label: string
}

/**
 * Only top-level `NNN-name` directories are specs.
 *
 * `docs`-style children of a spec (`001-x/docs`) and top-level folders that do
 * not carry a sequence number must never grow a badge, even if a server ever
 * reports a status for them.
 */
export function isSpecRootDir(dirPath: string): boolean {
  return /^\d{3,}-[^/]+$/.test(dirPath)
}

/**
 * Label used when a spec has no usable status.
 *
 * A bare dash keeps every spec row on the same rhythm instead of leaving one
 * row visually "broken" (user decision, 2026-10-08). It is a placeholder, so it
 * never carries a fill — a sixth solid colour would collide with the five
 * greyscale-spaced status fills.
 */
export const SPEC_STATUS_PLACEHOLDER_LABEL = '-'

/** CSS class suffix for the placeholder, kept out of the status vocabulary. */
export const SPEC_STATUS_PLACEHOLDER_NAME = 'none'

function labelFor(status: string | undefined): string | undefined {
  if (status === undefined) return undefined
  // `hasOwnProperty` keeps prototype keys (`constructor`, `__proto__`, …) from
  // ever being mistaken for a status.
  if (!Object.prototype.hasOwnProperty.call(SPEC_STATUS_LABELS, status)) return undefined
  const label = (SPEC_STATUS_LABELS as Record<string, string>)[status]
  return typeof label === 'string' && label.length > 0 ? label : undefined
}

/**
 * Build the badge for a status.
 *
 * Anything without a usable status — absent, empty, or outside the vocabulary —
 * collapses to the `-` placeholder rather than to nothing, and the raw value is
 * never rendered, so a malformed `statusByDir` cannot put file content on
 * screen. `status` is typed loosely for exactly that reason: it arrives from
 * the wire.
 *
 * The caller must filter with `isSpecRootDir` first; this function does not
 * re-check, so it is the caller's job to keep `docs/`-style rows bare.
 */
export function specStatusBadge(status: string | undefined): SpecStatusBadge {
  const label = labelFor(status)
  if (label === undefined) {
    return {
      className: `${SPEC_STATUS_BADGE_CLASS} ${SPEC_STATUS_BADGE_CLASS}-${SPEC_STATUS_PLACEHOLDER_NAME}`,
      label: SPEC_STATUS_PLACEHOLDER_LABEL,
    }
  }
  return {
    className: `${SPEC_STATUS_BADGE_CLASS} ${SPEC_STATUS_BADGE_CLASS}-${status}`,
    label,
  }
}
