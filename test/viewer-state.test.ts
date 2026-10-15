import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  PROJECT_MEMORY_LIMIT,
  hasTreeData,
  initialViewerState,
  needsFileLoad,
  reduceViewer,
  selectView,
  type ViewerState,
} from '../src/client/viewer-state.ts'

test('project without LeanSpec shows a banner and no file tree', () => {
  const state = reduceViewer(initialViewerState, {
    type: 'load-success',
    files: [],
    present: false,
  })
  const view = selectView(state)
  assert.equal(view.showTree, false)
  assert.equal(view.banner, '当前项目没有 LeanSpec (specs/ 目录不存在)')
  assert.equal(state.files.length, 0)
  assert.equal(state.loadStatus, 'ready')
})

test('invalid root load error shows message and no file tree', () => {
  const state = reduceViewer(initialViewerState, {
    type: 'load-error',
    error: 'leanspec not found',
    disconnected: false,
  })
  const view = selectView(state)
  assert.equal(view.showTree, false)
  assert.match(view.banner ?? '', /leanspec not found/)
  assert.equal(state.files.length, 0)
  assert.equal(state.loadStatus, 'error')
})

test('disconnected load does not treat cache as saved content', () => {
  const loaded = reduceViewer(initialViewerState, {
    type: 'load-success',
    files: ['001-user-authentication/README.md'],
  })
  const opened = reduceViewer(
    reduceViewer(loaded, { type: 'select', path: '001-user-authentication/README.md' }),
    { type: 'file-loaded', content: '# Hello' },
  )
  const disconnected = reduceViewer(opened, {
    type: 'load-error',
    error: 'network error',
    disconnected: true,
  })
  const view = selectView(disconnected)
  assert.equal(disconnected.loadStatus, 'disconnected')
  assert.equal(view.showTree, false)
  assert.equal(disconnected.saveStatus, 'idle')
  assert.match(view.banner ?? '', /network error|连接/i)
})

test('save stays in-flight until host confirms', () => {
  let state = reduceViewer(initialViewerState, {
    type: 'load-success',
    files: ['001-user-authentication/README.md'],
  })
  state = reduceViewer(state, { type: 'select', path: '001-user-authentication/README.md' })
  state = reduceViewer(state, { type: 'file-loaded', content: '# Hello' })
  state = reduceViewer(state, { type: 'set-mode', mode: 'edit' })
  state = reduceViewer(state, { type: 'edit', draft: '# Draft' })
  state = reduceViewer(state, { type: 'save-start' })
  assert.equal(state.saving, true)
  assert.equal(state.saveStatus, 'saving')
  assert.equal(selectView(state).saved, false)
  const saved = reduceViewer(state, { type: 'save-success' })
  assert.equal(saved.saving, false)
  assert.equal(saved.saveStatus, 'saved')
  assert.equal(saved.content, '# Draft')
  assert.equal(saved.draft, '# Draft')
  assert.equal(selectView(saved).saved, true)
})

test('save failure keeps the draft and surfaces the error', () => {
  let state = reduceViewer(initialViewerState, {
    type: 'load-success',
    files: ['001-user-authentication/README.md'],
  })
  state = reduceViewer(state, { type: 'select', path: '001-user-authentication/README.md' })
  state = reduceViewer(state, { type: 'file-loaded', content: '# Hello' })
  state = reduceViewer(state, { type: 'set-mode', mode: 'edit' })
  state = reduceViewer(state, { type: 'edit', draft: '# Keep me' })
  state = reduceViewer(state, { type: 'save-start' })
  const failed = reduceViewer(state, { type: 'save-error', error: 'permission denied' })
  assert.equal(failed.draft, '# Keep me')
  assert.equal(failed.content, '# Hello')
  assert.equal(failed.saving, false)
  assert.equal(failed.saveStatus, 'error')
  assert.match(failed.saveError ?? '', /permission denied/)
  assert.equal(selectView(failed).saved, false)
})

