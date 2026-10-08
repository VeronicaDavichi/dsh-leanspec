import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  SPEC_STATUSES,
  SPEC_STATUS_LABELS,
  normalizeStatus,
  parseSpecStatus,
} from '../src/spec-status.ts'

test('every status in the vocabulary has a badge label', () => {
  assert.deepEqual([...SPEC_STATUSES], ['draft', 'planned', 'in-progress', 'complete', 'archived'])
  for (const status of SPEC_STATUSES) {
    assert.equal(typeof SPEC_STATUS_LABELS[status], 'string')
    assert.ok(SPEC_STATUS_LABELS[status].length > 0)
  }
  assert.deepEqual(SPEC_STATUS_LABELS, {
    draft: 'draft',
    planned: 'plan.',
    'in-progress': 'WIP',
    complete: 'done',
    archived: 'arch.',
  })
})

test('empty and non-string input yield no status', () => {
  assert.equal(parseSpecStatus(''), undefined)
  assert.equal(parseSpecStatus('# Just a heading\n'), undefined)
  assert.equal(normalizeStatus(undefined as unknown as string), undefined)
})

test('body status line is read when frontmatter is absent', () => {
  assert.equal(parseSpecStatus('# Demo\n\n**状态**: complete\n'), 'complete')
})

test('body status accepts a full-width colon', () => {
  assert.equal(parseSpecStatus('# Demo\n\n**状态**：complete\n'), 'complete')
})

test('frontmatter status is read on its own', () => {
  assert.equal(parseSpecStatus('---\nstatus: in-progress\n---\n\n# Demo\n'), 'in-progress')
})

test('frontmatter wins over the body line', () => {
  const markdown = '---\nstatus: in-progress\n---\n\n**状态**: draft\n'
  assert.equal(parseSpecStatus(markdown), 'in-progress')
})

test('an unusable frontmatter value falls through to the body line', () => {
  const markdown = '---\nstatus: nonsense\n---\n\n**状态**: draft\n'
  assert.equal(parseSpecStatus(markdown), 'draft')
})

test('an unusable status with no body line yields nothing', () => {
  assert.equal(parseSpecStatus('---\nstatus: nonsense\n---\n\n# Demo\n'), undefined)
  assert.equal(parseSpecStatus('---\npriority: high\n---\n\n# Demo\n'), undefined)
})

test('quoted, padded and spaced frontmatter values are tolerated', () => {
  assert.equal(parseSpecStatus('---\nstatus: "draft"\n---\n'), 'draft')
  assert.equal(parseSpecStatus("---\nstatus: 'archived'\n---\n"), 'archived')
  assert.equal(parseSpecStatus('---\n  status  :   WIP   \n---\n'), 'in-progress')
  assert.equal(parseSpecStatus('---\nstatus: in progress\n---\n'), 'in-progress')
})

test('CRLF and a UTF-8 BOM do not break frontmatter parsing', () => {
  assert.equal(parseSpecStatus('---\r\nstatus: complete\r\n---\r\n\r\n# Demo\r\n'), 'complete')
  assert.equal(parseSpecStatus('\uFEFF---\nstatus: planned\n---\n'), 'planned')
})

test('documented aliases map onto the vocabulary', () => {
  assert.equal(normalizeStatus('wip'), 'in-progress')
  assert.equal(normalizeStatus('done'), 'complete')
  assert.equal(normalizeStatus('arch'), 'archived')
  assert.equal(normalizeStatus('archive'), 'archived')
  assert.equal(normalizeStatus('DONE'), 'complete')
  assert.equal(normalizeStatus('Archived'), 'archived')
})

test('unknown values never leak through', () => {
  assert.equal(normalizeStatus('foo'), undefined)
  assert.equal(normalizeStatus(''), undefined)
  assert.equal(normalizeStatus('   '), undefined)
  assert.equal(normalizeStatus('<>'), undefined)
  assert.equal(parseSpecStatus('---\nstatus: <script>alert(1)</script>\n---\n'), undefined)
})

test('trailing annotations after a valid token are tolerated', () => {
  assert.equal(parseSpecStatus('**状态**: complete（2026-09-17）\n'), 'complete')
  assert.equal(parseSpecStatus('**状态**: arch.\n'), 'archived')
  assert.equal(parseSpecStatus('---\nstatus: draft # 草稿\n---\n'), 'draft')
})

test('a long status-free document reports no status', () => {
  const padding = Array.from({ length: 400 }, (_, i) => `Line ${i} of prose.`).join('\n')
  assert.equal(parseSpecStatus(`# Demo\n\n${padding}\n`), undefined)
})

test('the repository spec 001 style README parses through the body fallback', () => {
  const legacy = [
    '# Markdown Table Rendering Fix',
    '',
    '**类型**: 缺陷修复',
    '**状态**: complete',
    '**完成日期**: 2026-09-17',
    '',
  ].join('\n')
  assert.equal(parseSpecStatus(legacy), 'complete')
})
