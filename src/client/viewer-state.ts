import { isImagePath } from '../media.ts'
import { parseSpecStatus, type SpecStatus } from '../spec-status.ts'
import { SPLIT_DEFAULT } from './surface.ts'
import type { Surface } from './tab-surface.ts'

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error' | 'disconnected'
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
export type ViewMode = 'preview' | 'edit' | 'source'

/**
 * Everything the panel holds about **one project root**.
 *
 * Parked in {@link ViewerState.projects} when the workspace changes, so that
 * (a) the next root can never render the previous root's file, and (b) coming
 * back restores the selection, the expansion and an unsaved draft instead of
 * silently dropping them (bug 2026-10-08 → specs/009).
 */
export interface ProjectSlice {
  loadStatus: LoadStatus
  loadError: string | undefined
  present: boolean
  specs: string[]
  files: string[]
  dirs: string[]
  expanded: Set<string>
  statusByDir: Record<string, SpecStatus>
  selected: string | null
  mode: ViewMode
  content: string
  draft: string
  loadedKey: string | null
  saving: boolean
  saveStatus: SaveStatus
  saveError: string | undefined
}

export interface ViewerState {
  loadStatus: LoadStatus
  loadError?: string
  present: boolean
  specs: string[]  // LeanSpec 目录列表 (NNN-name 格式)
  files: string[]
  dirs: string[]
  /**
   * Expanded directory paths in the file tree.
   *
   * Session state, not component state (bug fixed in this revision): the popup
   * and the tab render one at a time, so a `useState` here was destroyed on
   * every surface switch and the tree came back fully collapsed.
   */
  expanded: Set<string>
  /** spec 目录名 -> 状态；解析不出的目录不出现在此表 */
  statusByDir: Record<string, SpecStatus>
  selected: string | null
  mode: ViewMode
  content: string
  draft: string
  saving: boolean
  saveStatus: SaveStatus
  saveError?: string
  /**
   * File-tree width in px.
   *
   * Shared state on purpose: the popup and the right-sidebar tab must not
   * disagree about it (design.md §3), and a surface switch keeps it (REQ-3.4).
   */
  split: number
  /**
   * Which surface owns the panel right now.
   *
   * Single source of truth for mutual exclusion (REQ-3.3 / T2.5): the popover
   * renders only while this is 'popup', and a tab that is still mounted but no
   * longer owns the panel shows its notice instead of duplicating the viewer.
   */
  surface: Surface
  /**
   * Which `path\0mode` key the current `content`/`draft` came from.
   *
   * A surface switch unmounts and remounts the viewer, which re-runs every
   * effect. Without this, the reload would fetch the file again and overwrite an
   * unsaved draft with the copy on disk — the same class of bug as the collapsed
   * tree (`expanded`), and the reason {@link needsFileLoad} exists.
   */
  loadedKey: string | null
  /** Whether the header popover is showing, mirrored so the tab can reopen it. */
  popupOpen: boolean
  /**
   * Whether the user's manual surface choice must survive a viewport change.
   *
   * Set only by the in-popup 「在右栏打开」 button (`switchToTab({ pin: true })`),
   * cleared whenever the panel is opened or closed (REQ-1.7, T3.2) — a pin
   * belongs to one panel session. The tab body mounting does **not** clear it:
   * mounting is the host's doing, not a user move.
   */
  pinned: boolean
  /**
   * Whether the splitter is being dragged right now.
   *
   * Session state for the same reason as {@link expanded}, and the guard the
   * surface follow reads: switching surfaces mid-drag would unmount the pane and
   * break the pointer capture (REQ-1.5).
   */
  dragging: boolean
  /**
   * Project root resolved by the session header. Both surfaces read it from the
   * store, so the tab does not need the session identity to load a tree.
   */
  projectRoot: string
  projectReady: boolean
  /**
   * Selection/draft memory per project root, most recently used last.
   *
   * A workspace switch is not a panel close: the user's place in root A must
   * survive a detour through root B (bug 2026-10-08 → specs/009). Bounded by
   * {@link PROJECT_MEMORY_LIMIT} so a long session cannot grow it forever.
   */
  projects: Record<string, ProjectSlice>
}

