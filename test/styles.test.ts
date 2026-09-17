import assert from 'node:assert/strict'
import { test } from 'node:test'
import { LEANSPEC_STYLES } from '../src/client/styles.ts'

test('viewer styles use Harness theme aliases instead of hardcoded palette', () => {
  for (const token of [
    '--dsw-alias-bg-layer-2',
    '--dsw-alias-label-primary',
    '--dsw-alias-border-l2',
    '--dsw-alias-interactive-bg-hover',
    '--dsw-specific-sidebar-fill',
    '--dsw-alias-state-business-primary',
    '--dsw-alias-markdown-code-block',
    '--dsw-font-family',
  ]) {
    assert.match(LEANSPEC_STYLES, new RegExp(token.replaceAll('-', '\\-')))
  }
  assert.doesNotMatch(LEANSPEC_STYLES, /#[0-9a-fA-F]{3,8}/)
})

test('file path sits below the toolbar instead of sharing the button row', () => {
  assert.match(LEANSPEC_STYLES, /\.dsh-leanspec-chrome \{[\s\S]*flex-direction: column/)
  assert.match(LEANSPEC_STYLES, /\.dsh-leanspec-path \{[\s\S]*display: block/)
  assert.match(LEANSPEC_STYLES, /\.dsh-leanspec-path \{[\s\S]*text-align: left/)
  assert.doesNotMatch(LEANSPEC_STYLES, /\.dsh-leanspec-path \{[\s\S]*margin-left: auto/)
})
