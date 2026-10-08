import { Fragment, createElement, useEffect, useRef, useState, type ReactElement } from 'react'
import { LeanspecViewer } from './LeanspecViewer.ts'
import {
  fallbackSessions,
  fallbackWorkspaces,
  projectRootFromSlot,
  type SessionListSnapshot,
  type WorkspaceListSnapshot,
} from './project-root.ts'
import { ensureLeanspecStyles } from './styles.ts'
import { anchorBottomFromTrigger, decideSurface } from './surface.ts'
import { createSurfaceFollower, type SurfaceFollower } from './surface-follow.ts'
import { viewerStore, useViewerStore } from './store.ts'
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

  const decideNow = (): Surface => decideSurface({ ...measureViewport(), anchorBottom: measureAnchor() })

  /**
   * Live following (T3.2): one resize subscription, a throttled evaluation, and
   * the guards inside `planFollow`. Created once; reads everything fresh from the
   * store and from the live DOM, so it never works from a stale closure.
   */
  useEffect(() => {
    const follower = createSurfaceFollower({
      measure: () => ({ ...measureViewport(), anchorBottom: measureAnchor() }),
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
  const anchorStyle = props.anchor === undefined
    ? undefined
    : ({ '--anchor': `${props.anchor}px` } as unknown as Record<string, string>)
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
      )
      : null,
  )
}
