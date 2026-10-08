import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ImageView, PanelSplitter, TreeNodes, ViewerMain } from '../src/client/LeanspecViewer.ts'
import { SPEC_STATUS_BADGE_CLASS, isSpecRootDir, specStatusBadge } from '../src/client/spec-badge.ts'
import { SPEC_STATUSES, type SpecStatus } from '../src/spec-status.ts'

/**
 * Render-level assertions without a renderer.
 *
 * `TreeNodes` is hook-free, so calling it yields a plain React element tree we
 * can walk. That keeps REQ-1/REQ-4/REQ-5 structural checks in `npm test`
 * without adding react-dom or a browser.
 */
type RenderedElement = { type: unknown; props: Record<string, unknown>; key?: unknown }

function isElement(value: unknown): value is RenderedElement {
  return typeof value === 'object' && value !== null && 'type' in value && 'props' in value
}

function childElements(element: RenderedElement): RenderedElement[] {
  const raw = element.props.children
  const list = Array.isArray(raw) ? raw : [raw]
  return list.filter(isElement)
}

function rowClassOf(element: RenderedElement): string {
  return String(element.props.className ?? '')
}

function rowFor(statusByDir: Record<string, SpecStatus>, nodes?: unknown): RenderedElement {
  const tree = TreeNodes({
    nodes: (nodes ?? [{ name: '001-alpha', path: '001-alpha', kind: 'dir', children: [] }]) as never,
    selected: null,
    expanded: new Set<string>(),
    statusByDir,
    onToggle: () => {},
    onSelect: () => {},
  }) as unknown as RenderedElement
  const row = childElements(tree)[0]
  assert.ok(row !== undefined, 'expected a row element')
  return row
}

function rowButton(row: RenderedElement): RenderedElement {
  const button = childElements(row)[0]
  assert.ok(button !== undefined, 'expected the row button')
  return button
}

function badgeOf(row: RenderedElement): RenderedElement | undefined {
  return childElements(rowButton(row)).find(child => rowClassOf(child).startsWith(SPEC_STATUS_BADGE_CLASS))
}

test('a spec row with a status renders a span badge carrying the short label', () => {
  const row = rowFor({ '001-alpha': 'complete' })
  const badge = badgeOf(row)
  assert.ok(badge !== undefined, 'expected a badge')
  assert.equal(badge.type, 'span')
  assert.equal(badge.props.children, 'done')
  assert.equal(rowClassOf(badge), `${SPEC_STATUS_BADGE_CLASS} ${SPEC_STATUS_BADGE_CLASS}-complete`)
})

test('the row button never gains a nested button', () => {
  const row = rowFor({ '001-alpha': 'in-progress' })
  const button = rowButton(row)
  assert.equal(button.type, 'button')
  for (const child of childElements(button)) {
    assert.notEqual(child.type, 'button')
  }
})

test('the chevron still precedes the badge and the name follows it', () => {
  const row = rowFor({ '001-alpha': 'draft' })
  const kinds = childElements(rowButton(row)).map(child => rowClassOf(child))
  assert.match(kinds[0] ?? '', /dsh-leanspec-chevron/)
  assert.match(kinds[1] ?? '', /dsh-leanspec-spec-status/)
  assert.match(kinds[2] ?? '', /dsh-leanspec-file-name/)
})

/**
 * Regression: the arrow must be geometry, not text.
 *
 * Two different glyphs (one per state) ink differently, which is what made the
 * collapsed and expanded arrows render at different sizes. The element has to
 * stay text-free and carry the state as a class only, because the stylesheet
 * rotates one pseudo-element between the two states — a text child here would
 * reintroduce the per-state advance width the fix removed.
 */
test('the chevron is text-free and carries its state as a class', () => {
  const chevronFor = (expanded: string[]): RenderedElement => {
    const tree = TreeNodes({
      nodes: [{ name: '001-alpha', path: '001-alpha', kind: 'dir', children: [] }] as never,
      selected: null,
      expanded: new Set(expanded),
      statusByDir: {},
      onToggle: () => {},
      onSelect: () => {},
    }) as unknown as RenderedElement
    const button = rowButton(childElements(tree)[0] as RenderedElement)
    const chevron = childElements(button).find(child => rowClassOf(child).includes('dsh-leanspec-chevron'))
    assert.ok(chevron !== undefined, 'expected the chevron')
    return chevron
  }

  const collapsed = chevronFor([])
  const open = chevronFor(['001-alpha'])
  assert.equal(collapsed.type, 'span')
  assert.equal(collapsed.props.children, undefined)
  assert.equal(open.props.children, undefined)
  assert.equal(rowClassOf(collapsed), 'dsh-leanspec-chevron')
  assert.equal(rowClassOf(open), 'dsh-leanspec-chevron is-open')
})

