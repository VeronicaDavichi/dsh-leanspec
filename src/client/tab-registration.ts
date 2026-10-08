/**
 * The right-sidebar tab wiring (specs/007 T2.2–T2.3, T2.5–T2.6, REQ-3, REQ-4, REQ-8).
 *
 * This is the only module that touches `ctx.sidebarRight*`, and the place the
 * two surfaces meet. Those services are internal to the pinned host and only
 * *some* versions provide them, so they are never added to the client entry's
 * module-level `inject` array: a hard dependency that went missing would take
 * the whole client plugin down — popup included. Instead the services are
 * requested through the scope form `ctx.inject([...], scope => …)`, every
 * registration is owned by an effect with its disposer, and every failure path
 * ends in "the popup still works" (REQ-8.1, REQ-8.3).
 *
 * The tab is **one-way** (2026-10-08 user decision): we open and focus it, and
 * we never close it — the host's × does that, and the body's unmount is how we
 * learn about it ({@link noteTabUnmounted}). The three-level close degradation
 * (old T2.4/T2.7) is therefore gone; the measured `close(tabId)` face stays
 * recorded in design.md §13 as a host fact we no longer use.
 *
 * The host contract this follows was measured in `app.asar`; see design.md
 * §13 「宿主侧栏 tab 实测契约」.
 */
import { LeanspecSidebarTab, LeanspecTabTitle } from './LeanspecSidebarTab.ts'
import { viewerStore } from './store.ts'
import {
  LEANSPEC_TAB_ID,
  LEANSPEC_TAB_KIND,
  TAB_UNAVAILABLE_REGISTRATION,
  createTabController,
  detectTabCapability,
  isCallable,
  leanspecTabDefinition,
  read,
  readService,
  type TabCapability,
} from './tab-surface.ts'
import { reduceViewer } from './viewer-state.ts'

/**
 * The services a tab needs, injected together: the pinned host provides both
 * from one effect, and a surface that cannot open a tab is not worth wiring.
 */
const REQUIRED_SERVICES = ['sidebarRightTabs', 'sidebarRight']

/** A host function reached through a structurally-typed service object. */
type HostFunction = (this: unknown, ...args: unknown[]) => unknown

function hostFunction(host: unknown, key: string): HostFunction | undefined {
  const value = read(host, key)
  return isCallable(value) ? (value as HostFunction) : undefined
}

/** Result of asking the host to open the LeanSpec tab. */
export type OpenTabResult = { ok: true } | { ok: false; reason: string }

export interface OpenTabOptions {
  /** Reaches the body as `navigation.params` (host contract, JSON-shaped). */
  params?: Record<string, unknown>
  /** Host default is true, which focuses an already-open tab; false opens another. */
  revealIfOpened?: boolean
}

export type LeanspecTabOpener = (options?: OpenTabOptions) => OpenTabResult

/**
 * The host context last handed to {@link applySidebarTab}, the tab we can open
 * right now, and the "unregister everything" escape hatch. Module-level because
 * the header button (T2.3) and the disabled state (T3.5) reach the tab through
 * this module, not through React props.
 */
let host: unknown = null
let opener: LeanspecTabOpener | null = null

const controller = createTabController(() => detectTabCapability(host))

/**
 * Back to "there is no tab surface": no registration to hold, and no tab we can
 * claim is open. Used by every teardown path (unload, rollback, unavailable host).
 */
function markUnavailable(): void {
  controller.markOpen(false)
  controller.noteRegistration(false)
}

/** Forgets every host binding, without running the registrations' cleanups. */
function forgetHost(): void {
  opener = null
  host = null
  // Re-probe without a host, so a lingering `canOpen` cannot make the UI claim
  // "the registration failed" after the plugin has already unloaded.
  controller.refresh()
  markUnavailable()
}

/** The capability as last measured; cached, never re-probed per click (REQ-8.3). */
export function tabCapability(): TabCapability {
  return controller.capability()
}

/** Observe capability changes, for a control that enables/disables itself. */
export function subscribeTabCapability(listener: () => void): () => void {
  return controller.subscribe(listener)
}

