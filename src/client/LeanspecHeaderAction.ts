import {
  Fragment,
  createElement,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type Ref,
} from 'react'
import { LeanspecViewer } from './LeanspecViewer.ts'
import {
  fallbackSessions,
  fallbackWorkspaces,
  projectRootFromSlot,
  type SessionListSnapshot,
  type WorkspaceListSnapshot,
} from './project-root.ts'
import { ensureLeanspecStyles } from './styles.ts'
import {
  PANEL_DEFAULT,
  PANEL_STEP,
  anchorBottomFromTrigger,
  clampPanel,
  decideSurface,
  panelFromDrag,
  type PanelSize,
} from './surface.ts'
import { createSurfaceFollower, type SurfaceFollower } from './surface-follow.ts'
import { loadPersistedPanel, persistPanel, viewerStore, useViewerStore } from './store.ts'
import {
  leanspecTabIsOpen,
  subscribeTabCapability,
  switchToTab as switchSurfaceToTab,
  tabCapability,
  type OpenTabResult,
} from './tab-registration.ts'
import type { Surface, TabCapability } from './tab-surface.ts'
import { reduceViewer } from './viewer-state.ts'

export type LeanspecHeaderProps = {
  sessionId?: unknown
  useWorkspaces?: (selector: (state: WorkspaceListSnapshot) => unknown) => unknown
  useSessions?: (selector: (state: SessionListSnapshot) => unknown) => unknown
  /**
   * Host hook answering "is a Session on screen in the right sidebar" (REQ-1.6).
   *
   * Injected exactly like the first-party occupants do it — the register call
   * carries `inject: () => ({ hooks: { sidebarMounted: ctx.sidebarRight.mounted } })`.
   * Absent (older host, or a test), the follower assumes the sidebar is mounted
   * and lets `openTab` report its own failure instead.
   */
  useSidebarMounted?: (selector: (session: unknown) => unknown) => unknown
}

/**
 * Session-header LeanSpec control: a capsule beside Session log that opens a dropdown viewer.
 * @returns header button and, when open, the LeanSpec popover.
 */
