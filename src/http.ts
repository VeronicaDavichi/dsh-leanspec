import {
  LeanspecError,
  listSpecs,
  NO_LEANSPEC_MESSAGE,
  readSpecBinary,
  readSpecFile,
  writeSpecFile,
} from './leanspec-fs.ts'
import { imageMimeType } from './media.ts'

export interface HttpInput {
  method: string
  pathname: string
  searchParams: URLSearchParams
  body?: string
}

export interface HttpResult {
  status: number
  body?: unknown
  /**
   * Binary response. When present `src/index.ts` writes the bytes instead of
   * JSON — a raw image cannot travel inside a JSON envelope without inflating
   * it by a third and blocking the main thread while it is decoded.
   */
  binary?: { bytes: Buffer; contentType: string; headers?: Record<string, string> }
}

function statusFor(error: LeanspecError): number {
  if (error.code === 'not-spec') return 404
  if (error.code === 'invalid-root') return 400
  if (error.code === 'forbidden' || error.code === 'invalid-path') return 403
  if (error.code === 'not-found' || error.code === 'not-file') return 404
  if (error.code === 'too-large') return 413
  if (error.code === 'unsupported-media') return 415
  return 400
}

function fail(error: unknown): HttpResult {
  if (error instanceof LeanspecError) {
    return { status: statusFor(error), body: { error: error.message, code: error.code } }
  }
  const message = error instanceof Error ? error.message : 'unexpected error'
  return { status: 500, body: { error: message } }
}

function routeTail(pathname: string): string {
  const prefix = '/leanspec-viewer'
  if (pathname === prefix) return ''
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length)
  return pathname
}

function parseJsonBody(raw: string | undefined): Record<string, unknown> | undefined {
  if (!raw) return undefined
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    return undefined
  }
  return undefined
}

function requestRoot(input: HttpInput, payload?: Record<string, unknown>): string | undefined {
  const fromQuery = input.searchParams.get('root')
  if (fromQuery) return fromQuery
  const fromBody = payload?.root
  return typeof fromBody === 'string' ? fromBody : undefined
}

export async function handleLeanspecHttp(input: HttpInput): Promise<HttpResult> {
  const method = input.method.toUpperCase()
  const tail = routeTail(input.pathname)

  try {
    // GET /tree 或 /changes - 列出所有 Specs
    if (method === 'GET' && (tail === '/tree' || tail === '/changes')) {
      const listed = listSpecs(requestRoot(input))
      if (!listed.present) {
        return {
          status: 200,
          body: { present: false, specs: [], files: [], dirs: [], statusByDir: {}, message: NO_LEANSPEC_MESSAGE },
        }
      }
      return {
        status: 200,
        body: {
          present: true,
          specs: listed.specs,
          files: listed.files,
          dirs: listed.dirs,
          statusByDir: listed.statusByDir,
        },
      }
    }

    // GET /file - 读取 Spec 文件
    if (method === 'GET' && tail === '/file') {
      const relPath = input.searchParams.get('path') ?? ''
      const content = readSpecFile(requestRoot(input), relPath)
      return { status: 200, body: { content } }
    }

    // GET/HEAD /raw - 读取图片字节（只读；白名单外的后缀一律 415）
    if ((method === 'GET' || method === 'HEAD') && tail === '/raw') {
      const relPath = input.searchParams.get('path') ?? ''
      if (relPath.trim() === '') {
        return { status: 400, body: { error: 'path is required' } }
      }
      // The allow-list is consulted before the filesystem is touched at all:
      // a refused type must not be opened, let alone echoed back, and the
      // Content-Type is only ever this fixed table entry — never the request's.
      const contentType = imageMimeType(relPath)
      if (contentType === undefined) {
        throw new LeanspecError('unsupported-media', 'this file type is not previewable')
      }
      let bytes: Buffer
      try {
        bytes = readSpecBinary(requestRoot(input), relPath)
      } catch (error) {
        // design.md §2 calls a non-regular file a forbidden target, while /file
        // keeps its historical 404 for the same code — so the mapping is local.
        if (error instanceof LeanspecError && error.code === 'not-file') {
          return { status: 403, body: { error: 'only regular files are served' } }
        }
        throw error
      }
      // HEAD keeps the status and the headers and drops the payload, so a failed
      // <img> can ask for the reason (413 vs 415 vs 404) without a second copy.
      return {
        status: 200,
        binary: {
          bytes: method === 'HEAD' ? Buffer.alloc(0) : bytes,
          contentType,
          headers: { 'cache-control': 'no-cache' },
        },
      }
    }

    // PUT /file - 写入 Spec 文件
    if (method === 'PUT' && tail === '/file') {
      const payload = parseJsonBody(input.body)
      if (payload === undefined) {
        return { status: 400, body: { error: 'invalid JSON body' } }
      }
      if (typeof payload.content !== 'string') {
        return { status: 400, body: { error: 'content must be a string' } }
      }
      const relPath = typeof payload.path === 'string' ? payload.path : ''
      writeSpecFile(requestRoot(input, payload), relPath, payload.content)
      return { status: 200, body: { ok: true } }
    }

    return { status: 404, body: { error: 'not found' } }
  } catch (error) {
    return fail(error)
  }
}
