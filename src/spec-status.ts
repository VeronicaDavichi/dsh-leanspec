/**
 * LeanSpec spec status: vocabulary, parsing and badge labels.
 *
 * Kept free of `node:` imports on purpose — the server parses status while
 * answering `GET /tree`, and the browser bundle parses it again after a save
 * so the badge updates without a reload. Both sides share this one module.
 */

/** Vocabulary shared with the LeanSpec markdown adapter. */
export const SPEC_STATUSES = ['draft', 'planned', 'in-progress', 'complete', 'archived'] as const

export type SpecStatus = (typeof SPEC_STATUSES)[number]

/**
 * Short badge labels. The aside can be as narrow as 220px, so the longer names
 * are shortened: in-progress -> WIP, complete -> done, planned -> plan.,
 * archived -> arch.
 */
export const SPEC_STATUS_LABELS: Record<SpecStatus, string> = {
  draft: 'draft',
  planned: 'plan.',
  'in-progress': 'WIP',
  complete: 'done',
  archived: 'arch.',
}

/** Accepted spellings mapped onto the vocabulary. */
const STATUS_ALIASES: Record<string, SpecStatus> = {
  draft: 'draft',
  planned: 'planned',
  'in-progress': 'in-progress',
  wip: 'in-progress',
  complete: 'complete',
  done: 'complete',
  archived: 'archived',
  archive: 'archived',
  arch: 'archived',
}

const FRONTMATTER_BLOCK = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---/
const FRONTMATTER_STATUS = /^[ \t]*status[ \t]*:[ \t]*(.+?)[ \t]*$/m
const BODY_STATUS = /\*\*状态\*\*[ \t]*[:：][ \t]*([^\r\n]+)/

/**
 * Normalise a raw status token: trim, drop one layer of quotes, lowercase.
 *
 * Values outside the vocabulary must come back `undefined` so the badge is
 * omitted rather than rendering whatever the file happened to contain.
 *
 * Trailing annotations are tolerated by retrying with the leading identifier
 * run only, which covers `complete（2026-09-17）`, `arch.` and YAML comments
 * such as `draft # 草稿`.
 */
export function normalizeStatus(raw: string): SpecStatus | undefined {
  if (typeof raw !== 'string') return undefined
  let value = raw.trim()
  const quoted =
    value.length >= 2
    && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
  if (quoted) value = value.slice(1, -1).trim()
  value = value.toLowerCase()

  const whole = STATUS_ALIASES[value.replace(/\s+/g, '-')]
  if (whole !== undefined) return whole

  const leading = /^[a-z0-9]+(?:[-\s][a-z0-9]+)*/.exec(value)
  if (leading === null) return undefined
  return STATUS_ALIASES[leading[0].replace(/\s+/g, '-')]
}

/**
 * Read a spec status out of a README.
 *
 * `frontmatter status:` wins; a body `**状态**:` line (half- or full-width
 * colon) is the fallback for specs written before frontmatter was standard.
 * An unusable frontmatter value falls through to the body line instead of
 * hiding a badge the body could still supply.
 */
export function parseSpecStatus(markdown: string): SpecStatus | undefined {
  if (typeof markdown !== 'string' || markdown.length === 0) return undefined

  const block = FRONTMATTER_BLOCK.exec(markdown)
  if (block !== null) {
    const front = FRONTMATTER_STATUS.exec(block[1] ?? '')
    if (front !== null) {
      const fromFrontmatter = normalizeStatus(front[1] ?? '')
      if (fromFrontmatter !== undefined) return fromFrontmatter
    }
  }

  const body = BODY_STATUS.exec(markdown)
  return body === null ? undefined : normalizeStatus(body[1] ?? '')
}
