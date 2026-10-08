import { isImagePath, isSvgPath } from '../media.ts'
import type { ViewMode } from './viewer-state.ts'

/** Read-only bytes endpoint served by `src/http.ts`. */
export const RAW_ENDPOINT = '/leanspec-viewer/raw'

/**
 * URL of the raw endpoint for one project-relative path.
 *
 * An unknown root is **omitted**, never sent as an empty string — the same
 * convention `withRoot` uses for `/tree` and `/file`, so the server's own default
 * applies. Sending `root=` happens to work today (the server treats an empty
 * value as absent), but that is exactly the kind of asymmetry that makes images
 * fail while every other request keeps working, so the client does not rely on it.
 */
export function rawUrl(projectRoot: string, relPath: string): string {
  const params = new URLSearchParams()
  if (projectRoot !== '') params.set('root', projectRoot)
  params.set('path', relPath)
  return `${RAW_ENDPOINT}?${params.toString()}`
}

/**
 * Chips the toolbar shows for a selection.
 *
 * Images keep the `edit` chip but it is rendered disabled (`canEditFile`), which
 * is deliberately more discoverable than hiding it. SVG inserts a read-only
 * `source` toggle between preview and edit.
 */
export function viewModesFor(relPath: string | null): ViewMode[] {
  const svg = relPath !== null && isSvgPath(relPath)
  return svg ? ['preview', 'source', 'edit'] : ['preview', 'edit']
}

/**
 * Whether the text editor may be used at all.
 *
 * False for every image, and that is a data-loss guard rather than a nicety:
 * text content loaded from a binary file and saved back would overwrite the
 * image with mojibake.
 */
export function canEditFile(relPath: string | null): boolean {
  return relPath === null || !isImagePath(relPath)
}

/**
 * Whether the viewer should fetch the file as text.
 *
 * Images are rendered straight from the raw endpoint, so fetching them as UTF-8
 * would only produce mojibake (and, for a large file, wasted memory). SVG in
 * `source` mode is the one image that still needs the text.
 */
export function shouldLoadText(relPath: string | null, mode: ViewMode): boolean {
  if (relPath === null) return false
  if (!isImagePath(relPath)) return true
  return mode === 'source'
}

/**
 * Human-readable failure text for an image request.
 *
 * `detail` is the endpoint's own machine-readable `code`, when it sent one — and
 * it is what separates a 404 from a *registered* route (the file is gone) from a
 * 404 from an **unregistered** one (the host is still serving an older bundle).
 * Same status, completely different fix, so the sentence must not hide it.
 */
export function imageLoadErrorText(status: number, detail?: string): string {
  if (status === 0) return '图片加载失败（网络错误），请重试'
  // The bytes arrived, so the endpoint is fine: the file simply is not decodable.
  if (status === 200) return '这个文件不是有效的图片'
  if (status === 413) return '图片过大（超过 20MB），未加载'
  if (status === 415) return '这个后缀不在可预览的图片白名单里'
  if (status === 403) return '文件不存在或不在当前项目内（HTTP 403）'
  if (status === 404) {
    return detail === undefined
      ? '图片端点未就绪（HTTP 404：路由不存在）—— 宿主可能还在用旧产物，重启后再试'
      : `文件不存在（HTTP 404 · ${detail}）`
  }
  return detail === undefined
    ? `图片加载失败（HTTP ${status}）`
    : `图片加载失败（HTTP ${status} · ${detail}）`
}