export function LeanspecHeaderAction(props: LeanspecHeaderProps = {}): ReactElement {
  const [state, dispatch] = useViewerStore()
  const [capability, setCapability] = useState<TabCapability>(() => tabCapability())
  const [failure, setFailure] = useState<string | null>(null)
  const [anchor, setAnchor] = useState<number | undefined>(undefined)
  const rootRef = useRef<{ contains: (node: Node | null) => boolean } | null>(null)
  const followerRef = useRef<SurfaceFollower | null>(null)
  /** The dialog element, read at `pointerdown` so a drag starts from what is on screen. */
  const popoverRef = useRef<HTMLDivElement | null>(null)
  /** Live drag: where the pointer started and how big the box was then. */
  const resizeRef = useRef<{ startX: number; startY: number; size: PanelSize } | null>(null)
  const useWorkspaces = props.useWorkspaces ?? fallbackWorkspaces
  const useSessions = props.useSessions ?? fallbackSessions
  const useSidebarMounted = props.useSidebarMounted
  /**
   * Read like any other host hook: only when the host really injected it. The
   * branch is fixed for the lifetime of this mount, so hook order is stable.
   */
  const sidebarMounted = useSidebarMounted === undefined
    ? true
    : useSidebarMounted(session => session !== undefined) === true
  /** Latest mount answer for the follower, which is created exactly once. */
  const sidebarMountedRef = useRef(sidebarMounted)
  const workspaceState = useWorkspaces(state => ({
    items: state.items ?? [],
    ready: state.baselinesReady !== false,
  })) as { items: WorkspaceListSnapshot['items']; ready: boolean }
  const sessionCwd = useSessions(state => state.byId?.[String(props.sessionId ?? '')]?.cwd)
  const projectRoot = projectRootFromSlot({
    sessionId: props.sessionId,
    workspaces: workspaceState.items,
    sessionCwd,
  })
  const projectReady = workspaceState.ready
  const open = state.popupOpen

  useEffect(() => {
    ensureLeanspecStyles()
  }, [])

  // Restore the persisted popover size once (REQ-4.1). One key for every
  // session and project (D-5); `readStoredPanel` already fell back to the
  // default for anything unusable.
  useEffect(() => {
    const stored = loadPersistedPanel()
    const current = viewerStore.getState().panel
    if (stored.width === current.width && stored.height === current.height) return
    dispatch({ type: 'set-panel', width: stored.width, height: stored.height })
  }, [])

  // The tab surface can become available after this component mounted (the
  // services arrive through a scoped injection), so the button re-reads it
  // instead of sampling it once (REQ-8.3, T3.5).
  useEffect(() => subscribeTabCapability(() => {
    setCapability(tabCapability())
  }), [])

  /**
   * Publish the resolved project root for the other surface.
   *
   * The right-sidebar tab is not a child of this header, so the shared store is
   * how it learns which tree to load (design.md §3). The popup keeps using its
   * own props, so nothing about its behaviour depends on this write.
   */
  useEffect(() => {
    viewerStore.setState(reduceViewer(viewerStore.getState(), {
      type: 'set-project',
      root: projectRoot ?? '',
      ready: projectReady,
    }))
  }, [projectRoot, projectReady])

  useEffect(() => {
    if (!open) return
    // Written through the store rather than `dispatch`, so this effect's deps
    // stay `[open]` and the listeners are not re-bound on every render.
    const closePopover = (): void => {
      viewerStore.setState(reduceViewer(viewerStore.getState(), {
        type: 'set-popup-open',
        open: false,
      }))
    }
    const onPointer = (event: Event): void => {
      const target = event.target
      if (target instanceof Node && rootRef.current?.contains(target)) return
      closePopover()
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') closePopover()
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  /**
   * The popover's live top offset, measured from our own root element — which is
   * exactly what the CSS anchors the popover to (`top: calc(100% + 8px)`).
   *
   * Measured, never assumed (REQ-1.4): the injected `--anchor` and the surface
   * decision therefore read the same number, and the CSS `var(--anchor, …)`
   * fallback only covers the first paint.
   */
  const measureAnchor = (): number => {
    const node = rootRef.current as { getBoundingClientRect?: () => { bottom?: number } } | null
    return anchorBottomFromTrigger(node?.getBoundingClientRect?.().bottom)
  }

  const measureViewport = (): { viewportWidth: number; viewportHeight: number } => ({
    viewportWidth: typeof window === 'undefined' ? Number.NaN : window.innerWidth,
    viewportHeight: typeof window === 'undefined' ? Number.NaN : window.innerHeight,
  })

  useEffect(() => {
    sidebarMountedRef.current = sidebarMounted
  }, [sidebarMounted])

  /**
   * Everything a size clamp needs, measured now (specs/010).
   *
   * Same numbers the surface decision and the CSS cap use: the viewport, the
   * live anchor and the documented edge gap.
   */
  const panelLimits = (): { viewportWidth: number; viewportHeight: number; anchorBottom: number } => ({
    ...measureViewport(),
    anchorBottom: measureAnchor(),
  })

  /** The size the popover should start a drag from: what is actually rendered. */
  const renderedPanel = (): PanelSize => {
    const current = viewerStore.getState().panel
    const rect = popoverRef.current?.getBoundingClientRect()
    if (rect === undefined || rect.width <= 0 || rect.height <= 0) return current
    return { width: rect.width, height: rect.height }
  }

  const onResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    // Without this Chromium may start a native text/element drag from the
    // handle, which fires `dragstart` and then `pointercancel` — the drag would
    // stop after the first move (found live, 2026-11-26).
    event.preventDefault()
    resizeRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      size: renderedPanel(),
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // An older host may refuse capture; the handle's own move events still
      // work, the drag just ends when the pointer leaves it.
    }
    dispatch({ type: 'set-dragging', dragging: true })
  }

  const onResizePointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const drag = resizeRef.current
    if (drag === null) return
    const next = panelFromDrag(
      drag.size,
      event.clientX - drag.startX,
      event.clientY - drag.startY,
      panelLimits(),
    )
    dispatch({ type: 'set-panel', width: next.width, height: next.height })
  }

  /** Ends a drag and persists exactly once, on release (REQ-1.3). */
  const onResizeEnd = (): void => {
    if (resizeRef.current === null) return
    resizeRef.current = null
    dispatch({ type: 'set-dragging', dragging: false })
    persistPanel(viewerStore.getState().panel)
  }

  const onResizeKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    const stepX = event.key === 'ArrowLeft' ? -PANEL_STEP : event.key === 'ArrowRight' ? PANEL_STEP : 0
    const stepY = event.key === 'ArrowUp' ? -PANEL_STEP : event.key === 'ArrowDown' ? PANEL_STEP : 0
    if (stepX === 0 && stepY === 0) return
    event.preventDefault()
    const current = viewerStore.getState().panel
    const next = clampPanel(
      { width: current.width + stepX, height: current.height + stepY },
      panelLimits(),
    )
    dispatch({ type: 'set-panel', width: next.width, height: next.height })
    // A key has no "release", so the value is durable immediately (REQ-5.2).
    persistPanel(next)
  }

  const onResizeReset = (): void => {
    dispatch({ type: 'set-panel', width: PANEL_DEFAULT.width, height: PANEL_DEFAULT.height })
    persistPanel(PANEL_DEFAULT)
  }

  const decideNow = (): Surface => decideSurface({
    ...measureViewport(),
    anchorBottom: measureAnchor(),
    // The size the user left it at (D-4); absent means the 007 default.
    panel: viewerStore.getState().panel,
  })

  /**
   * Live following (T3.2): one resize subscription, a throttled evaluation, and
   * the guards inside `planFollow`. Created once; reads everything fresh from the
   * store and from the live DOM, so it never works from a stale closure.
   */
  useEffect(() => {
    const follower = createSurfaceFollower({
      measure: () => ({
        ...measureViewport(),
        anchorBottom: measureAnchor(),
        panel: viewerStore.getState().panel,
      }),
      mounted: () => sidebarMountedRef.current,
      read: () => {
        const current = viewerStore.getState()
        return {
          surface: current.surface,
          pinned: current.pinned,
          dragging: current.dragging,
          panelVisible: current.popupOpen || leanspecTabIsOpen(),
          tabOpen: leanspecTabIsOpen(),
          tabAvailable: tabCapability().available,
        }
      },
      apply: surface => {
        if (surface === 'tab') {
          // Automatic, so no pin: the next resize may take it back.
          switchSurfaceToTab()
          return
        }
        // Reaching here means no tab is open (the policy sends that case to
        // `tab-wins`), so raising the popup cannot stack a second panel.
        viewerStore.setState(reduceViewer(viewerStore.getState(), {
          type: 'set-popup-open',
          open: true,
        }))
      },
      notify: setFailure,
      onTick: () => {
        setAnchor(measureAnchor())
      },
    })
    followerRef.current = follower
    // Measure once on mount so the first popover already uses the real anchor.
    setAnchor(measureAnchor())
    follower.evaluate()
    return () => {
      followerRef.current = null
      follower.dispose()
    }
  }, [])

  /**
   * Re-evaluate when a guard lifts: the drag ended, or the sidebar mounted.
   * Without this, a switch deferred during a drag would wait for the next resize
   * (REQ-1.5, REQ-1.6).
   */
  useEffect(() => {
    followerRef.current?.evaluate()
  }, [state.dragging, sidebarMounted])

  const actions = headerActions({
    dispatch,
    setFailure,
    decide: decideNow,
    tabAvailable: () => tabCapability().available,
  })

  return createElement(
    'div',
    { ref: rootRef, className: 'dsh-leanspec-root' },
    createElement(LeanspecHeaderView, {
      open,
      surface: state.surface,
      capability,
      failure,
      projectRoot,
      projectReady,
      anchor,
      panel: state.panel,
      popoverRef,
      onResizePointerDown,
      onResizePointerMove,
      onResizeEnd,
      onResizeKeyDown,
      onResizeReset,
      onToggle: actions.togglePopover,
      onSwitchToTab: actions.switchToTab,
    }),
  )
}

