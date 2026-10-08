import {
  createElement,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from 'react'
import { isImagePath } from '../media.ts'
import type { SpecStatus } from '../spec-status.ts'
import { buildFileTree, type FileTreeNode } from './file-tree.ts'
import {
  canEditFile,
  imageLoadErrorText,
  rawUrl,
  shouldLoadText,
  viewModesFor,
} from './image-view.ts'
import { renderMarkdown, rewriteImageSrc } from './markdown.ts'
import { isSpecRootDir, specStatusBadge } from './spec-badge.ts'
import { loadPersistedSplit, persistSplit, useViewerStore, viewerStore } from './store.ts'
import { ensureLeanspecStyles } from './styles.ts'
import {
  SPLIT_DEFAULT,
  SPLIT_MAX,
  SPLIT_MIN,
  SPLIT_STEP,
  clampSplit,
  splitUpperBound,
} from './surface.ts'
import { isMarkdownPath, needsFileLoad, selectView, type ViewMode } from './viewer-state.ts'

export type LeanspecViewerProps = {
  projectRoot?: string
  projectReady?: boolean
  /**
   * Optional control rendered at the right edge of the tree pane's header row,
   * on the same line as the `LeanSpec` label (2026-10-08 adjustment).
   *
   * The popup passes its 「在右栏打开」 button here so the control sits inside
   * the directory column it acts on, instead of on a full-width bar above the
   * panel. The right-sidebar tab passes nothing: it has no switch to draw.
   */
  headAction?: ReactElement
}

async function readError(response: Response): Promise<string> {
  try {
    const payload = await response.json() as { error?: string }
    if (payload.error) return payload.error
  } catch {
    // Fall through to status text.
  }
  return response.statusText || `HTTP ${response.status}`
}

function withRoot(url: string, projectRoot: string | undefined): string {
  if (!projectRoot) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}${new URLSearchParams({ root: projectRoot }).toString()}`
}

function escapeText(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

/** Toolbar labels, keyed by the modes `viewModesFor` decides. */
const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  preview: '预览',
  source: '源码',
  edit: '编辑',
}

/** Props for {@link TreeNodes}; exported with it so the render tests can drive it. */
export type TreeNodesProps = {
  nodes: FileTreeNode[]
  selected: string | null
  expanded: Set<string>
  statusByDir: Record<string, SpecStatus>
  onToggle: (path: string) => void
  onSelect: (path: string) => void
}

/**
 * Exported for `test/viewer-render.test.ts`: it is a plain, hook-free component,
 * so tests can call it directly and assert on the returned element tree without
 * pulling in react-dom or a browser.
 */
export function TreeNodes(props: TreeNodesProps): ReactElement {
  return createElement(
    'ul',
    null,
    ...props.nodes.map(node => {
      if (node.kind === 'dir') {
        const open = props.expanded.has(node.path)
        // Only top-level spec directories carry a badge; the status table is
        // keyed by spec directory name.
        const badge = isSpecRootDir(node.path) ? specStatusBadge(props.statusByDir[node.path]) : null
        return createElement(
          'li',
          { key: node.path },
          createElement(
            'button',
            {
              type: 'button',
              className: 'dsh-leanspec-dir',
              onClick: () => props.onToggle(node.path),
            },
            createElement('span', { className: `dsh-leanspec-chevron${open ? ' is-open' : ''}` }),
            // A span, never a button: the row is already a button, and clicking
            // the row is what selects the spec.
            badge === null ? null : createElement('span', { className: badge.className }, badge.label),
            createElement('span', { className: 'dsh-leanspec-file-name' }, node.name),
          ),
          open && node.children
            ? createElement(TreeNodes, {
              nodes: node.children,
              selected: props.selected,
              expanded: props.expanded,
              statusByDir: props.statusByDir,
              onToggle: props.onToggle,
              onSelect: props.onSelect,
            })
            : null,
        )
      }
      return createElement(
        'li',
        { key: node.path },
        createElement(
          'button',
          {
            type: 'button',
            className: `dsh-leanspec-file${props.selected === node.path ? ' is-selected' : ''}`,
            onClick: () => props.onSelect(node.path),
          },
          createElement('span', { className: 'dsh-leanspec-file-name' }, node.name),
        ),
      )
    }),
  )
}

/** Props for {@link PanelSplitter}; exported with it so render tests can drive it. */
export type PanelSplitterProps = {
  value: number
  /** Largest width the user can actually reach right now (not the constant). */
  max: number
  dragging: boolean
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void
  onReset: () => void
}

/**
 * The draggable divider between file tree and body.
 *
 * Hook-free and exported for `test/viewer-render.test.ts`: REQ-7.2's ARIA
 * contract is asserted by calling it directly, with no renderer and no browser.
 *
 * `aria-valuemax` is the *reachable* maximum, not {@link SPLIT_MAX}: on a narrow
 * panel the clamp is lower, and announcing 420 there would be a lie.
 */
export function PanelSplitter(props: PanelSplitterProps): ReactElement {
  return createElement('div', {
    className: `dsh-leanspec-splitter${props.dragging ? ' is-dragging' : ''}`,
    role: 'separator',
    'aria-orientation': 'vertical',
    'aria-label': '调整目录宽度',
    'aria-valuemin': SPLIT_MIN,
    'aria-valuemax': props.max,
    'aria-valuenow': props.value,
    'data-leanspec-splitter': 'true',
    tabIndex: 0,
    onPointerDown: props.onPointerDown,
    onPointerMove: props.onPointerMove,
    onPointerUp: props.onPointerUp,
    onPointerCancel: props.onPointerUp,
    onDoubleClick: props.onReset,
    onKeyDown: props.onKeyDown,
  })
}

/** Props for {@link ImageView}; exported with it so render tests can drive it. */
export type ImageViewProps = {
  /** The raw endpoint URL, already carrying `root` and `path`. */
  src: string
  alt: string
  /** Human-readable failure text, or null while the image is expected to load. */
  error: string | null
  /**
   * Bumped by the retry button. It only feeds the element `key`, whose change is
   * what makes React remount the `<img>` and the browser fetch it again.
   */
  nonce: number
  /** The image element reported a load failure (no status — the caller asks). */
  onError: () => void
  onRetry: () => void
}

/**
 * The image body.
 *
 * Hook-free and exported for `test/viewer-render.test.ts`, like `TreeNodes` and
 * `PanelSplitter`: the failure state and the retry contract are asserted by
 * calling it directly, with no renderer and no DOM.
 *
 * The bytes arrive through `<img src>` and nothing else. Inlining an SVG's text
 * as markup would hand a file's author the panel's origin (F-5), and a failed
 * load must say why instead of showing a broken-image glyph (REQ-4 / REQ-8).
 */
export function ImageView(props: ImageViewProps): ReactElement {
  if (props.error !== null) {
    return createElement(
      'div',
      { role: 'alert', className: 'dsh-leanspec-image-error' },
      createElement('span', null, props.error),
      createElement('button', {
        type: 'button',
        className: 'dsh-leanspec-chip',
        'data-leanspec-image-retry': 'true',
        onClick: props.onRetry,
      }, '重试'),
    )
  }
  return createElement(
    'div',
    { className: 'dsh-leanspec-image-wrap' },
    // An anchor, not a script handler: the raw bytes open in a new tab on click,
    // and middle-click / "open in new tab" keep working.
    createElement(
      'a',
      {
        className: 'dsh-leanspec-image-link',
        href: props.src,
        target: '_blank',
        rel: 'noreferrer',
      },
      createElement('img', {
        key: `${props.src}#${props.nonce}`,
        className: 'dsh-leanspec-image',
        src: props.src,
        alt: props.alt,
        onError: () => { props.onError() },
      }),
    ),
  )
}