test('a spec without a status renders the bare dash placeholder', () => {
  const badge = badgeOf(rowFor({}))
  assert.ok(badge !== undefined, 'expected the placeholder badge')
  assert.equal(badge.type, 'span')
  assert.equal(badge.props.children, '-')
  assert.equal(rowClassOf(badge), `${SPEC_STATUS_BADGE_CLASS} ${SPEC_STATUS_BADGE_CLASS}-none`)
})

test('a status outside the vocabulary becomes the placeholder, never raw text', () => {
  const status = 'bogus' as unknown as SpecStatus
  const badge = badgeOf(rowFor({ '001-alpha': status }))
  assert.ok(badge !== undefined, 'expected the placeholder badge')
  assert.equal(badge.props.children, '-')
  assert.equal(String(badge.props.children).includes('bogus'), false)
})

test('a prototype key can never masquerade as a status', () => {
  for (const key of ['constructor', '__proto__', 'toString']) {
    const badge = badgeOf(rowFor({ '001-alpha': key as unknown as SpecStatus }))
    assert.equal(badge?.props.children, '-', `expected the placeholder for ${key}`)
  }
})

test('nested and non-spec directories never render a badge', () => {
  const nested = rowFor(
    { '001-alpha': 'complete', '001-alpha/docs': 'complete' },
    [{ name: 'docs', path: '001-alpha/docs', kind: 'dir', children: [] }],
  )
  assert.equal(badgeOf(nested), undefined)

  const plain = rowFor(
    { 'random-folder': 'complete' },
    [{ name: 'random-folder', path: 'random-folder', kind: 'dir', children: [] }],
  )
  assert.equal(badgeOf(plain), undefined)
})

test('the five statuses produce five distinct badges', () => {
  const seen = new Map<string, string>()
  for (const status of SPEC_STATUSES) {
    const badge = specStatusBadge(status)
    assert.ok(badge !== null, `expected a badge for ${status}`)
    assert.equal(seen.has(badge.className), false, `duplicate class for ${status}`)
    seen.set(badge.className, badge.label)
  }
  assert.deepEqual([...seen.values()], ['draft', 'plan.', 'WIP', 'done', 'arch.'])
  assert.equal(
    seen.has(`${SPEC_STATUS_BADGE_CLASS} ${SPEC_STATUS_BADGE_CLASS}-none`),
    false,
    'the placeholder class must not collide with a status class',
  )
})

test('spec root detection only accepts top-level NNN-name directories', () => {
  assert.equal(isSpecRootDir('001-alpha'), true)
  assert.equal(isSpecRootDir('1000-long-name'), true)
  assert.equal(isSpecRootDir('001-alpha/docs'), false)
  assert.equal(isSpecRootDir('random-folder'), false)
  assert.equal(isSpecRootDir('01-too-short'), false)
  assert.equal(isSpecRootDir(''), false)
})

test('a badge descriptor carries data only, never a handler', () => {
  assert.deepEqual(Object.keys(specStatusBadge('draft')).sort(), ['className', 'label'])
  assert.deepEqual(Object.keys(specStatusBadge(undefined)).sort(), ['className', 'label'])
  assert.equal(specStatusBadge(undefined).label, '-')
})

/**
 * `PanelSplitter` is hook-free too, so the split's ARIA contract (REQ-7.2) is
 * asserted the same way — by calling the component, not by mounting it.
 */
function splitterProps(overrides: Record<string, unknown> = {}): Parameters<typeof PanelSplitter>[0] {
  return {
    value: 280,
    max: 420,
    dragging: false,
    onPointerDown: () => {},
    onPointerMove: () => {},
    onPointerUp: () => {},
    onKeyDown: () => {},
    onReset: () => {},
    ...overrides,
  } as Parameters<typeof PanelSplitter>[0]
}