/** The store/UI effects one header click has, split out so tests can drive them. */
export function headerActions(deps: {
  dispatch: (action: { type: 'set-popup-open'; open: boolean }) => void
  setFailure: (message: string | null) => void
  /**
   * What `decideSurface` says for the viewport *now* (T3.1/T3.2). Asked on every
   * open, because the answer is a live measurement, not a snapshot (REQ-1.4).
   */
  decide?: () => Surface
  /** Whether the tab surface is usable; a missing tab falls back to the popup. */
  tabAvailable?: () => boolean
}): { togglePopover: () => void; switchToTab: () => void } {
  const decide = deps.decide ?? ((): Surface => 'popup')
  const tabAvailable = deps.tabAvailable ?? ((): boolean => true)
  const openPopover = (): void => {
    deps.dispatch({ type: 'set-popup-open', open: true })
  }
  return {
    /** Open the panel by decision, or close the popup that is already up. */
    togglePopover(): void {
      if (viewerStore.getState().popupOpen) {
        deps.dispatch({ type: 'set-popup-open', open: false })
        return
      }
      // The tab is one-way and a live tab owns the panel: focusing it is the
      // whole action — never a popup stacked next to it (REQ-3.3, 2026-10-08).
      if (leanspecTabIsOpen()) {
        const focused = switchSurfaceToTab()
        deps.setFailure(focused.ok ? null : focused.reason)
        return
      }
      if (decide() === 'tab' && tabAvailable()) {
        const result: OpenTabResult = switchSurfaceToTab()
        deps.setFailure(result.ok ? null : result.reason)
        // REQ-8.1: a tab that cannot open must not leave the user with nothing.
        if (!result.ok) openPopover()
        return
      }
      deps.setFailure(null)
      openPopover()
    },
    /**
     * Popup → tab (T2.3), the manual switch. A refusal is reported on the button
     * instead of doing nothing: the tab may be unusable because of the host, not
     * the user (REQ-8.2). `switchToTab` only dismisses the popup after a
     * success, so a failure leaves the popup exactly where it was.
     *
     * This is the one place a surface is pinned: it is the user speaking
     * (REQ-1.7, T3.2).
     */
    switchToTab(): void {
      const result: OpenTabResult = switchSurfaceToTab({ pin: true })
      deps.setFailure(result.ok ? null : result.reason)
    },
  }
}