test('preview after save uses the saved content', () => {
  let state = reduceViewer(initialViewerState, {
    type: 'load-success',
    files: ['.lean-spec/config.json'],
  })
  state = reduceViewer(state, { type: 'select', path: '.lean-spec/config.json' })
  state = reduceViewer(state, { type: 'file-loaded', content: 'schema: spec-driven' })
  state = reduceViewer(state, { type: 'set-mode', mode: 'edit' })
  state = reduceViewer(state, { type: 'edit', draft: 'schema: custom' })
  state = reduceViewer(state, { type: 'save-success' })
  state = reduceViewer(state, { type: 'set-mode', mode: 'preview' })
  assert.equal(state.mode, 'preview')
  assert.equal(state.content, 'schema: custom')
})

test('the source mode is a first-class view mode', () => {
  let state = reduceViewer(initialViewerState, {
    type: 'load-success',
    files: ['001-alpha/assets/logo.svg'],
    present: true,
  })
  state = reduceViewer(state, { type: 'select', path: '001-alpha/assets/logo.svg' })
  assert.equal(state.mode, 'preview')
  const source = reduceViewer(state, { type: 'set-mode', mode: 'source' })
  assert.equal(source.mode, 'source')
  assert.equal(reduceViewer(source, { type: 'set-mode', mode: 'preview' }).mode, 'preview')
})

test('selecting a file again falls back to the preview mode', () => {
  let state = reduceViewer(initialViewerState, {
    type: 'load-success',
    files: ['001-alpha/README.md', '001-alpha/design.md'],
    present: true,
  })
  state = reduceViewer(state, { type: 'select', path: '001-alpha/README.md' })
  state = reduceViewer(state, { type: 'set-mode', mode: 'edit' })
  assert.equal(state.mode, 'edit')
  const reselected = reduceViewer(state, { type: 'select', path: '001-alpha/design.md' })
  assert.equal(reselected.mode, 'preview')
})

test('the reducer itself refuses to put an image into edit mode', () => {
  let state = reduceViewer(initialViewerState, {
    type: 'load-success',
    files: ['001-alpha/assets/shot.png'],
    present: true,
  })
  state = reduceViewer(state, { type: 'select', path: '001-alpha/assets/shot.png' })
  const refused = reduceViewer(state, { type: 'set-mode', mode: 'edit' })
  assert.equal(refused.mode, 'preview', 'a disabled button is not the only guard')
  assert.equal(refused, state, 'a refused action must not produce a new state')
  // An svg may not be edited either, and the preview/source pair still works.
  const svg = reduceViewer(state, { type: 'select', path: '001-alpha/assets/logo.svg' })
  assert.equal(reduceViewer(svg, { type: 'set-mode', mode: 'edit' }).mode, 'preview')
  assert.equal(reduceViewer(svg, { type: 'set-mode', mode: 'source' }).mode, 'source')
})

test('saving a spec README updates its badge without a reload', () => {
  let state = reduceViewer(initialViewerState, {
    type: 'load-success',
    specs: ['001-alpha'],
    files: ['001-alpha/README.md'],
    statusByDir: { '001-alpha': 'draft' },
    present: true,
  })
  assert.deepEqual(state.statusByDir, { '001-alpha': 'draft' })

  state = reduceViewer(state, { type: 'select', path: '001-alpha/README.md' })
  state = reduceViewer(state, { type: 'file-loaded', content: '---\nstatus: draft\n---\n' })
  state = reduceViewer(state, { type: 'set-mode', mode: 'edit' })
  state = reduceViewer(state, { type: 'edit', draft: '---\nstatus: complete\n---\n' })
  const saved = reduceViewer(reduceViewer(state, { type: 'save-start' }), { type: 'save-success' })

  assert.deepEqual(saved.statusByDir, { '001-alpha': 'complete' })
  // The previous state must not be mutated in place.
  assert.deepEqual(state.statusByDir, { '001-alpha': 'draft' })
})

