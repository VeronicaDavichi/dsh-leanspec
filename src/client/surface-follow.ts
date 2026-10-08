/**
 * Surface following (specs/007 T3.2, REQ-1.3 / REQ-1.5 / REQ-1.6 / REQ-1.7).
 *
 * Two pieces, both free of React and of DOM types:
 *
 * - {@link planFollow} is the whole policy as a pure function: given what the
 *   viewport measures and what the panel is doing, it says what should happen.
 *   Every guard lives there, so `test/surface-follow.test.ts` can pin all of
 *   them without a browser.
 * - {@link createSurfaceFollower} is the wiring: one `resize` subscription,
 *   bursts coalesced into at most one evaluation per {@link FOLLOW_THROTTLE_MS},
 *   and a disposer that leaves nothing behind (REQ-4.3).
 *
 * The tab direction is one-way (2026-10-08 decision): the policy switches the
 * popup to the tab when the window gets tight, and leaves a live tab alone
 * because only the host closes it. See requirements.md REQ-1.3.
 */
import { decideSurface, type SurfaceDecisionInput } from './surface.ts'
import type { Surface } from './tab-surface.ts'

/** Resize bursts are coalesced to at most one evaluation per this window. */
export const FOLLOW_THROTTLE_MS = 150

/** Shown while a switch to the tab waits for the sidebar to mount (REQ-1.6). */
export const SURFACE_DEFERRED_MOUNTED = '右栏标签还没就绪，稍后会自动切过去'

/** Everything about the panel the policy needs. */
export interface FollowSnapshot {
  /** Which surface owns the panel right now. */
  surface: Surface
  /** The user pinned this surface by hand (REQ-1.7). */
  pinned: boolean
  /** The splitter is being dragged (REQ-1.5). */
  dragging: boolean
  /** A panel is on screen at all — nothing to follow otherwise. */
  panelVisible: boolean
  /** Our tab is open in the host (the header should focus, never stack). */
  tabOpen: boolean
  /** The tab surface is usable right now (REQ-8.1). */
  tabAvailable: boolean
}

export type FollowOutcome =
  | { kind: 'idle'; reason: 'no-panel' | 'in-sync' | 'pinned' | 'dragging' | 'tab-wins' }
  | { kind: 'deferred'; reason: 'sidebar-not-mounted'; decided: Surface }
  | { kind: 'switch'; decided: Surface }

export interface FollowInput {
  /** Live measurements, straight into {@link decideSurface}. */
  measured: SurfaceDecisionInput
  /** The host hook's answer: is a Session on screen in the sidebar (REQ-1.6)? */
  mounted: boolean
}

/**
 * The whole follow policy, in guard order.
 *
 * The order is the behaviour: nothing happens without a panel, an unchanged
 * decision is not a switch, and the guards (pin, drag, mount, live tab) come
 * before the action they would delay.
 */
export function planFollow(snapshot: FollowSnapshot, input: FollowInput): FollowOutcome {
  if (!snapshot.panelVisible) return { kind: 'idle', reason: 'no-panel' }

  // REQ-8.1: a host without a usable tab surface is always a popup host, no
  // matter how narrow the window is.
  const wanted = decideSurface(input.measured)
  const decided: Surface = wanted === 'tab' && !snapshot.tabAvailable ? 'popup' : wanted

  if (decided === snapshot.surface) return { kind: 'idle', reason: 'in-sync' }
  // REQ-1.7: the user's manual choice wins until the panel is closed.
  if (snapshot.pinned) return { kind: 'idle', reason: 'pinned' }
  // REQ-1.5: a switch would unmount the pane and drop the pointer capture.
  if (snapshot.dragging) return { kind: 'idle', reason: 'dragging' }
  // A live tab is the host's to close, and opening a popup next to it would put
  // two panels on screen (REQ-3.3). Deviation recorded in requirements.md.
  if (decided === 'popup' && snapshot.tabOpen) return { kind: 'idle', reason: 'tab-wins' }
  // REQ-1.6: wait for the sidebar instead of failing silently.
  if (decided === 'tab' && !input.mounted) {
    return { kind: 'deferred', reason: 'sidebar-not-mounted', decided }
  }
  return { kind: 'switch', decided }
}

export interface SurfaceFollowerDeps {
  /** Reads the panel's current state. Called on every evaluation. */
  read: () => FollowSnapshot
  /** Reads the live viewport + anchor. Called on every evaluation (REQ-1.4). */
  measure: () => SurfaceDecisionInput
  /** The host hook's answer, read fresh on every evaluation. */
  mounted: () => boolean
  /** Performs the switch. Only called with the surface that must be shown. */
  apply: (surface: Surface) => void
  /** Reports a deferral so the user is told, not left guessing (REQ-1.6). */
  notify: (reason: string) => void
  /**
   * Called at the start of every throttled tick, before the evaluation. Used to
   * refresh the injected `--anchor` so the CSS cap and the decision cannot drift.
   */
  onTick?: () => void
  /** Defaults to `window` resize; injected by tests. */
  subscribe?: (handler: () => void) => () => void
  setTimer?: (handler: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
  throttleMs?: number
}

export interface SurfaceFollower {
  /** Evaluate now, apply if the policy says so. Returns what happened. */
  evaluate(): FollowOutcome
  /** Report a viewport change; bursts are coalesced. */
  schedule(): void
  /** Unsubscribe and drop any pending timer (REQ-4.3). */
  dispose(): void
}

function defaultSubscribe(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  window.addEventListener('resize', handler)
  return () => {
    window.removeEventListener('resize', handler)
  }
}

export function createSurfaceFollower(deps: SurfaceFollowerDeps): SurfaceFollower {
  const subscribe = deps.subscribe ?? defaultSubscribe
  const setTimer = deps.setTimer ?? ((handler, ms) => setTimeout(handler, ms))
  const clearTimer = deps.clearTimer ?? ((handle) => { clearTimeout(handle as ReturnType<typeof setTimeout>) })
  const throttleMs = deps.throttleMs ?? FOLLOW_THROTTLE_MS

  let timer: unknown = null
  let pending = false
  let disposed = false
  /** Last deferral we announced, so a repeated tick does not repeat itself. */
  let announced: string | null = null

  function evaluate(): FollowOutcome {
    const outcome = planFollow(deps.read(), { measured: deps.measure(), mounted: deps.mounted() })
    if (outcome.kind === 'switch') {
      announced = null
      deps.apply(outcome.decided)
      return outcome
    }
    if (outcome.kind === 'deferred') {
      if (announced !== outcome.reason) {
        announced = outcome.reason
        deps.notify(SURFACE_DEFERRED_MOUNTED)
      }
      return outcome
    }
    announced = null
    return outcome
  }

  function tick(): void {
    if (disposed) return
    deps.onTick?.()
    evaluate()
  }

  function onEvent(): void {
    if (disposed) return
    if (timer === null) {
      // Leading edge: react now, then hold the window so a drag-resize does not
      // evaluate dozens of times per second.
      tick()
      timer = setTimer(() => {
        timer = null
        if (pending) {
          pending = false
          onEvent()
        }
      }, throttleMs)
      return
    }
    pending = true
  }

  const unsubscribe = subscribe(onEvent)

  return {
    evaluate,
    schedule: onEvent,
    dispose(): void {
      disposed = true
      unsubscribe()
      if (timer !== null) {
        clearTimer(timer)
        timer = null
      }
      pending = false
    },
  }
}
