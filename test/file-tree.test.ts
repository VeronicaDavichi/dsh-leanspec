import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildFileTree } from '../src/client/file-tree.ts'

test('builds a nested tree from LeanSpec paths', () => {
  const tree = buildFileTree([
    '001-user-authentication/README.md',
    '001-user-authentication/docs/design.md',
    '002-payment-gateway/README.md',
  ], [
    '001-user-authentication/docs',
  ])
  assert.deepEqual(tree, [
    {
      name: '001-user-authentication',
      path: '001-user-authentication',
      kind: 'dir',
      children: [
        {
          name: 'docs',
          path: '001-user-authentication/docs',
          kind: 'dir',
          children: [
            { name: 'design.md', path: '001-user-authentication/docs/design.md', kind: 'file' },
          ],
        },
        { name: 'README.md', path: '001-user-authentication/README.md', kind: 'file' },
      ],
    },
    {
      name: '002-payment-gateway',
      path: '002-payment-gateway',
      kind: 'dir',
      children: [
        { name: 'README.md', path: '002-payment-gateway/README.md', kind: 'file' },
      ],
    },
  ])
})

test('keeps empty directories', () => {
  const tree = buildFileTree(['001-test/README.md'], ['001-test'])
  assert.deepEqual(tree, [
    { name: '001-test', path: '001-test', kind: 'dir', children: [{ name: 'README.md', path: '001-test/README.md', kind: 'file' }] },
  ])
})