test('saving away the status line removes the badge', () => {
  let state = reduceViewer(initialViewerState, {
    type: 'load-success',
    files: ['001-alpha/README.md'],
    statusByDir: { '001-alpha': 'complete' },
    present: true,
  })
  state = reduceViewer(state, { type: 'select', path: '001-alpha/README.md' })
  state = reduceViewer(state, { type: 'edit', draft: '# no status any more\n' })
  const saved = reduceViewer(reduceViewer(state, { type: 'save-start' }), { type: 'save-success' })
  assert.deepEqual(saved.statusByDir, {})
})

test('saving a non-README file leaves every badge untouched', () => {
  let state = reduceViewer(initialViewerState, {
    type: 'load-success',
    files: ['001-alpha/design.md'],
    statusByDir: { '001-alpha': 'planned' },
    present: true,
  })
  state = reduceViewer(state, { type: 'select', path: '001-alpha/design.md' })
  state = reduceViewer(state, { type: 'edit', draft: '---\nstatus: archived\n---\n' })
  const saved = reduceViewer(reduceViewer(state, { type: 'save-start' }), { type: 'save-success' })
  assert.deepEqual(saved.statusByDir, { '001-alpha': 'planned' })
})

test('a legacy body status line also drives the badge after a save', () => {
  let state = reduceViewer(initialViewerState, {
    type: 'load-success',
    files: ['001-alpha/README.md'],
    present: true,
  })
  state = reduceViewer(state, { type: 'select', path: '001-alpha/README.md' })
  state = reduceViewer(state, { type: 'edit', draft: '# Legacy\n\n**状态**: complete\n' })
  const saved = reduceViewer(reduceViewer(state, { type: 'save-start' }), { type: 'save-success' })
  assert.deepEqual(saved.statusByDir, { '001-alpha': 'complete' })
})

test('a failed load clears the badge table', () => {
  const loaded = reduceViewer(initialViewerState, {
    type: 'load-success',
    files: ['001-alpha/README.md'],
    statusByDir: { '001-alpha': 'complete' },
    present: true,
  })
  const failed = reduceViewer(loaded, { type: 'load-error', error: 'boom', disconnected: false })
  assert.deepEqual(failed.statusByDir, {})
})

test('loading without a status table yields an empty one', () => {
  const state = reduceViewer(initialViewerState, { type: 'load-success', files: [] })
  assert.deepEqual(state.statusByDir, {})
})

test('toggle-dir opens and closes a directory without touching the old set', () => {
  const start = reduceViewer(initialViewerState, { type: 'toggle-dir', path: '007-spec' })
  assert.deepEqual([...start.expanded], ['007-spec'])
  assert.deepEqual([...initialViewerState.expanded], [], 'the initial set is never mutated in place')
  assert.notEqual(start.expanded, initialViewerState.expanded, 'a fresh Set per toggle')

  const nested = reduceViewer(start, { type: 'toggle-dir', path: '007-spec/docs' })
  assert.deepEqual([...nested.expanded].sort(), ['007-spec', '007-spec/docs'])
  assert.deepEqual([...start.expanded], ['007-spec'], 'the previous state keeps its own set')

  const closed = reduceViewer(nested, { type: 'toggle-dir', path: '007-spec' })
  assert.deepEqual([...closed.expanded], ['007-spec/docs'], 'closing one level keeps the other')
})

