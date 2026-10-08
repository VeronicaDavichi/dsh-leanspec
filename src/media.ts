/**
 * Image media types the viewer may serve and render.
 *
 * Pure on purpose: no `node:` imports, no DOM. The server uses the table to pick
 * a `Content-Type` and the client uses the very same table to decide whether a
 * selected file is an image, so the two can never disagree about, say, `.webp`.
 *
 * The table is an allow-list, not a convenience filter. Anything outside it is
 * refused with 415 rather than sniffed, because serving an arbitrary file from
 * the Host origin is an XSS surface (`text/html`, and SVG served as a document).
 */
export const IMAGE_MIME: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
}

/** Refuse before reading: a mistaken click must not pull a huge file into memory. */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024

/**
 * Extension of a relative path, lower-cased, or undefined when there is none.
 *
 * Rules, all of them reachable from the endpoint:
 * - a directory path (trailing slash) has no extension
 * - a dotfile such as `.png` is a name, not an extension
 * - only the last segment counts, so `a.png.txt` is a txt file
 */
function extensionOf(relPath: string): string | undefined {
  const normalised = relPath.replaceAll('\\', '/')
  if (normalised === '' || normalised.endsWith('/')) return undefined
  const base = normalised.slice(normalised.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return undefined
  const extension = base.slice(dot + 1).toLowerCase()
  return extension === '' ? undefined : extension
}

/** Fixed MIME type for an image path, or undefined when it is not an image. */
export function imageMimeType(relPath: string): string | undefined {
  const extension = extensionOf(relPath)
  return extension === undefined ? undefined : IMAGE_MIME[extension]
}

export function isImagePath(relPath: string): boolean {
  return imageMimeType(relPath) !== undefined
}

/**
 * SVG is the one image that also has a readable source form, so the viewer
 * offers a read-only source toggle for it (`REQ-6`).
 */
export function isSvgPath(relPath: string): boolean {
  return extensionOf(relPath) === 'svg'
}