test('the splitter exposes the separator ARIA contract (REQ-7.2)', () => {
  const element = PanelSplitter(splitterProps({ value: 300 })) as unknown as RenderedElement
  assert.equal(element.props.role, 'separator')
  assert.equal(element.props['aria-orientation'], 'vertical')
  assert.equal(element.props['aria-valuemin'], 180)
  assert.equal(element.props['aria-valuemax'], 420)
  assert.equal(element.props['aria-valuenow'], 300)
  assert.equal(element.props.tabIndex, 0, 'keyboard users must be able to reach it (REQ-7.1)')
})

test('the splitter announces the reachable maximum, not the constant', () => {
  const narrow = PanelSplitter(splitterProps({ value: 180, max: 340 })) as unknown as RenderedElement
  assert.equal(narrow.props['aria-valuemax'], 340, 'a narrow panel cannot offer 420')
  assert.equal(narrow.props['aria-valuenow'], 180)
})

test('the splitter marks its drag state for styling', () => {
  const idle = PanelSplitter(splitterProps()) as unknown as RenderedElement
  const active = PanelSplitter(splitterProps({ dragging: true })) as unknown as RenderedElement
  assert.equal(idle.props.className, 'dsh-leanspec-splitter')
  assert.equal(active.props.className, 'dsh-leanspec-splitter is-dragging')
})

test('the splitter routes every gesture through its props', () => {
  const calls: string[] = []
  const element = PanelSplitter(splitterProps({
    onPointerDown: () => { calls.push('down') },
    onPointerMove: () => { calls.push('move') },
    onPointerUp: () => { calls.push('up') },
    onKeyDown: () => { calls.push('key') },
    onReset: () => { calls.push('reset') },
  })) as unknown as RenderedElement
  const fire = (name: string): void => {
    const handler = element.props[name] as (() => void) | undefined
    assert.ok(typeof handler === 'function', `expected a ${name} handler`)
    handler()
  }
  fire('onPointerDown')
  fire('onPointerMove')
  fire('onPointerUp')
  fire('onPointerCancel')
  fire('onKeyDown')
  fire('onDoubleClick')
  assert.deepEqual(calls, ['down', 'move', 'up', 'up', 'key', 'reset'], 'cancel ends the drag like up')
})

/**
 * `ViewerMain` and `ImageView` are hook-free too, so the image branch, the
 * disabled-controls contract and the markdown src rewrite are asserted the same
 * way — by calling the components, with no renderer and no DOM.
 */
function walk(root: RenderedElement): RenderedElement[] {
  const found: RenderedElement[] = []
  for (const child of childElements(root)) {
    if (typeof child.type === 'function') {
      // No renderer here: a hook-free child component is expanded by calling it,
      // which is exactly what React would do with the element it returned.
      const expanded = (child.type as (props: unknown) => RenderedElement)(child.props)
      found.push(expanded, ...walk(expanded))
      continue
    }
    found.push(child, ...walk(child))
  }
  return found
}

function byClass(root: RenderedElement, className: string): RenderedElement[] {
  return walk(root).filter(el => String(el.props.className ?? '').split(' ').includes(className))
}

function byType(root: RenderedElement, type: string): RenderedElement[] {
  return walk(root).filter(el => el.type === type)
}

function textOf(element: RenderedElement): string {
  const raw = element.props.children
  const list = Array.isArray(raw) ? raw : [raw]
  return list.map(child => (isElement(child) ? textOf(child) : String(child ?? ''))).join('')
}

/** The toolbar chips, identified by the mode each one switches to. */
function viewChips(root: RenderedElement): RenderedElement[] {
  return walk(root).filter(el => typeof el.props['data-leanspec-view-mode'] === 'string')
}

function modesOf(root: RenderedElement): unknown[] {
  return viewChips(root).map(el => el.props['data-leanspec-view-mode'])
}

function chipFor(root: RenderedElement, mode: string): RenderedElement {
  const chip = viewChips(root).find(el => el.props['data-leanspec-view-mode'] === mode)
  assert.ok(chip !== undefined, `expected a ${mode} chip`)
  return chip
}

