import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, test } from 'node:test'
import {
  LeanspecError,
  createSpecDir,
  listSpecs,
  readConfig,
  readSpecBinary,
  readSpecFile,
  resolveExistingFile,
  resolveSpecsDir,
  writeSpecFile,
} from '../src/leanspec-fs.ts'

/**
 * A real 1x1 PNG, built at run time — no binary fixture is committed. The magic
 * bytes are asserted below, so the round-trip test cannot silently degrade into
 * comparing random bytes against themselves.
 */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
)

function seedPng(root: string, relPath: string): { full: string; bytes: Buffer } {
  const full = path.join(root, 'specs', relPath)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, TINY_PNG)
  return { full, bytes: fs.readFileSync(full) }
}

const fixtures: string[] = []

function tmpRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-leanspec-'))
  fixtures.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of fixtures.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

function seedProject(options?: { withConfig?: boolean; extraSpecs?: boolean }): string {
  const root = tmpRoot()
  const specs = path.join(root, 'specs')
  
  // Create basic spec directories (NNN-name format)
  fs.mkdirSync(path.join(specs, '001-user-authentication'), { recursive: true })
  fs.mkdirSync(path.join(specs, '002-payment-gateway'), { recursive: true })
  
  // Write README.md files for each spec
  fs.writeFileSync(path.join(specs, '001-user-authentication', 'README.md'), '# User Authentication\n\n## Problem\n')
  fs.writeFileSync(path.join(specs, '002-payment-gateway', 'README.md'), '# Payment Gateway\n\n## Problem\n')
  
  // Add nested files
  fs.mkdirSync(path.join(specs, '001-user-authentication', 'docs'), { recursive: true })
  fs.writeFileSync(path.join(specs, '001-user-authentication', 'docs', 'design.md'), '# Design\n')
  
  if (options?.withConfig) {
    fs.mkdirSync(path.join(root, '.lean-spec'), { recursive: true })
    fs.writeFileSync(
      path.join(root, '.lean-spec', 'config.json'),
      JSON.stringify({
        specsDir: 'specs',
        structure: {
          pattern: 'flat',
          prefix: '',
          sequenceDigits: 3,
          defaultFile: 'README.md',
        },
        template: 'spec-template.md',
        variables: {},
      }, null, 2),
    )
  }
  
  if (options?.extraSpecs) {
    fs.mkdirSync(path.join(specs, '003-notifications'), { recursive: true })
    fs.writeFileSync(path.join(specs, '003-notifications', 'README.md'), '# Notifications\n')
  }
  
  return root
}

test('empty project root means LeanSpec is absent', () => {
  assert.throws(() => resolveSpecsDir(''), (err: unknown) => {
    return err instanceof LeanspecError && err.code === 'not-spec'
  })
  assert.deepEqual(listSpecs(''), { present: false, specs: [], files: [], dirs: [], statusByDir: {} })
  assert.deepEqual(listSpecs(undefined), { present: false, specs: [], files: [], dirs: [], statusByDir: {} })
})

test('missing specs directory means LeanSpec is absent', () => {
  const root = tmpRoot()
  assert.throws(() => resolveSpecsDir(root), (err: unknown) => {
    return err instanceof LeanspecError && (err as LeanspecError).code === 'not-spec'
  })
  assert.deepEqual(listSpecs(root), { present: false, specs: [], files: [], dirs: [], statusByDir: {} })
})

test('specs directory without any specs is still present', () => {
  const root = tmpRoot()
  fs.mkdirSync(path.join(root, 'specs'))
  const listed = listSpecs(root)
  assert.equal(listed.present, true)
  assert.deepEqual(listed.specs, [])
  assert.deepEqual(listed.files, [])
  assert.deepEqual(listed.dirs, [])
  assert.deepEqual(listed.statusByDir, {})
})

test('lists all spec directories in NNN-name format', () => {
  const root = seedProject()
  const listed = listSpecs(root)
  assert.equal(listed.present, true)
  assert.deepEqual(listed.specs.sort(), [
    '001-user-authentication',
    '002-payment-gateway',
  ])
})

test('lists all files including nested ones', () => {
  const root = seedProject()
  const listed = listSpecs(root)
  assert.equal(listed.present, true)
  assert.deepEqual(listed.files.sort(), [
    '001-user-authentication/README.md',
    '001-user-authentication/docs/design.md',
    '002-payment-gateway/README.md',
  ])
})

