import fs from 'node:fs'
import path from 'node:path'
import { MAX_IMAGE_BYTES } from './media.ts'
import { parseSpecStatus, type SpecStatus } from './spec-status.ts'

export const NO_LEANSPEC_MESSAGE = '当前项目没有 LeanSpec (specs/ 目录不存在)'

export type LeanspecErrorCode =
  | 'invalid-root'
  | 'invalid-path'
  | 'not-found'
  | 'not-file'
  | 'not-dir'
  | 'forbidden'
  | 'not-spec'
  /** Larger than the caller's byte budget: refused from `statSync`, before any read. */
  | 'too-large'
  /** Outside the media allow-list, i.e. not something that may be served at all. */
  | 'unsupported-media'

export class LeanspecError extends Error {
  readonly code: LeanspecErrorCode

  constructor(code: LeanspecErrorCode, message: string) {
    super(message)
    this.name = 'LeanspecError'
    this.code = code
  }
}

function isInside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child)
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel))
}

export function resolveProjectRoot(projectRoot: string | undefined): string | undefined {
  if (typeof projectRoot !== 'string' || projectRoot.trim() === '') return undefined
  const trimmed = projectRoot.trim()
  if (!path.isAbsolute(trimmed)) {
    throw new LeanspecError('invalid-path', 'project root must be an absolute path')
  }
  return path.resolve(trimmed)
}

export function resolveSpecsDir(projectRoot: string | undefined): string {
  const root = resolveProjectRoot(projectRoot)
  if (root === undefined) {
    throw new LeanspecError('not-spec', NO_LEANSPEC_MESSAGE)
  }
  const specs = path.join(root, 'specs')
  if (!fs.existsSync(specs) || !fs.statSync(specs).isDirectory()) {
    throw new LeanspecError('not-spec', NO_LEANSPEC_MESSAGE)
  }
  return fs.realpathSync(specs)
}

function assertRelPath(relPath: string): void {
  if (
    !relPath
    || path.isAbsolute(relPath)
    || relPath.split(/[/\\]/).includes('..')
    || relPath.split(/[/\\]/).includes('.')
    || relPath.split(/[/\\]/).includes('')
  ) {
    throw new LeanspecError('invalid-path', 'path escapes specs directory')
  }
}

/**
 * 解析 LeanSpec 目录中的相对路径
 * LeanSpec 结构: specs/NNN-name/README.md
 */
export function resolveExistingFile(projectRoot: string | undefined, relPath: string): string {
  const specsDir = resolveSpecsDir(projectRoot)
  assertRelPath(relPath)
  const target = path.resolve(specsDir, relPath)
  if (!fs.existsSync(target)) {
    throw new LeanspecError('not-found', 'file does not exist')
  }
  const real = fs.realpathSync(target)
  if (!isInside(specsDir, real)) {
    throw new LeanspecError('forbidden', 'path escapes specs directory')
  }
  const stat = fs.statSync(real)
  if (!stat.isFile()) {
    throw new LeanspecError('not-file', 'only files are allowed')
  }
  return real
}

/** Bytes read from the head of a spec README when looking for its status. */
const STATUS_HEAD_BYTES = 2048

/**
 * Read a spec's status from the head of its README.md.
 *
 * Only the first 2KB is read — the status lives in frontmatter or near the top —
 * and every failure (missing README, permissions, a race) degrades to
 * `undefined` so one bad spec can never break the whole tree request.
 */
function readSpecStatus(specDir: string): SpecStatus | undefined {
  const readme = path.join(specDir, 'README.md')
  try {
    const stat = fs.statSync(readme)
    if (!stat.isFile()) return undefined
    const length = Math.min(stat.size, STATUS_HEAD_BYTES)
    if (length === 0) return undefined
    const buffer = Buffer.alloc(length)
    const descriptor = fs.openSync(readme, 'r')
    try {
      const bytesRead = fs.readSync(descriptor, buffer, 0, length, 0)
      return parseSpecStatus(buffer.toString('utf8', 0, bytesRead))
    } finally {
      fs.closeSync(descriptor)
    }
  } catch {
    return undefined
  }
}

/**
 * 列出所有 Spec 目录和文件
 * 返回格式:
 * - dirs: ['001-user-authentication', '002-payment-gateway']
 * - files: ['001-user-authentication/README.md', ...]
 * - statusByDir: { '001-user-authentication': 'complete' }（解析不出的不出现在此表）
 */