/** Whether a LeanSpec tab is believed to be open right now. */
export function leanspecTabIsOpen(): boolean {
  return controller.isOpen()
}

/**
 * Open (or focus) the LeanSpec tab in the right sidebar.
 *
 * Returns a result instead of throwing: the host throws for an unregistered
 * kind and for a Session that is not on screen yet, and neither is a reason for
 * a click handler to blow up (REQ-1.6, REQ-8.2).
 */
export function openLeanspecTab(options?: OpenTabOptions): OpenTabResult {
  if (opener === null) {
    return {
      ok: false,
      reason: controller.capability().unavailableReason ?? TAB_UNAVAILABLE_REGISTRATION,
    }
  }
  return opener(options)
}

export interface SwitchToTabOptions {
  /**
   * Pin the tab as the user's manual choice (REQ-1.7). Only the in-popup
   * 「在右栏打开」 button sets it; the automatic follow (T3.2) and the header's
   * open-by-decision path do not.
   */
  pin?: boolean
}

/**
 * Popup → tab (T2.3, REQ-3.1): open the tab and only *then* dismiss the popup.
 *
 * Order matters. On failure the store is untouched, so the popup the user is
 * looking at stays exactly where it was and the caller can show the reason
 * (REQ-8.2) — never a blank panel.
 *
 * `revealIfOpened` is deliberately left to the host default (`true`): an
 * already-open tab is focused instead of duplicated (REQ-1.2, REQ-4.2).
 */
export function switchToTab(options: SwitchToTabOptions = {}): OpenTabResult {
  const result = openLeanspecTab()
  if (!result.ok) return result
  // One store write for both effects: the surface moves, and (only for a manual
  // click) the choice is pinned. `set-surface` itself clears a stale pin.
  let next = reduceViewer(viewerStore.getState(), { type: 'set-surface', surface: 'tab' })
  if (options.pin === true) next = reduceViewer(next, { type: 'set-pinned', pinned: true })
  viewerStore.setState(next)
  return result
}

/**
 * The tab body mounted: the host is rendering our pane, so the tab owns the
 * panel from here on (T2.5, REQ-3.3).
 *
 * This is the authoritative "the tab exists" signal in both directions — the
 * host mounts the body when the tab becomes visible and unmounts it when the
 * tab is closed. Mounting therefore also takes the panel back from the popup:
 * with the surface set to `tab`, the popup's render condition fails and it
 * steps aside instead of showing a second panel next to the sidebar.
 */
export function noteTabMounted(): void {
  controller.markOpen(true)
  const current = viewerStore.getState()
  // Mounting is the host's doing, not a user move: it must not revoke the pin
  // that the in-popup 「在右栏打开」 just set (REQ-1.7). Only closing the panel
  // (host ×, or the popup going away) ends a pinned choice.
  let next = reduceViewer(current, { type: 'set-surface', surface: 'tab' })
  if (current.pinned) next = reduceViewer(next, { type: 'set-pinned', pinned: true })
  viewerStore.setState(next)
}

/**
 * The tab body left the DOM: the host closed its tab (×) or the plugin is
 * unloading (REQ-4.1, REQ-4.2).
 *
 * Only the host can close a tab, so this is the one moment we learn it is gone.
 * Resetting the surface is what lets the *popup* render again next time the
 * header button is clicked, with the selection and the draft still in the store
 * (REQ-4.2) — and it clears the pin, because a closed panel is a fresh start
 * (REQ-1.7).
 */
export function noteTabUnmounted(): void {
  controller.markOpen(false)
  viewerStore.setState(reduceViewer(viewerStore.getState(), {
    type: 'set-surface',
    surface: 'popup',
  }))
}

/**
 * Wires the tab type into the host, if the host can take it.
 *
 * @param ctx - the plugin context (`unknown` on purpose: the services are
 *   probed structurally, and an older host simply has no `inject`).
 * @returns a disposer that clears every registration made here.
 */