/** Props for {@link ViewerMain}; exported with it so render tests can drive it. */
export type ViewerMainProps = {
  selected: string | null
  mode: ViewMode
  projectRoot?: string
  content: string
  draft: string
  saving: boolean
  saved: boolean
  saveError?: string
  showTree: boolean
  imageError: string | null
  imageNonce: number
  onMode: (mode: ViewMode) => void
  onDraft: (draft: string) => void
  onSave: () => void
  onImageError: () => void
  onImageRetry: () => void
}

/**
 * Toolbar and body — everything to the right of the splitter.
 *
 * Hook-free and exported for `test/viewer-render.test.ts`: the image branch, the
 * disabled `编辑` / `保存` pair (REQ-5) and the markdown src rewrite (REQ-7) are
 * all structural, so they are asserted by calling this, not by mounting it.
 */
export function ViewerMain(props: ViewerMainProps): ReactElement {
  const { selected, mode } = props
  const imageSelected = selected !== null && isImagePath(selected)
  const markdown = selected !== null && isMarkdownPath(selected)
  const preview = markdown ? renderMarkdown(props.content) : null
  const previewHtml = selected !== null && preview !== null && !preview.empty
    ? rewriteImageSrc(preview.html, selected, props.projectRoot ?? '')
    : ''
  // One answer for both controls: a chip that cannot be used is disabled, never
  // hidden — an image keeps its `编辑` chip so the rule is visible (REQ-5).
  const editable = canEditFile(selected)
  const dirty = props.draft !== props.content

  return createElement(
    'section',
    { className: 'dsh-leanspec-main' },
    createElement(
      'header',
      { className: 'dsh-leanspec-chrome' },
      createElement(
        'div',
        { className: 'dsh-leanspec-toolbar' },
        ...viewModesFor(selected).map(option => createElement('button', {
          key: option,
          type: 'button',
          className: `dsh-leanspec-chip${mode === option ? ' is-active' : ''}`,
          'data-leanspec-view-mode': option,
          onClick: () => props.onMode(option),
          // Only `edit` is ever disabled, and for an image it stays visible but
          // greyed out (REQ-5). Preview and source always work.
          disabled: option === 'edit' && (selected === null || !editable),
        }, VIEW_MODE_LABELS[option])),
        createElement('button', {
          type: 'button',
          className: 'dsh-leanspec-save',
          onClick: props.onSave,
          // Images are never savable: their text form is mojibake, and writing it
          // back would destroy the file (REQ-5).
          disabled: selected === null || !editable || !dirty || props.saving,
        }, props.saving ? '保存中…' : '保存'),
        props.saved ? createElement('span', { className: 'dsh-leanspec-status-ok' }, '已保存') : null,
        props.saveError ? createElement('span', { role: 'alert', className: 'dsh-leanspec-status-err' }, props.saveError) : null,
      ),
      selected !== null ? createElement('div', { className: 'dsh-leanspec-path' }, selected) : null,
    ),
    createElement(
      'div',
      { className: 'dsh-leanspec-body' },
      selected === null && props.showTree
        ? createElement('p', { className: 'dsh-leanspec-empty' }, '选择一个文件。')
        : null,
      // Preview of an image file: <img> only, never the utf8 text (N-4).
      selected !== null && imageSelected && mode === 'preview'
        ? createElement(ImageView, {
          src: rawUrl(props.projectRoot ?? '', selected),
          alt: selected,
          error: props.imageError,
          nonce: props.imageNonce,
          onError: props.onImageError,
          onRetry: props.onImageRetry,
        })
        : null,
      selected !== null && mode === 'preview' && markdown && preview?.empty
        ? createElement('p', { className: 'dsh-leanspec-empty' }, '空文件')
        : null,
      selected !== null && mode === 'preview' && markdown && preview !== null && !preview.empty
        ? createElement('div', {
          className: 'dsh-leanspec-preview',
          dangerouslySetInnerHTML: { __html: previewHtml },
        })
        : null,
      // Read-only source: an SVG's XML (REQ-6), or any other text file in preview.
      selected !== null && (mode === 'source' || (mode === 'preview' && !markdown && !imageSelected))
        ? createElement('pre', {
          className: 'dsh-leanspec-source',
          dangerouslySetInnerHTML: { __html: escapeText(props.content) },
        })
        : null,
      selected !== null && mode === 'edit'
        ? createElement('textarea', {
          className: 'dsh-leanspec-editor',
          value: props.draft,
          onChange: (event: { target: { value: string } }) => props.onDraft(event.target.value),
        })
        : null,
    ),
  )
}