export function listSpecs(projectRoot: string | undefined): {
  present: boolean
  specs: string[]  // Spec 目录名 (NNN-name 格式)
  files: string[]  // 所有文件相对路径
  dirs: string[]   // 所有子目录（包括嵌套的）
  statusByDir: Record<string, SpecStatus>  // Spec 目录名 -> 状态
} {
  try {
    const specsDir = resolveSpecsDir(projectRoot)
    const specs: string[] = []
    const files: string[] = []
    const dirs: string[] = []
    const statusByDir: Record<string, SpecStatus> = {}

    // 只遍历第一层，获取所有 Spec 目录
    for (const entry of fs.readdirSync(specsDir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const full = path.join(specsDir, entry.name)
      if (entry.isDirectory()) {
        // 验证是否符合 NNN-name 格式（至少是 XXX-xxx 格式）
        if (/^\d{3,}-/.test(entry.name)) {
          specs.push(entry.name)
          // 递归遍历该 Spec 目录内的文件
          walkSpecDir(full, entry.name, files, dirs)
          const status = readSpecStatus(full)
          if (status !== undefined) statusByDir[entry.name] = status
        }
      }
    }

    return {
      present: true,
      specs: specs.sort((a, b) => a.localeCompare(b)),
      files: files.sort((a, b) => a.localeCompare(b)),
      dirs: dirs.sort((a, b) => a.localeCompare(b)),
      statusByDir,
    }
  } catch (error) {
    if (error instanceof LeanspecError && error.code === 'not-spec') {
      return { present: false, specs: [], files: [], dirs: [], statusByDir: {} }
    }
    throw error
  }
}

function walkSpecDir(dir: string, prefix: string, files: string[], dirs: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      dirs.push(rel)
      walkSpecDir(full, rel, files, dirs)
      continue
    }
    if (entry.isFile()) files.push(rel)
  }
}

/**
 * 读取 Spec 文件内容
 * relPath 示例: '001-user-authentication/README.md'
 */
export function readSpecFile(projectRoot: string | undefined, relPath: string): string {
  const file = resolveExistingFile(projectRoot, relPath)
  return fs.readFileSync(file, 'utf8')
}

/**
 * 以字节读取 Spec 文件（图片等二进制资源）
 *
 * Two guards run *before* the read: the path must resolve to a regular file
 * (`resolveExistingFile` already enforces this, re-checked here so the intent is
 * local), and its size must fit `maxBytes`. A mistaken click on a 2GB file must
 * not be turned into a 2GB buffer, and `statSync` answers that without opening
 * the file at all — which is why oversize is 413 and never a truncated 200.
 */
export function readSpecBinary(
  projectRoot: string | undefined,
  relPath: string,
  maxBytes: number = MAX_IMAGE_BYTES,
): Buffer {
  const file = resolveExistingFile(projectRoot, relPath)
  const stat = fs.statSync(file)
  if (!stat.isFile()) {
    throw new LeanspecError('not-file', 'only files are allowed')
  }
  if (stat.size > maxBytes) {
    throw new LeanspecError('too-large', 'file is too large to serve')
  }
  return fs.readFileSync(file)
}

/**
 * 写入 Spec 文件内容
 * relPath 示例: '001-user-authentication/README.md'
 */
export function writeSpecFile(projectRoot: string | undefined, relPath: string, content: string): void {
  const file = resolveExistingFile(projectRoot, relPath)
  fs.writeFileSync(file, content, 'utf8')
}

/**
 * 创建新的 Spec 目录（仅当目录不存在时）
 * 注意：根据 LeanSpec 规范，应该使用 lean-spec create 命令，
 * 这里仅提供底层目录创建能力供内部使用
 */
export function createSpecDir(projectRoot: string | undefined, specName: string): string {
  const specsDir = resolveSpecsDir(projectRoot)
  
  // 验证 specName 格式：NNN-name
  if (!/^\d{3,}-[a-z0-9]+(-[a-z0-9]+)*$/.test(specName)) {
    throw new LeanspecError('invalid-path', 'spec name must follow NNN-name format (e.g., 001-user-authentication)')
  }

  const specDir = path.join(specsDir, specName)
  if (fs.existsSync(specDir)) {
    throw new LeanspecError('not-found', `spec directory already exists: ${specName}`)
  }

  fs.mkdirSync(specDir, { recursive: true })
  return specDir
}

/**
 * 读取 .lean-spec/config.json 配置
 */
export function readConfig(projectRoot: string | undefined): {
  specsDir: string
  structure: {
    pattern: string
    prefix: string
    sequenceDigits: number
    defaultFile: string
  }
  template: string
  variables: Record<string, string>
} | null {
  const root = resolveProjectRoot(projectRoot)
  if (root === undefined) return null

  const configPath = path.join(root, '.lean-spec', 'config.json')
  if (!fs.existsSync(configPath)) {
    return null
  }

  try {
    const content = fs.readFileSync(configPath, 'utf8')
    return JSON.parse(content)
  } catch {
    return null
  }
}