export type ViewerAction =
  | { type: 'load-start' }
  | {
    type: 'load-success'
    specs?: string[]
    files: string[]
    dirs?: string[]
    present?: boolean
    statusByDir?: Record<string, SpecStatus>
  }
  | { type: 'load-error'; error: string; disconnected?: boolean }
  | { type: 'select'; path: string }
  | { type: 'toggle-dir'; path: string }
  | { type: 'file-loaded'; content: string; key?: string }
  | { type: 'file-error'; error: string; key?: string }
  | { type: 'set-mode'; mode: ViewMode }
  | { type: 'edit'; draft: string }
  | { type: 'save-start' }
  | { type: 'save-success' }
  | { type: 'save-error'; error: string }
  | { type: 'set-split'; split: number }
  | { type: 'set-surface'; surface: Surface }
  | { type: 'set-popup-open'; open: boolean }
  | { type: 'set-pinned'; pinned: boolean }
  | { type: 'set-dragging'; dragging: boolean }
  | { type: 'set-project'; root: string; ready: boolean }

export const NO_LEANSPEC_BANNER = '当前项目没有 LeanSpec (specs/ 目录不存在)'

/** Top-level `NNN-name/README.md` — the only file whose content drives a badge. */
const SPEC_README = /^(\d{3,}-[^/]+)\/readme\.md$/i

export const initialViewerState: ViewerState = {
  loadStatus: 'idle',
  present: false,
  specs: [],
  files: [],
  dirs: [],
  expanded: new Set<string>(),
  statusByDir: {},
  selected: null,
  mode: 'preview',
  content: '',
  draft: '',
  saving: false,
  saveStatus: 'idle',
  loadedKey: null,
  split: SPLIT_DEFAULT,
  surface: 'popup',
  popupOpen: false,
  pinned: false,
  dragging: false,
  projectRoot: '',
  projectReady: false,
  projects: {},
}

/** How many project roots keep their selection/draft; the oldest is evicted. */
export const PROJECT_MEMORY_LIMIT = 8

/** A root with nothing loaded yet — what a workspace switch lands on. */
export const emptyProjectSlice: ProjectSlice = {
  loadStatus: 'idle',
  loadError: undefined,
  present: false,
  specs: [],
  files: [],
  dirs: [],
  expanded: new Set<string>(),
  statusByDir: {},
  selected: null,
  mode: 'preview',
  content: '',
  draft: '',
  loadedKey: null,
  saving: false,
  saveStatus: 'idle',
  saveError: undefined,
}

/** The root-scoped half of the state, as a value that can be parked. */
export function sliceOfProject(state: ViewerState): ProjectSlice {
  return {
    loadStatus: state.loadStatus,
    loadError: state.loadError,
    present: state.present,
    specs: state.specs,
    files: state.files,
    dirs: state.dirs,
    expanded: state.expanded,
    statusByDir: state.statusByDir,
    selected: state.selected,
    mode: state.mode,
    content: state.content,
    draft: state.draft,
    loadedKey: state.loadedKey,
    saving: state.saving,
    saveStatus: state.saveStatus,
    saveError: state.saveError,
  }
}

/**
 * Put a slice back, keeping every UI preference (split, surface, pin, drag).
 *
 * The slice always carries `loadError` / `saveError` explicitly — including as
 * `undefined` — so a clean slice cannot inherit the previous root's error.
 */
export function withProjectSlice(state: ViewerState, slice: ProjectSlice): ViewerState {
  return { ...state, ...slice }
}

/**
 * Handle a root announcement from the session header (specs/009).
 *
 * Three cases, and the order matters:
 *
 * 1. Same root, same readiness → the very same object, so a no-op announcement
 *    does not re-render the tree.
 * 2. Same root, different readiness → only `projectReady` moves. `ready` flips
 *    `false → true` on every mount, and mistaking that for a workspace change
 *    would throw away the user's selection and draft.
 * 3. Different root → park the outgoing slice and restore the incoming one (or
 *    an empty one). This is what stops root A's file from rendering, and being
 *    saved, under root B.
 */