function saveButton(root: RenderedElement): RenderedElement {
  const button = byClass(root, 'dsh-leanspec-save')[0]
  assert.ok(button !== undefined, 'expected the save button')
  return button
}

function innerHtmlOf(root: RenderedElement, className: string): string {
  const host = byClass(root, className)[0]
  assert.ok(host !== undefined, `expected .${className}`)
  const html = host.props.dangerouslySetInnerHTML as { __html?: string } | undefined
  return html?.__html ?? ''
}

function pane(overrides: Record<string, unknown> = {}): RenderedElement {
  return ViewerMain({
    selected: null,
    mode: 'preview',
    projectRoot: '/tmp/my project',
    content: '',
    draft: '',
    saving: false,
    saved: false,
    showTree: true,
    imageError: null,
    imageNonce: 0,
    onMode: () => {},
    onDraft: () => {},
    onSave: () => {},
    onImageError: () => {},
    onImageRetry: () => {},
    ...overrides,
  } as Parameters<typeof ViewerMain>[0]) as unknown as RenderedElement
}

test('an image keeps its edit chip and both controls are disabled (REQ-5)', () => {
  const rendered = pane({ selected: '001-alpha/assets/shot.png' })
  assert.deepEqual(modesOf(rendered), ['preview', 'edit'], 'the edit chip stays, it is not hidden')
  const edit = chipFor(rendered, 'edit')
  assert.equal(textOf(edit), '编辑')
  assert.equal(edit.props.disabled, true, 'a disabled chip is the visible half of the guard')
  assert.equal(chipFor(rendered, 'preview').props.disabled, false)
  assert.equal(saveButton(rendered).props.disabled, true, 'an image must never be written back')
})

test('a document keeps an enabled edit chip and a disabled save button', () => {
  const rendered = pane({ selected: '001-alpha/README.md', content: '# Hello', draft: '# Hello' })
  assert.deepEqual(modesOf(rendered), ['preview', 'edit'])
  assert.equal(chipFor(rendered, 'edit').props.disabled, false)
  assert.equal(saveButton(rendered).props.disabled, true, 'nothing changed yet')
  const dirty = pane({ selected: '001-alpha/README.md', content: '# Hello', draft: '# Edited' })
  assert.equal(saveButton(dirty).props.disabled, false)
})

test('an image preview renders an img against the raw endpoint, not its text (REQ-4)', () => {
  const rendered = pane({ selected: '001-alpha/assets/a b.png' })
  const img = byType(rendered, 'img')[0]
  assert.ok(img !== undefined, 'expected the image element')
  const src = String(img.props.src)
  const parsed = new URL(src, 'http://127.0.0.1')
  assert.equal(parsed.pathname, '/leanspec-viewer/raw')
  assert.equal(parsed.searchParams.get('root'), '/tmp/my project')
  assert.equal(parsed.searchParams.get('path'), '001-alpha/assets/a b.png')
  // The bytes never take the text route: no <pre>, no editor.
  assert.equal(byClass(rendered, 'dsh-leanspec-source').length, 0)
  assert.equal(byClass(rendered, 'dsh-leanspec-editor').length, 0)
  assert.equal(byClass(rendered, 'dsh-leanspec-preview').length, 0)

  // Clicking the picture opens the same URL in a new tab.
  const link = byType(rendered, 'a')[0]
  assert.ok(link !== undefined, 'expected the open-in-new-tab link')
  assert.equal(link.props.href, src)
  assert.equal(link.props.target, '_blank')
})

test('only an svg offers the source chip (REQ-6)', () => {
  const svg = pane({ selected: '001-alpha/assets/logo.svg', content: '<svg/>' })
  assert.deepEqual(modesOf(svg), ['preview', 'source', 'edit'])
  assert.equal(chipFor(svg, 'edit').props.disabled, true, 'an svg is an image and may not be edited')
  assert.equal(byType(svg, 'img').length, 1, 'svg previews as a picture by default')

  const bitmap = pane({ selected: '001-alpha/assets/shot.png' })
  assert.deepEqual(modesOf(bitmap), ['preview', 'edit'])

  // The source chip carries the selector the interaction contract names.
  assert.equal(chipFor(svg, 'source').props['data-leanspec-view-mode'], 'source')
})

