import { marked } from 'marked'
import { RAW_ENDPOINT, rawUrl } from './image-view.ts'

export interface MarkdownRender {
  html: string
  empty: boolean
}

export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*\/?>/gi, '')
    .replace(/<(iframe|object|embed|link|meta|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(iframe|object|embed|link|meta|style)\b[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, '$1="#"')
}

/**
 * A LeanSpec file opens with a YAML frontmatter block. `marked` knows nothing
 * about it, so the two fences became <hr> rules and the YAML itself was rendered
 * as a heading — the preview showed a stray ruler and "status: draft" in large
 * type. The block is dropped before rendering; the editor still shows the raw
 * file, so nothing is lost from the document itself.
 */
const FRONTMATTER = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

/**
 * Guards against eating a real document that merely starts with a ruler: a
 * frontmatter block carries at least one `key:` line, and a block that contains a
 * Markdown heading is a document section, not YAML.
 */
function looksLikeFrontmatter(body: string): boolean {
  const lines = body.split(/\r?\n/)
  if (lines.some((line) => /^\s*#{1,6}\s/.test(line))) return false
  return lines.some((line) => /^[A-Za-z_][A-Za-z0-9_-]*\s*:/.test(line))
}

export function stripFrontmatter(source: string): string {
  const match = FRONTMATTER.exec(source)
  if (!match || !looksLikeFrontmatter(match[1] ?? '')) return source
  return source.slice(match[0].length)
}

export function renderMarkdown(source: string): MarkdownRender {
  const body = stripFrontmatter(source)
  if (body.trim() === '') return { html: '', empty: true }
  const html = marked(body) as string
  return { html: sanitizeHtml(html), empty: false }
}

/**
 * `src` on an `<img>`, with its own quote style preserved. The lookbehind keeps
 * `data-src` and `srcset` out of it — only the attribute whose value the browser
 * actually fetches is rewritten.
 */
const IMG_TAG = /<img\b[^>]*>/gi
const SRC_ATTR = /(?<![\w-])(src\s*=\s*)(["'])([\s\S]*?)\2/gi

/** A URL scheme (`http:`, `data:`, `mailto:`, …) — never a project-relative path. */
const SCHEME = /^[a-z][a-z0-9+.-]*:/i

/**
 * Percent-decode a path, but never lose it: `marked` escapes non-ASCII file
 * names (`中文.png` becomes `%E4%B8%AD%E6%96%87.png`), while a name that really
 * contains a `%` is left as written when decoding fails.
 */
function decodePath(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * Resolve `src` against the directory of `docPath`, or `null` when the result
 * would climb out of the spec tree.
 *
 * `null` matters: the raw endpoint resolves its `path` against `specs/` and
 * rejects every surviving `..`, so a rewrite that escapes would only produce a
 * 403 and a broken image — the original value is kept instead.
 */
function resolveFromDoc(docPath: string, src: string): string | null {
  const stack: string[] = []
  for (const segment of docPath.replaceAll('\\', '/').split('/').slice(0, -1)) {
    if (segment !== '' && segment !== '.') stack.push(segment)
  }
  for (const segment of src.replaceAll('\\', '/').split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') {
      if (stack.length === 0) return null
      stack.pop()
      continue
    }
    stack.push(segment)
  }
  return stack.length === 0 ? null : stack.join('/')
}

/**
 * Value to give one `src`, or `null` to leave the attribute byte for byte.
 *
 * Everything that is not a plain relative path is skipped: an absolute URL, a
 * `data:` payload, a protocol-relative `//host/...`, a root-relative `/...`
 * (the client cannot know what it is relative to) and a value that already
 * points at the endpoint. A `?query` / `#fragment` suffix is dropped, because
 * the rewritten URL carries the endpoint's own query string.
 */
function rewrittenValue(value: string, docPath: string): string | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  if (trimmed.includes(RAW_ENDPOINT)) return null
  if (trimmed.startsWith('/') || SCHEME.test(trimmed)) return null
  const pathOnly = trimmed.split(/[?#]/)[0] ?? ''
  if (pathOnly === '') return null
  return resolveFromDoc(docPath, decodePath(pathOnly))
}

/**
 * Point relative Markdown images at the raw endpoint (REQ-7).
 *
 * Rendered previews used to request `./img/x.png` from the page itself, which is
 * a 404 — a spec file's images are only reachable through `/leanspec-viewer/raw`.
 * Only `src` on `<img>` tags is touched, and only when it is a relative path.
 */
export function rewriteImageSrc(html: string, docPath: string, projectRoot: string): string {
  if (!/<img/i.test(html)) return html
  return html.replace(IMG_TAG, (tag) => tag.replace(
    SRC_ATTR,
    (match: string, prefix: string, quote: string, value: string) => {
      const resolved = rewrittenValue(value, docPath)
      return resolved === null ? match : `${prefix}${quote}${rawUrl(projectRoot, resolved)}${quote}`
    },
  ))
}