test('the expanded set survives every other action (the surface-switch bug)', () => {
  // The popup and the tab render one at a time, so anything the tree keeps in
  // component state is destroyed by a switch. This pins the set in the store:
  // navigating, editing, saving, reloading and re-projecting must not drop it.
  //
  // 2026-10-08 (specs/009 订正): "re-projecting" here means the **same** root
  // being announced again — which is what a remount does, including the
  // `ready` flip. A *different* root is a workspace switch and deliberately
  // starts from that root's own slice (see the specs/009 cases below).
  let state = reduceViewer(initialViewerState, { type: 'set-project', root: '/repo', ready: true })
  state = reduceViewer(state, { type: 'toggle-dir', path: '001-alpha' })
  state = reduceViewer(state, { type: 'toggle-dir', path: '001-alpha/design' })
  for (const action of [
    { type: 'select', path: '001-alpha/design.md' },
    { type: 'file-loaded', content: '# a' },
    { type: 'edit', draft: '# b' },
    { type: 'set-mode', mode: 'edit' },
    { type: 'save-start' },
    { type: 'save-success' },
    { type: 'set-split', split: 300 },
    { type: 'set-surface', surface: 'tab' },
    { type: 'set-popup-open', open: true },
    { type: 'set-project', root: '/repo', ready: true },
    { type: 'set-project', root: '/repo', ready: false },
    { type: 'set-project', root: '/repo', ready: true },
    { type: 'load-start' },
    { type: 'load-success', files: ['001-alpha/design.md'], present: true },
    { type: 'load-error', error: 'boom', disconnected: false },
  ] as const) {
    state = reduceViewer(state, action as never)
    assert.deepEqual(
      [...state.expanded].sort(),
      ['001-alpha', '001-alpha/design'],
      `${action.type} must not clear the tree`,
    )
  }
})

/* -------------------------------------------------------------------------
 * The reload guard (bug 2026-10-08, found while auditing the surface switch).
 *
 * A surface switch unmounts and remounts the viewer, so every effect re-runs.
 * The text pane must therefore know that it already holds the file — otherwise
 * the reload replaces an unsaved draft with the copy on disk (REQ-3.4).
 * ---------------------------------------------------------------------- */

test('the loaded key follows selection, load and failure', () => {
  assert.equal(initialViewerState.loadedKey, null)

  let state = reduceViewer(initialViewerState, { type: 'select', path: 'a.md' })
  assert.equal(state.loadedKey, null, 'a fresh selection has nothing loaded')

  state = reduceViewer(state, { type: 'file-loaded', content: '# a', key: 'a.md\u0000preview' })
  assert.equal(state.loadedKey, 'a.md\u0000preview')

  // Selecting another file forgets the old key, so the new one really loads.
  state = reduceViewer(state, { type: 'select', path: 'b.md' })
  assert.equal(state.loadedKey, null)

  state = reduceViewer(state, { type: 'file-error', error: 'boom', key: 'b.md\u0000preview' })
  assert.equal(state.loadedKey, 'b.md\u0000preview', 'a failure is recorded too, so a remount does not retry it')

  // A key-less action (older call sites, tests) leaves the record alone.
  const carried = reduceViewer(state, { type: 'file-loaded', content: '# b' })
  assert.equal(carried.loadedKey, 'b.md\u0000preview')
})

test('a remount does not reload a file it already holds — the draft survives', () => {
  const key = 'specs/007/design.md\u0000edit'
  let state = reduceViewer(initialViewerState, { type: 'select', path: 'specs/007/design.md' })
  state = reduceViewer(state, { type: 'file-loaded', content: '# design\n', key })
  state = reduceViewer(state, { type: 'edit', draft: '# design\n\nunsaved work\n' })

  // The remount asks again with the same key: nothing to do, so the effect keeps
  // quiet and the draft in the store is never overwritten by the file on disk.
  assert.equal(needsFileLoad(state, key, true), false)

  // Everything that genuinely needs a fetch still gets one.
  assert.equal(needsFileLoad(state, 'specs/007/design.md\u0000preview', true), true, 'a mode change re-reads')
  assert.equal(needsFileLoad(state, 'specs/008/design.md\u0000edit', true), true, 'another file re-reads')
  assert.equal(needsFileLoad({ loadedKey: null }, key, true), true, 'nothing loaded yet')
  assert.equal(needsFileLoad(state, null, true), false, 'no selection, no fetch')
  assert.equal(needsFileLoad(state, key, false), false, 'no project, no fetch')
})