export function switchProject(state: ViewerState, root: string, ready: boolean): ViewerState {
  if (state.projectRoot === root) {
    return state.projectReady === ready ? state : { ...state, projectReady: ready }
  }
  // An unresolved root ('') is not a workspace: leave it out of the memory, but
  // still park a real root on the way out, so a transient `A → '' → A` (the
  // workspace list taking a moment to report) does not cost the user their place.
  const projects = state.projectRoot === ''
    ? state.projects
    : rememberProject(state.projects, state.projectRoot, sliceOfProject(state), root)
  const restored = root === '' ? undefined : state.projects[root]
  return {
    ...withProjectSlice(state, restored === undefined ? emptyProjectSlice : refreshedSlice(restored)),
    projects,
    projectRoot: root,
    projectReady: ready,
  }
}

/**
 * A parked slice, minus transient save state.
 *
 * A switch ends whatever the save chip was saying: a restored `saving: true`
 * could otherwise stick forever if its request settled while another root was
 * on screen.
 */
function refreshedSlice(slice: ProjectSlice): ProjectSlice {
  return { ...slice, saving: false, saveStatus: 'idle', saveError: undefined }
}

/**
 * Insert (most-recent-wins) and evict beyond {@link PROJECT_MEMORY_LIMIT}.
 *
 * `keep` is the root being restored in the same switch. It is never the entry
 * evicted: parking the outgoing root can push the map one over the limit, and
 * the oldest entry would otherwise be the very slice we are about to show.
 */
function rememberProject(
  projects: Record<string, ProjectSlice>,
  root: string,
  slice: ProjectSlice,
  keep: string,
): Record<string, ProjectSlice> {
  // Re-inserting moves the key to the end: plain object keys keep insertion
  // order, which makes the last key the most recently used root.
  const next: Record<string, ProjectSlice> = { ...projects }
  delete next[root]
  next[root] = slice
  for (const stale of Object.keys(next)) {
    if (Object.keys(next).length <= PROJECT_MEMORY_LIMIT) break
    if (stale === keep) continue
    delete next[stale]
  }
  return next
}

/**
 * Recompute one spec's badge from freshly saved content.
 *
 * Reuses the very same parser as the server instead of re-fetching `/tree`, so
 * a save is reflected without a reload and without a second source of truth.
 * Saving any other file (a `design.md`, a nested `docs/README.md`) leaves the
 * table untouched.
 */
function withSyncedStatus(
  statusByDir: Record<string, SpecStatus>,
  selected: string | null,
  draft: string,
): Record<string, SpecStatus> {
  const match = selected === null ? null : SPEC_README.exec(selected)
  if (match === null) return statusByDir
  const dir = match[1] ?? ''
  const status = parseSpecStatus(draft)
  const next = { ...statusByDir }
  if (status === undefined) delete next[dir]
  else next[dir] = status
  return next
}

/**
 * Whether the text pane still has to fetch the file behind `key`.
 *
 * Exported and pure so the "a surface switch must not reload the file" rule is a
 * tested fact rather than a property of an effect: the viewer remounts on every
 * switch, and an unconditional fetch would overwrite an unsaved draft with the
 * copy on disk (REQ-3.4, bug 2026-10-08).
 */
export function needsFileLoad(
  state: Pick<ViewerState, 'loadedKey'>,
  key: string | null,
  projectReady: boolean,
): boolean {
  if (key === null || !projectReady) return false
  return state.loadedKey !== key
}

