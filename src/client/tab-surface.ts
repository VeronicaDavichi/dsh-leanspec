/**
 * The right-sidebar tab capability, and the controller that tracks it.
 *
 * Pure module: no DOM, no React, no host imports — the host services are
 * internal to DSH and are therefore *probed* structurally instead of imported.
 * Everything here is unit-testable with plain objects (test/tab-surface.test.ts).
 *
 * The tab is one-way on purpose (2026-10-08 user decision): we open and focus
 * it, never close it. The measured `close(tabId)` service face and the
 * three-level close degradation this module used to carry are therefore gone;
 * the measurement itself stays recorded in design.md §13.
 *
 * See specs/007-dual-surface-and-draggable-split (REQ-3, REQ-4.1, REQ-8).
 */

/** Where the LeanSpec panel is rendered. */
export type Surface = 'popup' | 'tab'

/**
 * Identity of the tab type LeanSpec contributes.
 *
 * The host makes the `id` the key of both keyed seats and refuses a second
 * registration of the same one, so it is a package-style name — deliberately
 * *not* under the reserved `@deepseek-ai` prefix, which belongs to first-party
 * packages (measured in `app.asar`: `SidebarRightTabRegistry.register`).
 */
export const LEANSPEC_TAB_ID = 'dsh-leanspec'

/** The page kind the tab is opened by. Page types carry no resource patterns. */
export const LEANSPEC_TAB_KIND = 'leanspec'

/** Chip text, and the fallback the host captures when the tab opens. */
export const LEANSPEC_TAB_TITLE = 'LeanSpec'

/** Reason shown when the pinned host has no right-sidebar tab services (REQ-8.2). */
export const TAB_UNAVAILABLE_HOST = '当前宿主版本不支持右栏标签'

/** Reason shown when the services exist but our registration did not take. */
export const TAB_UNAVAILABLE_REGISTRATION = '右栏标签未能注册'

/** The tab type's static declaration, shaped exactly as the host reads it. */
export interface LeanspecTabDefinition {
  id: string
  kind: string
  /** The host calls this with the page address and captures the result. */
  title: (address: string) => string
}

/**
 * The tab type we register.
 *
 * A *page* type: `patterns` and `canOpen` are consulted only for resource
 * addresses, and `priority` is omitted on purpose so the host's own
 * `DEFAULT_BAND` (`"extension"` — measured, not assumed) decides the band.
 */
export function leanspecTabDefinition(): LeanspecTabDefinition {
  return {
    id: LEANSPEC_TAB_ID,
    kind: LEANSPEC_TAB_KIND,
    title: () => LEANSPEC_TAB_TITLE,
  }
}

export interface TabCapability {
  /** The host exposed both a tab-type registry and an `openTab` entry point. */
  canOpen: boolean
  /** The type, its body and its chip title really are registered (T2.2). */
  registered: boolean
  /** The tab surface may be offered: host shape *and* our registration hold. */
  available: boolean
  /** Why the tab surface is unavailable, for a disabled control (REQ-8.2). */
  unavailableReason?: string
}

export const NO_TAB_CAPABILITY: TabCapability = {
  canOpen: false,
  registered: false,
  available: false,
  unavailableReason: TAB_UNAVAILABLE_HOST,
}

/**
 * Availability from the two facts that decide it, with the sentence a disabled
 * control shows instead of going silent (T3.5).
 */
export function tabAvailability(
  input: { canOpen: boolean; registered: boolean },
): { available: boolean; unavailableReason: string | undefined } {
  if (input.canOpen && input.registered) return { available: true, unavailableReason: undefined }
  return {
    available: false,
    unavailableReason: input.canOpen ? TAB_UNAVAILABLE_REGISTRATION : TAB_UNAVAILABLE_HOST,
  }
}

/** The slice of `ctx` this module reads. Structural on purpose: the names are
 *  internal to the pinned host, so a version that lacks them must degrade, not
 *  crash (REQ-8.3). */
export interface TabHostLike {
  sidebarRight?: unknown
  sidebarRightTabs?: unknown
}

/** Reads a property without trusting it: getters may throw, values may be odd. */
export function read(host: unknown, key: string): unknown {
  try {
    if (host === null || typeof host !== 'object') return undefined
    return (host as Record<string, unknown>)[key]
  } catch {
    return undefined
  }
}

export function isCallable(value: unknown): boolean {
  try {
    return typeof value === 'function'
  } catch {
    return false
  }
}

/**
 * Reads one host *service* the way the host reads it itself: `ctx.get(name)`
 * (the pinned sidebar package probes with it) and then the plain property, for
 * contexts whose `get` is absent or returns nothing for us. Never throws.
 */
export function readService(host: unknown, key: string): unknown {
  const get = read(host, 'get')
  if (isCallable(get)) {
    try {
      const viaGet = (get as (this: unknown, name: string) => unknown).call(host, key)
      if (viaGet !== undefined) return viaGet
    } catch {
      // An older or hostile `get` falls through to the property read.
    }
  }
  return read(host, key)
}

/**
 * Probes the host for the pieces a right-sidebar tab needs. Never throws: a
 * missing or hostile `ctx` simply yields "no tab", which keeps the popup
 * working on its own (REQ-8.1, REQ-8.3).
 *
 * `registered` is false here: this probe answers "could the host host a tab",
 * and only the registration itself (T2.2) can answer the rest.
 */
export function detectTabCapability(ctx: unknown): TabCapability {
  try {
    const registry = readService(ctx, 'sidebarRightTabs')
    const sidebar = readService(ctx, 'sidebarRight')
    const canOpen = isCallable(read(registry, 'register')) && isCallable(read(sidebar, 'openTab'))
    return {
      canOpen,
      registered: false,
      ...tabAvailability({ canOpen, registered: false }),
    }
  } catch {
    return NO_TAB_CAPABILITY
  }
}

export interface TabController {
  /** The capability as last measured. */
  capability(): TabCapability
  /** Whether a LeanSpec tab is believed to be open right now. */
  isOpen(): boolean
  markOpen(open: boolean): void
  /**
   * Records the outcome of the real registration: holding the disposers makes
   * the surface `available`.
   */
  noteRegistration(collectedDisposer: boolean): void
  /** Re-probes the host, e.g. on the first user request (REQ-8.1 caching). */
  refresh(): TabCapability
  subscribe(listener: () => void): () => void
}

/**
 * Builds the shared controller. `detect` is injected so the client entry owns
 * every host call while this file stays pure.
 */
export function createTabController(detect: () => TabCapability): TabController {
  let capability = detect()
  let open = false
  const listeners = new Set<() => void>()

  function notify(): void {
    for (const listener of [...listeners]) listener()
  }

  function set(next: TabCapability): void {
    const changed = next.canOpen !== capability.canOpen
      || next.registered !== capability.registered
      || next.available !== capability.available
      || next.unavailableReason !== capability.unavailableReason
    capability = next
    if (changed) notify()
  }

  return {
    capability: () => capability,
    isOpen: () => open,
    markOpen(next: boolean): void {
      if (next === open) return
      open = next
      notify()
    },
    noteRegistration(collectedDisposer: boolean): void {
      const availability = tabAvailability({
        canOpen: capability.canOpen,
        registered: collectedDisposer,
      })
      set({
        ...capability,
        registered: collectedDisposer,
        available: availability.available,
        unavailableReason: availability.unavailableReason,
      })
    },
    refresh(): TabCapability {
      set(detect())
      return capability
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