test('needsFileLoad covers the four boundaries (2026-10-08 review)', () => {
  const key = 'specs/007/design.md\u0000edit'
  let state = reduceViewer(initialViewerState, { type: 'set-project', root: '/repo', ready: true })
  state = reduceViewer(state, { type: 'select', path: 'specs/007/design.md' })
  state = reduceViewer(state, { type: 'file-loaded', content: '# design\n', key })
  state = reduceViewer(state, { type: 'edit', draft: '# design\n\nunsaved work\n' })

  // (1) Same path, dirty draft → do NOT fetch: the fetch would overwrite the
  //     draft with the copy on disk (the data-loss bug this guard exists for).
  assert.equal(needsFileLoad(state, key, true), false, 'same path + dirty draft → no fetch')

  // (2) Another path → fetch.
  assert.equal(needsFileLoad(state, 'specs/008/design.md\u0000edit', true), true, 'changed path → fetch')

  // (3) Nothing recorded yet → fetch.
  assert.equal(needsFileLoad({ loadedKey: null }, key, true), true, 'no loadedKey → fetch')

  // (4) After a successful save → do NOT fetch: the disk now holds exactly what
  //     the pane shows, so a reload would only cost a round trip.
  const saved = reduceViewer(reduceViewer(state, { type: 'save-start' }), { type: 'save-success' })
  assert.equal(saved.content, saved.draft, 'the save made the draft the content')
  assert.equal(saved.loadedKey, key, 'a save does not forget what is loaded')
  assert.equal(needsFileLoad(saved, key, true), false, 'after a save → no fetch')
})

/* -------------------------------------------------------------------------
 * Background refresh (2026-10-08 review, T4.2).
 *
 * The `/tree` reload is the only source of freshness, and a surface switch
 * re-runs it. With data already on screen that reload must not blank the tree
 * out for a round trip: it is a background refresh, and only a first load with
 * nothing to show gets the loading state.
 * ---------------------------------------------------------------------- */

test('a refresh over existing data keeps the old tree on screen', () => {
  let state = reduceViewer(initialViewerState, { type: 'set-project', root: '/repo', ready: true })
  state = reduceViewer(state, {
    type: 'load-success',
    specs: ['007-dual-surface-and-draggable-split'],
    files: ['specs/007/design.md'],
    dirs: ['specs/007'],
    present: true,
  })
  assert.equal(selectView(state).refreshing, false)

  // The remount starts the fetch again.
  const loading = reduceViewer(state, { type: 'load-start' })
  const view = selectView(loading)

  assert.equal(view.showTree, true, 'the previous snapshot stays rendered')
  assert.equal(view.refreshing, true, 'and is marked busy, not empty')
  assert.equal(loading.specs.length, 1)
  assert.equal(loading.files.length, 1)
  assert.equal(loading.dirs.length, 1)
  assert.equal(view.banner, undefined, 'a background refresh is not an error state')

  // The new snapshot replaces it when it lands.
  const arrived = reduceViewer(loading, {
    type: 'load-success',
    specs: ['007-dual-surface-and-draggable-split', '008-image-file-preview'],
    files: ['specs/007/design.md'],
    dirs: ['specs/007', 'specs/008'],
    present: true,
  })
  assert.equal(selectView(arrived).refreshing, false)
  assert.equal(selectView(arrived).showTree, true)
})

test('a first load with nothing to show still gets the loading state', () => {
  const fresh = reduceViewer(
    reduceViewer(initialViewerState, { type: 'set-project', root: '/repo', ready: true }),
    { type: 'load-start' },
  )
  const view = selectView(fresh)

  assert.equal(view.showTree, false, 'no stale tree to stand in for the fetch')
  assert.equal(view.refreshing, false)
  assert.equal(hasTreeData(fresh), false)

  // A project whose last load failed has no tree either: the error banner owns
  // the pane and `hasTreeData` stays false, so nothing pretends to be fresh.
  const failed = reduceViewer(fresh, { type: 'load-error', error: 'boom' })
  assert.equal(selectView(failed).showTree, false)
  assert.equal(hasTreeData(failed), false)
  assert.equal(selectView(failed).banner, 'boom')
})