test('lists nested directories', () => {
  const root = seedProject()
  const listed = listSpecs(root)
  assert.equal(listed.present, true)
  assert.deepEqual(listed.dirs, ['001-user-authentication/docs'])
})

test('ignores directories that do not match NNN-name pattern', () => {
  const root = tmpRoot()
  const specs = path.join(root, 'specs')
  fs.mkdirSync(specs, { recursive: true })
  fs.mkdirSync(path.join(specs, 'invalid-name'))  // Missing leading digits
  fs.mkdirSync(path.join(specs, '001-valid'))
  fs.writeFileSync(path.join(specs, '001-valid', 'README.md'), '# Valid\n')
  
  const listed = listSpecs(root)
  assert.equal(listed.present, true)
  assert.deepEqual(listed.specs, ['001-valid'])
})

test('relative project root is rejected', () => {
  assert.throws(() => resolveSpecsDir('specs'), (err: unknown) => {
    return err instanceof LeanspecError && err.code === 'invalid-path'
  })
})

test('rejects path traversal', () => {
  const root = seedProject()
  assert.throws(
    () => resolveExistingFile(root, '../secret.md'),
    (err: unknown) => err instanceof LeanspecError && err.code === 'invalid-path',
  )
  assert.throws(
    () => resolveExistingFile(root, '001-user-authentication/../../package.json'),
    (err: unknown) => err instanceof LeanspecError && err.code === 'invalid-path',
  )
})

test('reads and writes spec files', () => {
  const root = seedProject()
  assert.equal(
    readSpecFile(root, '001-user-authentication/README.md').includes('# User Authentication'),
    true,
  )
  writeSpecFile(root, '001-user-authentication/README.md', '# Updated\n')
  assert.equal(readSpecFile(root, '001-user-authentication/README.md'), '# Updated\n')
})

test('rejects missing files and does not create them', () => {
  const root = seedProject()
  assert.throws(
    () => resolveExistingFile(root, '001-user-authentication/missing.md'),
    (err: unknown) => err instanceof LeanspecError && err.code === 'not-found',
  )
  assert.throws(
    () => writeSpecFile(root, '001-user-authentication/missing.md', 'nope'),
    (err: unknown) => err instanceof LeanspecError && err.code === 'not-found',
  )
})

test('readSpecBinary returns the exact bytes of a real png', () => {
  const root = seedProject()
  const { bytes } = seedPng(root, '001-user-authentication/assets/tiny.png')
  assert.deepEqual(bytes.subarray(0, 8), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))

  const read = readSpecBinary(root, '001-user-authentication/assets/tiny.png')
  assert.equal(Buffer.isBuffer(read), true)
  assert.equal(read.equals(bytes), true, 'bytes must round-trip unchanged')
  assert.equal(read.length, TINY_PNG.length)
})

test('readSpecBinary refuses an oversize file before reading it', () => {
  const root = seedProject()
  const { full } = seedPng(root, '001-user-authentication/assets/tiny.png')

  // Explicit budget, small enough that the test never writes 20MB.
  assert.throws(
    () => readSpecBinary(root, '001-user-authentication/assets/tiny.png', 4),
    (err: unknown) => err instanceof LeanspecError && err.code === 'too-large',
  )

  // The default budget is the shared 20MB constant; the file only has to be
  // *statted* as larger than it, so a sparse file keeps the fixture tiny.
  fs.truncateSync(full, 20 * 1024 * 1024 + 1)
  assert.throws(
    () => readSpecBinary(root, '001-user-authentication/assets/tiny.png'),
    (err: unknown) => err instanceof LeanspecError && err.code === 'too-large',
  )
})

test('readSpecBinary refuses a directory even though it exists', () => {
  const root = seedProject()
  assert.throws(
    () => readSpecBinary(root, '001-user-authentication/docs'),
    (err: unknown) => err instanceof LeanspecError && err.code === 'not-file',
  )
})

test('creates new spec directory with valid NNN-name format', () => {
  const root = tmpRoot()
  fs.mkdirSync(path.join(root, 'specs'), { recursive: true })
  
  const specDir = createSpecDir(root, '003-new-feature')
  // 检查路径包含 specs 和 003-new-feature（Windows 路径分隔符是 \）
  assert.ok(specDir.includes('specs') && specDir.includes('003-new-feature'))
  assert.ok(fs.existsSync(specDir))
  assert.ok(fs.statSync(specDir).isDirectory())
})

