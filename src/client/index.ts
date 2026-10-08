import { LeanspecHeaderAction } from './LeanspecHeaderAction.ts'
import { applySidebarTab } from './tab-registration.ts'

// Only `slots` is a hard dependency. The right-sidebar services are *not* listed
// here on purpose: an older host that lacks them would fail this whole module's
// load and take the popup down with it. `applySidebarTab` requests them through
// the scope form instead and degrades to popup-only when they are absent
// (REQ-8.1).
export const inject = ['slots']

export const name = 'leanspec-web-viewer-client'

export function apply(ctx: {
  slots: {
    inject: (name: string, factory: () => unknown) => void
    register: (options: Record<string, unknown>, component: unknown) => unknown
  }
  /** Host probe, the same one the first-party code uses: absent means "no tab". */
  get?: (name: string) => unknown
}): void {
  /**
   * The header needs "is a Session on screen in the right sidebar" (REQ-1.6) and
   * receives it the way first-party occupants do: as an injected hook
   * (`hooks: { sidebarMounted: ctx.sidebarRight.mounted }`, measured in ui-plan).
   *
   * `ctx.get` is used instead of `ctx.sidebarRight` because the service is not a
   * declared dependency — reaching for it directly would throw on a host without
   * a right sidebar, which is exactly the host this plugin must keep working on.
   */
  const injectMountedHook = (): Record<string, unknown> => {
    try {
      const sidebar = ctx.get?.('sidebarRight') as { mounted?: unknown } | undefined
      if (sidebar?.mounted === undefined) return {}
      return { hooks: { sidebarMounted: sidebar.mounted } }
    } catch {
      // A hostile or reshaped `get` must not break the header control.
      return {}
    }
  }

  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
    name: 'conversation.session.header.utilities',
    id: 'leanspec-web-viewer',
    order: 10,
    label: 'LeanSpec',
    inject: () => injectMountedHook(),
  }, LeanspecHeaderAction))

  // T2.2: the right-sidebar tab type, its body and its chip title. The returned
  // disposer is ignored: every registration lives inside `ctx.effect` scopes
  // owned by the plugin, so unloading the plugin is enough (REQ-4.3).
  applySidebarTab(ctx)
}