/* -------------------------------------------------------------------------
 * Workspace switches (specs/009, bug 2026-10-08).
 *
 * The store is module-level on purpose (007: popup and tab are one panel), and
 * that is exactly why a root change must be handled explicitly: without it, root
 * A's file kept rendering — and could have been saved — under root B.
 * ---------------------------------------------------------------------- */

/** Root A with a file open, an unsaved draft, an expanded dir and a badge. */
function openInRootA(): ViewerState {
  const key = '001-alpha/README.md\u0000edit'
  let state = reduceViewer(initialViewerState, { type: 'set-project', root: '/repo-a', ready: true })
  state = reduceViewer(state, { type: 'load-start' })
  state = reduceViewer(state, {
    type: 'load-success',
    specs: ['001-alpha'],
    files: ['001-alpha/README.md'],
    dirs: ['001-alpha'],
    present: true,
    statusByDir: { '001-alpha': 'in-progress' },
  })
  state = reduceViewer(state, { type: 'toggle-dir', path: '001-alpha' })
  state = reduceViewer(state, { type: 'select', path: '001-alpha/README.md' })
  state = reduceViewer(state, { type: 'file-loaded', content: '# alpha\n', key })
  return reduceViewer(state, { type: 'edit', draft: '# alpha\n\nunsaved\n' })
}

test('a workspace switch never carries the old root into the new preview (A1/A2/A5/A6)', () => {
  const a = openInRootA()
  assert.equal(a.selected, '001-alpha/README.md', 'precondition: A has a file open')
  assert.equal(a.draft, '# alpha\n\nunsaved\n')

  const b = reduceViewer(a, { type: 'set-project', root: '/repo-b', ready: true })

  assert.equal(b.projectRoot, '/repo-b')
  assert.equal(b.selected, null, 'A1: no stale selection under B')
  assert.equal(b.content, '', 'A1: no stale content under B')
  assert.equal(b.draft, '', 'A1: the draft does not leak either')
  assert.equal(b.loadedKey, null, 'A1: nothing is "already loaded" under B')
  assert.deepEqual(b.specs, [], "A2: A's spec list is not B's")
  assert.deepEqual(b.files, [])
  assert.deepEqual(b.dirs, [])
  assert.deepEqual(b.statusByDir, {})
  assert.equal(b.present, false)
  assert.equal(b.loadStatus, 'idle', 'B starts from scratch and fetches its own tree')
  assert.deepEqual([...b.expanded], [], 'A2: the expansion belongs to A')

  // A5: the old key is no longer "loaded", so the file effect re-fetches.
  assert.equal(needsFileLoad(b, '001-alpha/README.md\u0000edit', true), true)
  // A6: no selection under B ⇒ the save entry (`textKey === null`) is unreachable.
  assert.equal(b.selected, null)
})

test('returning to a root restores its selection, draft and expansion (A3)', () => {
  const a = openInRootA()
  const b = reduceViewer(a, { type: 'set-project', root: '/repo-b', ready: true })
  const back = reduceViewer(b, { type: 'set-project', root: '/repo-a', ready: true })

  assert.equal(back.selected, '001-alpha/README.md', 'A3: the selection comes back')
  assert.equal(back.content, '# alpha\n', 'A3: the loaded content comes back without a re-fetch')
  assert.equal(back.draft, '# alpha\n\nunsaved\n', 'A3: the unsaved draft is not lost')
  assert.equal(back.loadedKey, '001-alpha/README.md\u0000edit')
  assert.deepEqual([...back.expanded], ['001-alpha'])
  assert.deepEqual(back.statusByDir, { '001-alpha': 'in-progress' })
  assert.equal(back.present, true)
  assert.equal(back.saveStatus, 'idle', 'A3: a switch ends the save chip, never a stuck "saving"')
  assert.equal(back.saving, false)
})

