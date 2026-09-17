import { createElement, useEffect, useReducer, useState, type ReactElement } from 'react'
import { buildFileTree, type FileTreeNode } from './file-tree.ts'
import { renderMarkdown } from './markdown.ts'
import { ensureLeanspecStyles } from './styles.ts'
import {
  initialViewerState,
  isMarkdownPath,
  reduceViewer,
  selectView,
} from './viewer-state.ts'

export type LeanspecViewerProps = {
  projectRoot?: string
  projectReady?: boolean
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

function TreeNodes(props: {
  nodes: FileTreeNode[]
  selected: string | null
  expanded: Set<string>
  onToggle: (path: string) => void
  onSelect: (path: string) => void
}): ReactElement {
  return createElement(
    'ul',
    null,
    ...props.nodes.map(node => {
      if (node.kind === 'dir') {
        const open = props.expanded.has(node.path)
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
            createElement('span', { className: 'dsh-leanspec-chevron' }, open ? '▾' : '▸'),
            createElement('span', { className: 'dsh-leanspec-file-name' }, node.name),
          ),
          open && node.children
            ? createElement(TreeNodes, {
              nodes: node.children,
              selected: props.selected,
              expanded: props.expanded,
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

export function LeanspecViewer({ projectRoot, projectReady = true }: LeanspecViewerProps): ReactElement {
  const [state, dispatch] = useReducer(reduceViewer, initialViewerState)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const view = selectView(state)
  const tree = buildFileTree(state.files, state.dirs)
  const markdown = state.selected !== null && isMarkdownPath(state.selected)
  const preview = markdown ? renderMarkdown(state.content) : null
  const dirty = state.draft !== state.content

  useEffect(() => {
    ensureLeanspecStyles()
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
        return await response.json() as { specs: string[]; files: string[]; dirs?: string[]; present?: boolean }
      })
      .then((payload) => {
        if (!cancelled) {
          dispatch({
            type: 'load-success',
            specs: payload.specs,
            files: payload.files,
            dirs: payload.dirs,
            present: payload.present,
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
    if (!state.selected || !projectReady) return
    let cancelled = false
    const params = new URLSearchParams({ path: state.selected })
    if (projectRoot) params.set('root', projectRoot)
    fetch(`/leanspec-viewer/file?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response))
        return await response.json() as { content: string }
      })
      .then((payload) => {
        if (!cancelled) dispatch({ type: 'file-loaded', content: payload.content })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          dispatch({
            type: 'file-error',
            error: error instanceof Error ? error.message : 'failed to load file',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [projectReady, projectRoot, state.selected])

  async function save(): Promise<void> {
    if (!state.selected || state.saving) return
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
    setExpanded(current => {
      const next = new Set(current)
      if (next.has(dirPath)) next.delete(dirPath)
      else next.add(dirPath)
      return next
    })
  }

  return createElement(
    'div',
    { className: 'dsh-leanspec-shell' },
    createElement(
      'aside',
      { className: 'dsh-leanspec-aside' },
      createElement('div', { className: 'dsh-leanspec-aside-title' }, 'LeanSpec'),
      view.banner ? createElement('p', { role: 'alert', className: 'dsh-leanspec-banner' }, view.banner) : null,
      view.showTree
        ? createElement(
          'nav',
          { className: 'dsh-leanspec-tree' },
          createElement(TreeNodes, {
            nodes: tree,
            selected: state.selected,
            expanded,
            onToggle: toggleDir,
            onSelect: (path: string) => dispatch({ type: 'select', path }),
          }),
        )
        : null,
    ),
    createElement(
      'section',
      { className: 'dsh-leanspec-main' },
      createElement(
        'header',
        { className: 'dsh-leanspec-chrome' },
        createElement(
          'div',
          { className: 'dsh-leanspec-toolbar' },
          createElement('button', {
            type: 'button',
            className: `dsh-leanspec-chip${state.mode === 'preview' ? ' is-active' : ''}`,
            onClick: () => dispatch({ type: 'set-mode', mode: 'preview' }),
          }, '预览'),
          createElement('button', {
            type: 'button',
            className: `dsh-leanspec-chip${state.mode === 'edit' ? ' is-active' : ''}`,
            onClick: () => dispatch({ type: 'set-mode', mode: 'edit' }),
            disabled: !state.selected,
          }, '编辑'),
          createElement('button', {
            type: 'button',
            className: 'dsh-leanspec-save',
            onClick: () => { void save() },
            disabled: !state.selected || !dirty || state.saving,
          }, state.saving ? '保存中…' : '保存'),
          view.saved ? createElement('span', { className: 'dsh-leanspec-status-ok' }, '已保存') : null,
          state.saveError ? createElement('span', { role: 'alert', className: 'dsh-leanspec-status-err' }, state.saveError) : null,
        ),
        state.selected ? createElement('div', { className: 'dsh-leanspec-path' }, state.selected) : null,
      ),
      createElement(
        'div',
        { className: 'dsh-leanspec-body' },
        !state.selected && view.showTree
          ? createElement('p', { className: 'dsh-leanspec-empty' }, '选择一个文件。')
          : null,
        state.selected && state.mode === 'preview' && markdown && preview?.empty
          ? createElement('p', { className: 'dsh-leanspec-empty' }, '空文件')
          : null,
        state.selected && state.mode === 'preview' && markdown && preview && !preview.empty
          ? createElement('div', {
            className: 'dsh-leanspec-preview',
            dangerouslySetInnerHTML: { __html: preview.html },
          })
          : null,
        state.selected && state.mode === 'preview' && !markdown
          ? createElement('pre', {
            className: 'dsh-leanspec-source',
            dangerouslySetInnerHTML: { __html: escapeText(state.content) },
          })
          : null,
        state.selected && state.mode === 'edit'
          ? createElement('textarea', {
            className: 'dsh-leanspec-editor',
            value: state.draft,
            onChange: (event: { target: { value: string } }) => dispatch({ type: 'edit', draft: event.target.value }),
          })
          : null,
      ),
    ),
  )
}