export interface LeanspecHeaderViewProps {
  /** Whether the popover is up; `surface` says which exit owns the panel. */
  open: boolean
  surface: Surface
  capability: TabCapability
  /** Why the last switch attempt failed, shown beside the button (REQ-8.2). */
  failure: string | null
  projectRoot?: string
  projectReady?: boolean
  /**
   * The popover's top edge in viewport px, measured from the trigger (T3.3).
   * Injected as the `--anchor` custom property; the CSS carries a fallback for
   * the first paint, before anything has been measured.
   */
  anchor?: number
  /** The size the popover should render at (specs/010). Absent means the CSS default. */
  panel?: PanelSize
  /** The dialog element, so a drag can start from the box that is on screen. */
  popoverRef?: Ref<HTMLDivElement>
  onResizePointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void
  onResizePointerMove?: (event: ReactPointerEvent<HTMLDivElement>) => void
  /** Pointer release / cancel: end the drag and persist (REQ-1.3). */
  onResizeEnd?: () => void
  onResizeKeyDown?: (event: ReactKeyboardEvent<HTMLDivElement>) => void
  /** Double-click: back to the default size (REQ-5.1). */
  onResizeReset?: () => void
  onToggle: () => void
  onSwitchToTab: () => void
}

/**
 * The header control's markup inside `.dsh-leanspec-root`.
 *
 * Hook-free, so `test/tab-views.test.ts` can assert that the two exits never
 * render at once and that an unusable switch button says why — no renderer
 * needed. The popover is drawn only while the *popup* owns the panel, so a tab
 * that is still open can never put a second viewer on screen (REQ-3.3).
 */