export function reduceViewer(state: ViewerState, action: ViewerAction): ViewerState {
  switch (action.type) {
    case 'load-start':
      return { ...state, loadStatus: 'loading', loadError: undefined }
    case 'load-success':
      return {
        ...state,
        loadStatus: 'ready',
        loadError: undefined,
        present: action.present !== false,
        specs: action.specs ?? [],
        files: action.files,
        dirs: action.dirs ?? [],
        statusByDir: action.statusByDir ?? {},
      }
    case 'load-error':
      return {
        ...state,
        loadStatus: action.disconnected === true ? 'disconnected' : 'error',
        loadError: action.error,
        present: false,
        specs: [],
        files: [],
        dirs: [],
        statusByDir: {},
        saveStatus: 'idle',
        saving: false,
      }
    case 'select':
      return {
        ...state,
        selected: action.path,
        mode: 'preview',
        content: '',
        draft: '',
        // A new file has nothing loaded yet, whatever the last one left behind.
        loadedKey: null,
        saveStatus: 'idle',
        saveError: undefined,
      }
    case 'toggle-dir': {
      // A fresh Set every time on purpose: the tree compares by reference, so
      // mutating in place would keep the identity and skip the re-render.
      const expanded = new Set(state.expanded)
      if (expanded.has(action.path)) expanded.delete(action.path)
      else expanded.add(action.path)
      return { ...state, expanded }
    }
    case 'file-loaded':
      return {
        ...state,
        content: action.content,
        draft: action.content,
        loadedKey: action.key ?? state.loadedKey,
        saveStatus: 'idle',
        saveError: undefined,
      }
    case 'file-error':
      return {
        ...state,
        loadError: action.error,
        content: '',
        draft: '',
        // A failed read is recorded too: a remount must not silently retry the
        // same path and wipe the sentence that explains it.
        loadedKey: action.key ?? state.loadedKey,
      }
    case 'set-mode':
      // A guard, not just a disabled button. `edit` is refused for an image here
      // so that no keyboard or programmatic dispatch can park binary content in
      // the draft and hand it to `writeSpecFile` (REQ-5) — a save would replace
      // the picture with mojibake.
      if (action.mode === 'edit' && isImagePath(state.selected ?? '')) return state
      return { ...state, mode: action.mode }
    case 'edit':
      return { ...state, draft: action.draft, saveStatus: 'idle', saveError: undefined }
    case 'save-start':
      return { ...state, saving: true, saveStatus: 'saving', saveError: undefined }
    case 'save-success':
      return {
        ...state,
        saving: false,
        saveStatus: 'saved',
        content: state.draft,
        saveError: undefined,
        statusByDir: withSyncedStatus(state.statusByDir, state.selected, state.draft),
      }
    case 'save-error':
      return {
        ...state,
        saving: false,
        saveStatus: 'error',
        saveError: action.error,
      }
    case 'set-split':
      return { ...state, split: action.split }
    case 'set-surface':
      // Moving to the tab dismisses the popover first (REQ-3.1); moving back to
      // the popup leaves the reopen request to 'set-popup-open'.
      return {
        ...state,
        surface: action.surface,
        popupOpen: action.surface === 'popup' ? state.popupOpen : false,
        // Every surface move is a fresh start: a pin belongs to one panel
        // session only (REQ-1.7, T3.2). The manual path re-pins right after.
        pinned: false,
      }
    case 'set-popup-open':
      return {
        ...state,
        popupOpen: action.open,
        surface: action.open ? 'popup' : state.surface,
        // Opening or closing the popover ends the pinned choice: the next open
        // asks `decideSurface` again (design.md §4.1).
        pinned: false,
      }
    case 'set-pinned':
      return state.pinned === action.pinned ? state : { ...state, pinned: action.pinned }
    case 'set-dragging':
      // Kept in the store because the surface follow (T3.2) defers a switch
      // while the splitter is held, and it lives outside this component.
      return state.dragging === action.dragging ? state : { ...state, dragging: action.dragging }
    case 'set-project':
      return switchProject(state, action.root, action.ready)
    default:
      return state
  }
}

/**
 * Whether the tree we already hold can stand in for a refresh in flight.
 *
 * A surface switch remounts the viewer, which re-runs the `/tree` load (the
 * only source of freshness — there is no manual refresh). Dropping back to the
 * loading placeholder on every switch made the tree blink out for a round trip,
 * so a refresh over existing data is a **background** refresh: the old tree
 * stays on screen until the new one arrives. Only a first load with nothing to
 * show still gets the loading state.
 */
export function hasTreeData(state: Pick<ViewerState, 'specs' | 'files' | 'dirs'>): boolean {
  return state.specs.length > 0 || state.files.length > 0 || state.dirs.length > 0
}

export function selectView(state: ViewerState): {
  showTree: boolean
  banner?: string
  saved: boolean
  /** The tree is being refreshed over data that is already on screen. */
  refreshing: boolean
} {
  const refreshing = state.loadStatus === 'loading' && hasTreeData(state) && state.present
  const showTree = (state.loadStatus === 'ready' || refreshing) && state.present
  const banner = state.loadStatus === 'error' || state.loadStatus === 'disconnected'
    ? state.loadError
    : state.loadStatus === 'ready' && !state.present
      ? NO_LEANSPEC_BANNER
      : undefined
  const saved = state.saveStatus === 'saved' && !state.saving && state.draft === state.content
  return { showTree, banner, saved, refreshing }
}

export function isMarkdownPath(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.md')
}
