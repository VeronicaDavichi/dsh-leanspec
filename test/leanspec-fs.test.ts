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
  readSpecFile,
  resolveExistingFile,
  resolveSpecsDir,
  writeSpecFile,
} from '../src/leanspec-fs.ts'

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
  assert.deepEqual(listSpecs(''), { present: false, specs: [], files: [], dirs: [] })
  assert.deepEqual(listSpecs(undefined), { present: false, specs: [], files: [], dirs: [] })
})

test('missing specs directory means LeanSpec is absent', () => {
  const root = tmpRoot()
  assert.throws(() => resolveSpecsDir(root), (err: unknown) => {
    return err instanceof LeanspecError && (err as LeanspecError).code === 'not-spec'
  })
  assert.deepEqual(listSpecs(root), { present: false, specs: [], files: [], dirs: [] })
})

test('specs directory without any specs is still present', () => {
  const root = tmpRoot()
  fs.mkdirSync(path.join(root, 'specs'))
  const listed = listSpecs(root)
  assert.equal(listed.present, true)
  assert.deepEqual(listed.specs, [])
  assert.deepEqual(listed.files, [])
  assert.deepEqual(listed.dirs, [])
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
