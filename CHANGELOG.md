# Changelog

## Unreleased

### Resizable popover (specs/010)

- The popover now has a bottom-right corner handle: drag to change width and
  height together (600×420 floor, viewport ceiling), double-click to reset to
  1040×640, arrow keys for a 16px step.
- The size persists in `localStorage['leanspec.panel']` and is **shared by every
  session and project**, not parked per workspace.
- `decideSurface` reads the user-set size, so a smaller popover can open in a
  narrower window; the untouched default keeps 007's 1088×712 boundary exactly.
- The right-sidebar tab is unaffected: its width stays the host pane's.

## 0.2.1 (2026-11-11)

### Packaging fixes

- `dsh.client.inject` now names the host UI packages that own the seats this
  plugin fills: `@deepseek-ai/dsh-client-ui-conversation` (the session header
  utilities beside Session log) and `@deepseek-ai/dsh-client-ui-sidebar-right`
  (the optional right-sidebar tab). Verified against DeepSeek Harness
  0.2.2-rc.1; the previous `@deepseek-ai/dsh-client-runtime` name is not a
  package in that release.
- `marked` moved to `devDependencies`: the shipped `lib/client.js` already
  inlines it, and the Host entry (`lib/index.js`) never imports it.
- Added `publishConfig.access = public`, and kept `pnpm-lock.yaml` as the only
  lockfile.
- Added a release-contract test and documented the npm install path.

## 0.2.0

> Version numbers track DeepSeek Harness. This entry folds in the pre-0.2.0
> history (listed as 0.2.1 / 0.2.0 / 0.1.0 in the README before 2026-10-08);
> the README carries the full, current list.

### Origin: dsh-openspec (kept for traceability)

- Add a DeepSeek Harness Web UI plugin that opens the current project's `openspec/` directory from the session header.
- List every file under `openspec/` (config, specs, changes, archive) without a configured project path.
- Preview Markdown, edit text files, and save only after the Host confirms the write.
- Keep the selected file path on its own left-aligned line below the preview, edit, and save buttons.