test('rejects invalid spec name format', () => {
  const root = tmpRoot()
  fs.mkdirSync(path.join(root, 'specs'), { recursive: true })
  
  assert.throws(
    () => createSpecDir(root, 'invalid-name'),
    (err: unknown) => err instanceof LeanspecError && err.code === 'invalid-path',
  )
  assert.throws(
    () => createSpecDir(root, '01_invalid'),
    (err: unknown) => err instanceof LeanspecError && err.code === 'invalid-path',
  )
})

test('rejects duplicate spec directory creation', () => {
  const root = seedProject()
  
  assert.throws(
    () => createSpecDir(root, '001-user-authentication'),
    (err: unknown) => err instanceof LeanspecError && err.code === 'not-found',
  )
})

test('reads LeanSpec config when present', () => {
  const root = seedProject({ withConfig: true })
  const config = readConfig(root)
  assert.ok(config !== null)
  assert.equal(config?.specsDir, 'specs')
  assert.equal(config?.structure.sequenceDigits, 3)
  assert.equal(config?.structure.defaultFile, 'README.md')
})

test('returns null when config is missing', () => {
  const root = seedProject()
  const config = readConfig(root)
  assert.equal(config, null)
})

test('returns null when config is invalid JSON', () => {
  const root = tmpRoot()
  fs.mkdirSync(path.join(root, '.lean-spec'), { recursive: true })
  fs.writeFileSync(path.join(root, '.lean-spec', 'config.json'), 'invalid json')
  
  const config = readConfig(root)
  assert.equal(config, null)
})

test('reads a spec status from frontmatter', () => {
  const root = tmpRoot()
  const specs = path.join(root, 'specs')
  fs.mkdirSync(path.join(specs, '001-frontmatter'), { recursive: true })
  fs.writeFileSync(path.join(specs, '001-frontmatter', 'README.md'), '---\nstatus: in-progress\n---\n\n# Demo\n')
  assert.deepEqual(listSpecs(root).statusByDir, { '001-frontmatter': 'in-progress' })
})

test('falls back to the body 状态 line for legacy specs', () => {
  const root = tmpRoot()
  const specs = path.join(root, 'specs')
  fs.mkdirSync(path.join(specs, '001-legacy'), { recursive: true })
  fs.writeFileSync(path.join(specs, '001-legacy', 'README.md'), '# Legacy\n\n**状态**: complete\n')
  assert.deepEqual(listSpecs(root).statusByDir, { '001-legacy': 'complete' })
})

test('omits specs whose README has no usable status', () => {
  const root = seedProject()
  assert.deepEqual(listSpecs(root).statusByDir, {})
})

test('omits a spec without README.md instead of failing the listing', () => {
  const root = tmpRoot()
  const specs = path.join(root, 'specs')
  fs.mkdirSync(path.join(specs, '001-no-readme'), { recursive: true })
  fs.writeFileSync(path.join(specs, '001-no-readme', 'design.md'), '# Design\n')

  const listed = listSpecs(root)
  assert.equal(listed.present, true)
  assert.deepEqual(listed.specs, ['001-no-readme'])
  assert.deepEqual(listed.statusByDir, {})
})

test('reads frontmatter even when the README is far larger than the 2KB head', () => {
  const root = tmpRoot()
  const specs = path.join(root, 'specs')
  fs.mkdirSync(path.join(specs, '001-big'), { recursive: true })
  const padding = Array.from({ length: 2000 }, (_, i) => `Line ${i} of prose.`).join('\n')
  fs.writeFileSync(path.join(specs, '001-big', 'README.md'), `---\nstatus: archived\n---\n\n${padding}\n`)
  // Only the head is read, so the body padding never enters the picture.
  assert.deepEqual(listSpecs(root).statusByDir, { '001-big': 'archived' })
})

test('maps several specs at once and leaves unparseable ones out', () => {
  const root = tmpRoot()
  const specs = path.join(root, 'specs')
  const cases: Array<[string, string]> = [
    ['001-a', '---\nstatus: draft\n---\n'],
    ['002-b', '---\nstatus: complete\n---\n'],
    ['003-c', '# no status here\n'],
  ]
  for (const [name, body] of cases) {
    fs.mkdirSync(path.join(specs, name), { recursive: true })
    fs.writeFileSync(path.join(specs, name, 'README.md'), body)
  }
  assert.deepEqual(listSpecs(root).statusByDir, { '001-a': 'draft', '002-b': 'complete' })
})