export function applySidebarTab(ctx: unknown): () => void {
  host = ctx
  controller.refresh()
  const inject = hostFunction(ctx, 'inject')
  if (inject === undefined) {
    // No scope form: the services cannot be requested safely, so the plugin
    // stays popup-only instead of risking a load failure.
    forgetHost()
    return () => {
      forgetHost()
    }
  }

  let disposeScope: (() => void) | undefined
  try {
    const returned = inject.call(ctx, REQUIRED_SERVICES, (scope: unknown) => {
      bindSidebarTab(scope)
    })
    if (isCallable(returned)) disposeScope = returned as () => void
  } catch {
    forgetHost()
  }

  return () => {
    if (disposeScope !== undefined) {
      try {
        disposeScope()
      } catch {
        // Unloading twice is not an error.
      }
    }
    forgetHost()
  }
}

/**
 * Registers the type, its body and its chip title once the services exist.
 *
 * Registration order is part of the contract: the host resolves both keyed
 * seats by the *definition's* id, so the definition goes first.
 */
function bindSidebarTab(scope: unknown): void {
  const cleanups: Array<() => void> = []
  const rollback = (): void => {
    for (const cleanup of cleanups.splice(0).reverse()) {
      try {
        cleanup()
      } catch {
        // A failing cleanup must not mask the original failure.
      }
    }
    opener = null
    // `host` stays: the services may exist while a seat refused us, and the
    // reason the UI should show is then "registration failed", not "no host".
    markUnavailable()
  }

  try {
    const tabs = readService(scope, 'sidebarRightTabs')
    const sidebar = readService(scope, 'sidebarRight')
    const slots = readService(scope, 'slots')
    const registerType = hostFunction(tabs, 'register')
    const openTab = hostFunction(sidebar, 'openTab')
    const injectSlot = hostFunction(slots, 'inject')
    const registerSeat = hostFunction(slots, 'register')
    const effect = hostFunction(scope, 'effect')
    if (
      registerType === undefined
      || openTab === undefined
      || injectSlot === undefined
      || registerSeat === undefined
      || effect === undefined
    ) {
      rollback()
      return
    }

    // Both services are here now, so this is the probe that tells the truth
    // about `canOpen`; the result is cached for the UI (REQ-8.3).
    host = scope
    controller.refresh()

    const own = (callback: () => unknown, label: string): (() => void) => {
      const dispose = effect.call(scope, callback, label)
      return isCallable(dispose) ? (dispose as () => void) : () => undefined
    }
    const seat = (name: string, component: unknown): (() => void) =>
      own(() => injectSlot.call(slots, name, () => registerSeat.call(slots, {
        name,
        key: LEANSPEC_TAB_ID,
      }, component)), `leanspec: ${name}`)

    cleanups.push(own(
      () => registerType.call(tabs, leanspecTabDefinition()),
      'leanspec: sidebar tab type',
    ))
    cleanups.push(seat('sidebar.right.pane.tab', LeanspecSidebarTab))
    cleanups.push(seat('sidebar.right.pane.tab.title', LeanspecTabTitle))
    cleanups.push(own(() => {
      opener = createOpener(sidebar, openTab)
      return () => {
        opener = null
      }
    }, 'leanspec: sidebar tab opener'))
    // Unloading must leave the UI without a tab surface (REQ-4.3 / T2.6).
    cleanups.push(own(() => () => {
      markUnavailable()
    }, 'leanspec: sidebar tab availability'))
    controller.noteRegistration(true)
  } catch {
    rollback()
  }
}

/** The real `openTab` call, bound to the service object it came from. */
function createOpener(sidebar: unknown, openTab: HostFunction): LeanspecTabOpener {
  return (options?: OpenTabOptions): OpenTabResult => {
    const args: Record<string, unknown> = { params: options?.params ?? {} }
    if (options?.revealIfOpened !== undefined) args.revealIfOpened = options.revealIfOpened
    try {
      openTab.call(sidebar, LEANSPEC_TAB_KIND, args)
      controller.markOpen(true)
      return { ok: true }
    } catch (error: unknown) {
      return { ok: false, reason: error instanceof Error ? error.message : '右栏标签打开失败' }
    }
  }
}