test('the same root only moves readiness — never a wipe (A4)', () => {
  const a = openInRootA()
  const same = reduceViewer(a, { type: 'set-project', root: '/repo-a', ready: true })
  assert.equal(Object.is(same, a), true, 'same root + same ready → the very same object')

  const flapped = reduceViewer(a, { type: 'set-project', root: '/repo-a', ready: false })
  assert.equal(Object.is(flapped, a), false, 'readiness moved, so a new object')
  assert.equal(flapped.projectRoot, '/repo-a')
  assert.equal(flapped.selected, a.selected, 'A4: a readiness flip never drops the selection')
  assert.equal(flapped.draft, a.draft, 'A4: …nor the draft')
  assert.equal(flapped.loadedKey, a.loadedKey)
})

test('UI preferences survive a workspace switch (A7)', () => {
  let state = openInRootA()
  state = reduceViewer(state, { type: 'set-split', split: 372 })
  state = reduceViewer(state, { type: 'set-popup-open', open: true })
  state = reduceViewer(state, { type: 'set-pinned', pinned: true })
  state = reduceViewer(state, { type: 'set-dragging', dragging: true })

  const b = reduceViewer(state, { type: 'set-project', root: '/repo-b', ready: true })

  assert.equal(b.split, 372, 'A7: the split is a panel preference, not project data')
  assert.equal(b.surface, 'popup')
  assert.equal(b.popupOpen, true)
  assert.equal(b.pinned, true)
  assert.equal(b.dragging, true)
})

test('the per-root memory is bounded and never evicts the root being restored (A8)', () => {
  let state = openInRootA()
  // Fill exactly to the limit: A plus LIMIT-1 more roots.
  for (let i = 0; i < PROJECT_MEMORY_LIMIT; i += 1) {
    state = reduceViewer(state, { type: 'set-project', root: `/repo-${i}`, ready: true })
  }
  assert.equal(Object.keys(state.projects).length, PROJECT_MEMORY_LIMIT, 'A8: bounded at the limit')

  // Parking the current root inserts one more entry; A must survive it.
  const back = reduceViewer(state, { type: 'set-project', root: '/repo-a', ready: true })
  assert.equal(back.selected, '001-alpha/README.md', 'A8: A survived a full memory')
  assert.equal(Object.keys(back.projects).length <= PROJECT_MEMORY_LIMIT, true, 'A8: still bounded')
  assert.equal('/repo-a' in back.projects, true, 'A8: the restored root is never the evicted one')

  // And a second round trip still restores A.
  const away = reduceViewer(back, { type: 'set-project', root: '/repo-x', ready: true })
  const again = reduceViewer(away, { type: 'set-project', root: '/repo-a', ready: true })
  assert.equal(again.selected, '001-alpha/README.md', 'A8: A is remembered round after round')
})

test('an unresolved root (empty string) is never parked, and A survives it (A9)', () => {
  const a = openInRootA()
  const unresolved = reduceViewer(a, { type: 'set-project', root: '', ready: false })

  assert.equal(unresolved.projectRoot, '', 'the panel follows the unresolved root')
  assert.equal(unresolved.selected, null, 'and shows nothing from A while unresolved')
  assert.equal(Object.keys(unresolved.projects).length, 1, "A's slice was parked on the way out")
  assert.equal('' in unresolved.projects, false, 'A9: the empty root never becomes an entry')

  const again = reduceViewer(unresolved, { type: 'set-project', root: '', ready: false })
  assert.equal(Object.is(again, unresolved), true, 'A9: a repeated announcement is a no-op')

  // A transient `A → '' → A` must not cost the user their place.
  const back = reduceViewer(again, { type: 'set-project', root: '/repo-a', ready: true })
  assert.equal(back.selected, '001-alpha/README.md', 'A9: A comes back from an unresolved blip')
  assert.equal(back.draft, '# alpha\n\nunsaved\n')
})