export function LeanspecHeaderView(props: LeanspecHeaderViewProps): ReactElement {
  const disabled = !props.capability.available
  const popover = props.open && props.surface === 'popup'
  // `--anchor` covers the first paint before the button is measured; the panel
  // variables carry the user's size (specs/010). Nothing is injected at all
  // when neither is known, which is exactly the pre-010 default.
  const vars: Record<string, string> = {}
  if (props.anchor !== undefined) vars['--anchor'] = `${props.anchor}px`
  if (props.panel !== undefined) {
    vars['--panel-w'] = `${props.panel.width}px`
    vars['--panel-h'] = `${props.panel.height}px`
  }
  const anchorStyle = Object.keys(vars).length === 0
    ? undefined
    : (vars as unknown as Record<string, string>)
  // Only the *reason* gets a row of its own now: the switch button itself moved
  // onto the tree pane's header row (2026-10-08). An empty bar must never show.
  const notices = [
    disabled ? props.capability.unavailableReason ?? '' : '',
    props.failure ?? '',
  ].filter(text => text !== '')
  return createElement(
    Fragment,
    null,
    createElement(
      'button',
      {
        type: 'button',
        className: `dsh-leanspec-trigger${props.open ? ' is-open' : ''}`,
        'aria-expanded': props.open,
        'aria-haspopup': 'dialog',
        onClick: props.onToggle,
      },
      'LeanSpec',
    ),
    popover
      ? createElement(
        'div',
        {
          ref: props.popoverRef,
          role: 'dialog',
          'aria-label': 'LeanSpec',
          className: 'dsh-leanspec-popover',
          style: anchorStyle,
        },
        notices.length === 0
          ? null
          : createElement(
            'div',
            { className: 'dsh-leanspec-switchbar' },
            notices.map((text, index) =>
              createElement('span', { key: index, className: 'dsh-leanspec-notice-text' }, text)),
          ),
        createElement(LeanspecViewer, {
          projectRoot: props.projectRoot,
          projectReady: props.projectReady,
          // Same line as the `LeanSpec` label, right-aligned inside the
          // directory column (2026-10-08 adjustment).
          headAction: createElement(
            'button',
            {
              type: 'button',
              className: 'dsh-leanspec-switch',
              'data-leanspec-switch': 'tab',
              disabled,
              title: props.capability.unavailableReason ?? '在右栏标签里打开 LeanSpec',
              // Two visible characters on purpose (2026-10-08): the control
              // shares its row with the pane title, and at the 180px splitter
              // floor a five-character label wrapped. The full sentence lives
              // in the tooltip and the accessible name.
              'aria-label': props.capability.unavailableReason ?? '在右栏标签里打开 LeanSpec',
              onClick: props.onSwitchToTab,
            },
            '右栏 ⧉',
          ),
        }),
        // The corner handle (specs/010). A div, not a button: `role="button"`
        // plus an explicit label is the closest honest mapping — WAI-ARIA has
        // no two-axis resize role, and a `separator` would announce one axis.
        createElement('div', {
          className: 'dsh-leanspec-resize',
          role: 'button',
          tabIndex: 0,
          'aria-label': '调整弹窗大小（方向键调宽高，双击复位）',
          'data-leanspec-resize': 'true',
          // Native dragging would cancel the pointer sequence (see the handler).
          draggable: false,
          onDragStart: (event: { preventDefault: () => void }) => { event.preventDefault() },
          onPointerDown: props.onResizePointerDown,
          onPointerMove: props.onResizePointerMove,
          onPointerUp: props.onResizeEnd,
          onPointerCancel: props.onResizeEnd,
          onKeyDown: props.onResizeKeyDown,
          onDoubleClick: props.onResizeReset,
        }),
      )
      : null,
  )
}