test('the svg source mode swaps the picture for read-only escaped text (REQ-6)', () => {
  const rendered = pane({
    selected: '001-alpha/assets/logo.svg',
    mode: 'source',
    content: '<svg onload="alert(1)"><circle/></svg>',
  })
  assert.equal(byType(rendered, 'img').length, 0, 'source mode must not fetch bytes')
  const source = byClass(rendered, 'dsh-leanspec-source')[0]
  assert.ok(source !== undefined, 'expected the read-only source block')
  assert.equal(source.type, 'pre')
  const html = innerHtmlOf(rendered, 'dsh-leanspec-source')
  assert.match(html, /&lt;svg/)
  assert.doesNotMatch(html, /<svg/, 'the XML is shown as text, never as markup')
  assert.equal(String(chipFor(rendered, 'source').props.className).includes('is-active'), true)
})

test('a failed image shows an alert and a retry button instead of a broken image (REQ-8)', () => {
  let retried = 0
  const rendered = pane({
    selected: '001-alpha/assets/huge.png',
    imageError: '图片过大（超过 20MB），未加载',
    onImageRetry: () => { retried += 1 },
  })
  assert.equal(byType(rendered, 'img').length, 0, 'no broken-image glyph')
  const alert = byClass(rendered, 'dsh-leanspec-image-error')[0]
  assert.ok(alert !== undefined, 'expected the failure state')
  assert.equal(alert.props.role, 'alert')
  assert.match(textOf(alert), /20MB/)

  const retry = walk(rendered).find(el => el.props['data-leanspec-image-retry'] === 'true')
  assert.ok(retry !== undefined, 'expected the retry button')
  assert.equal(retry.type, 'button')
  ;(retry.props.onClick as () => void)()
  assert.equal(retried, 1)
})

test('the retry button reloads through the image key, and failures are reported', () => {
  const failures: string[] = []
  const loaded = ImageView({
    src: '/leanspec-viewer/raw?path=a.png',
    alt: 'a.png',
    error: null,
    nonce: 0,
    onError: () => { failures.push('error') },
    onRetry: () => {},
  }) as unknown as RenderedElement
  const img = byType(loaded, 'img')[0]
  assert.ok(img !== undefined, 'expected the image element')
  assert.equal(img.key, '/leanspec-viewer/raw?path=a.png#0', 'the key is what a retry changes')
  assert.equal(img.props.className, 'dsh-leanspec-image')
  ;(img.props.onError as () => void)()
  assert.deepEqual(failures, ['error'], 'a load failure must reach the caller, which asks why')

  const reloaded = ImageView({
    src: '/leanspec-viewer/raw?path=a.png',
    alt: 'a.png',
    error: null,
    nonce: 1,
    onError: () => {},
    onRetry: () => {},
  }) as unknown as RenderedElement
  assert.equal(byType(reloaded, 'img')[0]?.key, '/leanspec-viewer/raw?path=a.png#1')
})

test('markdown preview rewrites only the relative image sources (REQ-7, T3.3)', () => {
  const rendered = pane({
    selected: '008-image/README.md',
    content: '# Hi\n\n![shot](./assets/shot.png)\n\n![web](https://example.com/a.png)\n',
  })
  const html = innerHtmlOf(rendered, 'dsh-leanspec-preview')
  const srcs = [...html.matchAll(/src="([^"]*)"/g)].map(match => match[1] ?? '')
  assert.equal(srcs.length, 2)
  const parsed = new URL(srcs[0] ?? '', 'http://127.0.0.1')
  assert.equal(parsed.pathname, '/leanspec-viewer/raw')
  assert.equal(parsed.searchParams.get('root'), '/tmp/my project')
  assert.equal(parsed.searchParams.get('path'), '008-image/assets/shot.png')
  assert.equal(srcs[1], 'https://example.com/a.png', 'an absolute url is left alone')
})

test('a preview with no selection still offers the same disabled toolbar', () => {
  const rendered = pane({ selected: null })
  assert.deepEqual(modesOf(rendered), ['preview', 'edit'])
  assert.equal(chipFor(rendered, 'edit').props.disabled, true)
  assert.equal(saveButton(rendered).props.disabled, true)
  assert.equal(textOf(rendered).includes('选择一个文件。'), true)
})