export function LeanspecViewer({ projectRoot: rootProp, projectReady: readyProp, headAction }: LeanspecViewerProps): ReactElement {
  // Shared store instead of a component-local reducer: the popup and the
  // right-sidebar tab are two exits of one panel (design.md §3).
  const [state, dispatch] = useViewerStore()
  /**
   * The project root and its readiness.
   *
   * The popup passes both in, because the session header resolved them. The tab
   * is not a child of that header and receives no owner props, so it falls back
   * to the copy the header publishes into the store — the tab therefore needs no
   * session identity of its own (design.md §3).
   */
  const projectRoot = rootProp ?? state.projectRoot
  const projectReady = readyProp ?? state.projectReady
  /** Live drag flag, in the shared store so the surface follow (T3.2) can read it. */
  const dragging = state.dragging
  /**
   * The image failure and the file it belongs to. Keyed by path so selecting
   * another file cannot inherit a stale message, which would otherwise need an
   * effect to clear.
   */
  const [imageFailure, setImageFailure] = useState<{ path: string; text: string } | null>(null)
  const [imageNonce, setImageNonce] = useState(0)
  /**
   * Measured panel width. `0` means "not measured yet" (first paint) — the
   * clamp then allows the whole range instead of guessing.
   */
  const [panelWidth, setPanelWidth] = useState(0)
  const panelWidthRef = useRef(0)
  const shellRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const view = selectView(state)
  const tree = buildFileTree(state.files, state.dirs)
  const imageError = imageFailure !== null && imageFailure.path === state.selected
    ? imageFailure.text
    : null
  /**
   * Which text load is currently owed. Documents are fetched once per file — a
   * mode switch must not refetch and clobber an unsaved draft — while an SVG
   * needs its XML exactly when it moves to `source`. `null` means no text at all,
   * which is what keeps an image preview from ever being read as utf8 (N-4).
   */
  const textKey = state.selected === null || !shouldLoadText(state.selected, state.mode)
    ? null
    : isImagePath(state.selected)
      ? `${state.selected}\u0000${state.mode}`
      : state.selected

  useEffect(() => {
    ensureLeanspecStyles()
  }, [])

  // Measure the shell (and follow it) instead of reading layout during render.
  // Declared before the hydration effect below so the first measurement lands
  // before a stored width is clamped against it.
  useEffect(() => {
    const shell = shellRef.current
    if (shell === null) return
    const measure = (): void => {
      const width = shell.getBoundingClientRect().width
      panelWidthRef.current = width
      setPanelWidth(width)
      // A shrinking panel re-clamps the tree rather than letting it eat the
      // body (REQ-5.3) — the aside is `flex: 0 0 auto`, so it would win.
      const current = viewerStore.getState().split
      const clamped = clampSplit(current, width)
      if (clamped !== current) dispatch({ type: 'set-split', split: clamped })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => { measure() })
    observer.observe(shell)
    return () => { observer.disconnect() }
  }, [])

  // Restore the persisted split once (REQ-6.1); anything unusable already fell
  // back to the default in `readStoredSplit`.
  useEffect(() => {
    const stored = loadPersistedSplit()
    if (stored !== SPLIT_DEFAULT) dispatch({ type: 'set-split', split: stored })
  }, [])

  useEffect(() => {
    if (!projectReady) {
      dispatch({ type: 'load-start' })
      return
    }
    let cancelled = false
    dispatch({ type: 'load-start' })
    fetch(withRoot('/leanspec-viewer/tree', projectRoot))
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response))
        return await response.json() as {
          specs: string[]
          files: string[]
          dirs?: string[]
          present?: boolean
          statusByDir?: Record<string, SpecStatus>
        }
      })
      .then((payload) => {
        if (!cancelled) {
          dispatch({
            type: 'load-success',
            specs: payload.specs,
            files: payload.files,
            dirs: payload.dirs,
            present: payload.present,
            statusByDir: payload.statusByDir,
          })
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const message = error instanceof Error ? error.message : 'failed to load files'
        dispatch({ type: 'load-error', error: message, disconnected: error instanceof TypeError })
      })
    return () => {
      cancelled = true
    }
  }, [projectReady, projectRoot])

  useEffect(() => {
    if (textKey === null || !projectReady) return
    // A surface switch remounts this component and re-runs this effect. Fetching
    // a file we already hold would replace the user's unsaved draft with the copy
    // on disk, so the store records which key its content belongs to (REQ-3.4).
    if (!needsFileLoad(viewerStore.getState(), textKey, projectReady)) return
    // The key's second half (the mode) only exists to re-run this effect; the
    // request itself is always for the file at the head of the key.
    const requestedPath = textKey.split('\u0000')[0] ?? ''
    let cancelled = false
    const params = new URLSearchParams({ path: requestedPath })
    if (projectRoot) params.set('root', projectRoot)
    fetch(`/leanspec-viewer/file?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response))
        return await response.json() as { content: string }
      })
      .then((payload) => {
        if (!cancelled) dispatch({ type: 'file-loaded', content: payload.content, key: textKey })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          dispatch({
            type: 'file-error',
            error: error instanceof Error ? error.message : 'failed to load file',
            key: textKey,
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [projectReady, projectRoot, textKey])

  /**
   * The endpoint's machine-readable reason, when it sent one.
   *
   * A 404 from a *registered* route carries a `code`; a 404 from a route that was
   * never registered carries nothing at all. That difference decides whether the
   * fix is a host reload or a path fix, so it has to survive into the sentence the
   * user reads instead of being flattened into "file not found".
   */
  async function readFailureCode(response: Response): Promise<string | undefined> {
    try {
      const payload = await response.json() as { code?: unknown }
      return typeof payload.code === 'string' ? payload.code : undefined
    } catch {
      return undefined
    }
  }

  /**
   * Ask the byte endpoint *why* an image failed. An `<img>` error carries no
   * status, and "over 20MB" deserves a different sentence from "not an image".
   *
   * GET rather than HEAD: only a body carries `code`. The probe runs *after* a
   * failure, so a 200 here means the bytes arrived and the *decode* failed — and
   * that body is cancelled rather than kept.
   */
  async function reportImageFailure(): Promise<void> {
    const path = state.selected
    if (path === null) return
    let status = 0
    let detail: string | undefined
    try {
      const response = await fetch(rawUrl(projectRoot ?? '', path))
      status = response.status
      if (response.ok) await response.body?.cancel()
      else detail = await readFailureCode(response)
    } catch {
      // A network failure has no status; the generic sentence is the right one.
      status = 0
    }
    setImageFailure({ path, text: imageLoadErrorText(status, detail) })
  }

  async function save(): Promise<void> {
    // The disabled button is not the only guard: this is the last line before
    // `writeSpecFile`, and an image has no text form to write back (REQ-5).
    if (!state.selected || state.saving || !canEditFile(state.selected)) return
    dispatch({ type: 'save-start' })
    try {
      const response = await fetch('/leanspec-viewer/file', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          root: projectRoot,
          path: state.selected,
          content: state.draft,
        }),
      })
      if (!response.ok) throw new Error(await readError(response))
      dispatch({ type: 'save-success' })
    } catch (error: unknown) {
      dispatch({
        type: 'save-error',
        error: error instanceof Error ? error.message : 'save failed',
      })
    }
  }

  function toggleDir(dirPath: string): void {
    // The set lives in the shared store: a surface switch unmounts this
    // component, and component state would come back empty (bug 2026-10-08).
    dispatch({ type: 'toggle-dir', path: dirPath })
  }

  /** Width the clamp divides up; unmeasured means "assume there is room". */
  function availableWidth(): number {
    return panelWidthRef.current > 0 ? panelWidthRef.current : Number.POSITIVE_INFINITY
  }

  function applySplit(desired: number): number {
    const next = clampSplit(desired, availableWidth())
    dispatch({ type: 'set-split', split: next })
    return next
  }

  function endDrag(): void {
    if (dragRef.current === null) return
    dragRef.current = null
    dispatch({ type: 'set-dragging', dragging: false })
    // Persist once, on release — never per pointermove (REQ-6.3).
    persistSplit(viewerStore.getState().split)
  }

  function onSplitterPointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    dragRef.current = { startX: event.clientX, startWidth: state.split }
    event.currentTarget.setPointerCapture(event.pointerId)
    dispatch({ type: 'set-dragging', dragging: true })
  }

  function onSplitterPointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current
    if (drag === null) return
    applySplit(drag.startWidth + (event.clientX - drag.startX))
  }

  function onSplitterKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    const step = event.key === 'ArrowLeft' ? -SPLIT_STEP : event.key === 'ArrowRight' ? SPLIT_STEP : 0
    if (step === 0) return
    event.preventDefault()
    persistSplit(applySplit(state.split + step))
  }

  return createElement(
    'div',
    { ref: shellRef, className: `dsh-leanspec-shell${dragging ? ' is-dragging' : ''}` },
    createElement(
      'aside',
      { className: 'dsh-leanspec-aside', style: { width: `${state.split}px` } },
      createElement(
        'div',
        { className: 'dsh-leanspec-aside-head' },
        createElement('div', { className: 'dsh-leanspec-aside-title' }, 'LeanSpec'),
        // Right-aligned in this column: the tree pane is where the room is and
        // the control switches *this* panel's exit.
        headAction ?? null,
      ),
      view.banner ? createElement('p', { role: 'alert', className: 'dsh-leanspec-banner' }, view.banner) : null,
      view.showTree
        ? createElement(
          'nav',
          {
            className: 'dsh-leanspec-tree',
            // A background refresh (T4.x): the tree on screen is the previous
            // snapshot until the new one lands, so mark it busy instead of
            // blanking it out — the only visible trace of the reload.
            'aria-busy': view.refreshing ? true : undefined,
          },
          createElement(TreeNodes, {
            nodes: tree,
            selected: state.selected,
            expanded: state.expanded,
            statusByDir: state.statusByDir,
            onToggle: toggleDir,
            onSelect: (path: string) => dispatch({ type: 'select', path }),
          }),
        )
        : null,
    ),
    createElement(PanelSplitter, {
      value: state.split,
      max: panelWidth > 0 ? splitUpperBound(panelWidth) : SPLIT_MAX,
      dragging,
      onPointerDown: onSplitterPointerDown,
      onPointerMove: onSplitterPointerMove,
      onPointerUp: endDrag,
      onKeyDown: onSplitterKeyDown,
      onReset: () => { persistSplit(applySplit(SPLIT_DEFAULT)) },
    }),
    createElement(ViewerMain, {
      selected: state.selected,
      mode: state.mode,
      projectRoot,
      content: state.content,
      draft: state.draft,
      saving: state.saving,
      saved: view.saved,
      saveError: state.saveError,
      showTree: view.showTree,
      imageError,
      imageNonce,
      onMode: (mode: ViewMode) => dispatch({ type: 'set-mode', mode }),
      onDraft: (draft: string) => dispatch({ type: 'edit', draft }),
      onSave: () => { void save() },
      onImageError: () => { void reportImageFailure() },
      onImageRetry: () => {
        setImageFailure(null)
        setImageNonce(current => current + 1)
      },
    }),
  )
}
