import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

/**
 * The release contract for the published package. These assertions encode the
 * packaging fixes made for the 0.2.0 npm release; they are not runtime tests.
 *
 * `dsh.client.inject` names the host UI packages whose seats this plugin fills.
 * In DeepSeek Harness 0.2.2-rc.1 the conversation package registers the
 * `conversation.session.header` group (including the `utilities` seat next to
 * Session log), and sidebar-right owns the optional `sidebar.right.pane.tab`
 * seats. The old `@deepseek-ai/dsh-client-runtime` value is not a package in
 * that release, so the browser graph simply skipped the edge.
 */
const root = new URL('../', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')) as {
  dsh?: { client?: { platform?: string; inject?: string[] } }
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  publishConfig?: { access?: string }
  files?: string[]
}

test('the Web client injects the host UI packages that own its seats', () => {
  assert.equal(manifest.dsh?.client?.platform, 'web')
  assert.deepEqual(manifest.dsh?.client?.inject, [
    '@deepseek-ai/dsh-client-ui-conversation',
    '@deepseek-ai/dsh-client-ui-sidebar-right',
  ])
})

test('marked is a build-time dependency, not a runtime one', () => {
  assert.equal(manifest.dependencies?.marked, undefined)
  assert.match(manifest.devDependencies?.marked ?? '', /^\^18\./)
})

test('the package is published publicly and ships only runtime files', () => {
  assert.equal(manifest.publishConfig?.access, 'public')
  assert.deepEqual(manifest.files, [
    'lib/index.js',
    'lib/client.js',
    'cordis.patch.yml',
    'README.md',
    'LICENSE',
  ])
})

test('pnpm is the only lockfile in the repository', () => {
  assert.equal(existsSync(new URL('package-lock.json', root)), false)
  assert.equal(existsSync(new URL('pnpm-lock.yaml', root)), true)
})
