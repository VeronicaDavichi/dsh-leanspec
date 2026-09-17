import { LeanspecHeaderAction } from './LeanspecHeaderAction.ts'

export const inject = ['slots']

export const name = 'leanspec-web-viewer-client'

export function apply(ctx: {
  slots: {
    inject: (name: string, factory: () => unknown) => void
    register: (options: Record<string, unknown>, component: unknown) => unknown
  }
}): void {
  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
    name: 'conversation.session.header.utilities',
    id: 'leanspec-web-viewer',
    order: 10,
    label: 'LeanSpec',
  }, LeanspecHeaderAction))
}
