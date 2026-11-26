# 实现任务：弹窗可调长宽

> 任务引用 [requirements.md](./requirements.md) 的 REQ-N；设计依据见 [design.md](./design.md)。
> 完成定义：代码 + 验证命令通过 + 无遗留监听/注册。

---

## Phase 0：前置确认

- [x] T0.1 明确 E2E / 原型豁免 —— 本仓库无 `e2e/`、无 `harness/`，沿用 007 已记录的豁免（README「硬规则偏离说明」），替代验证 = `node --test` + CSS 量测 + 构建
- [x] T0.2 冻结决策确认（D-1…D-8）—— 用户 2026-11-26 明确「可编辑长宽 + 对所有会话生效」，其余按推荐值落成冻结项

---

## Phase 1：尺寸模型与状态（P1）

- [x] T1.1 [REQ-2.1][REQ-2.3][REQ-4.3] `surface.ts` 增加 `PanelSize`、最小/绝对上限、`PANEL_STEP`、`PANEL_STORAGE_KEY`
  - 内容：`clampPanel(size, limits)`、`panelFromDrag(start, dx, dy, limits)`、`readStoredPanel(raw)`
  - 验证：`node --test test/surface.test.ts`

- [x] T1.2 [REQ-3.1][REQ-3.2] `decideSurface` 接受可选 `panel`，默认值保持 007 矩阵逐位一致
  - 内容：`SurfaceDecisionInput.panel?: PanelSize`
  - 验证：`node --test test/surface.test.ts test/popover-metrics.test.ts`

- [x] T1.3 [REQ-4.2] `viewer-state.ts` 增加顶层 `panel` 与 `set-panel`
  - 内容：初始 1040×640；相同值返回原对象；不放进 `ProjectSlice`
  - 验证：`node --test test/viewer-state.test.ts`（含 `switchProject` 后尺寸仍在）

- [x] T1.4 [REQ-4.1][REQ-4.4] `store.ts` 增加 `loadPersistedPanel` / `persistPanel`
  - 内容：`localStorage['leanspec.panel']`，异常静默降级
  - 验证：`node --test test/surface.test.ts`（读侧）+ 构建

---

## Phase 2：交互与渲染（P2）

- [x] T2.1 [REQ-1.1][REQ-1.2][REQ-1.4] `LeanspecHeaderAction` 接入手柄拖拽
  - 内容：`popoverRef` 取渲染尺寸作起点；`setPointerCapture`（try 包裹）；拖动期间 `set-dragging`；`clampPanel` 实时夹取
  - 验证：`pnpm typecheck`

- [x] T2.2 [REQ-1.3][REQ-5.1][REQ-5.2] 松手/键盘/双击时持久化
  - 内容：`pointerup` 与 `pointercancel` 结束拖动并 `persistPanel`；方向键 ±16 立即持久化；双击复位默认值
  - 验证：`node --test test/panel-resize.test.ts`

- [x] T2.3 [REQ-6.1][REQ-6.2] `LeanspecHeaderView` 渲染手柄与注入尺寸变量
  - 内容：`--panel-w/--panel-h` 内联；手柄在 dialog 内、`role="button"`、`tabIndex=0`、`aria-label`、`data-leanspec-resize`
  - 验证：`node --test test/panel-resize.test.ts test/tab-views.test.ts`

- [x] T2.4 [REQ-2.2][REQ-2.4][REQ-6.3] `styles.ts`：弹窗尺寸改用变量 + 视口 `min()` 兜底；手柄样式
  - 内容：`width: min(var(--panel-w, 1040px), calc(100vw - 48px))`；手柄 16×16、`cursor: nwse-resize`、`touch-action: none`、焦点环
  - 验证：`node --test test/styles.test.ts test/popover-metrics.test.ts`

---

## Phase 3：回归与验收（P3）

- [x] T3.1 [REQ-7.1][REQ-7.2][REQ-7.4] 回归既有行为
  - 内容：分隔条、右栏标签、卸载清理不受影响
  - 验证：`pnpm test` 全绿（既有 281 例 + 新增）

- [x] T3.2 [A-10] 构建产物
  - 内容：`lib/index.js`、`lib/client.js` 重新构建
  - 验证：`pnpm build && pnpm typecheck && pnpm test`

- [ ] T3.3 人工目视（用户执行）
  - 内容：拖动宽高、双击复位、重开浏览器尺寸仍在、换会话尺寸不变
  - 验证：用户在真实宿主里确认

---

## 完成清单

- [ ] `pnpm build` exit 0
- [ ] `pnpm typecheck` exit 0
- [ ] `pnpm test` 全绿（无 fail）
- [ ] `git diff --check` 干净
- [ ] README / CHANGELOG 记录本次变更
