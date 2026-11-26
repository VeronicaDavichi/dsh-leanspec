# 设计：弹窗可调长宽

> 依据 [requirements.md](./requirements.md) 与 [README.md](./README.md) 的冻结决策 D-1…D-8。

---

## 1. 现状

| 关注点 | 现在 | 位置 |
|--------|------|------|
| 弹窗尺寸常量 | `PANEL_WIDTH = 1040` / `PANEL_HEIGHT = 640` | `src/client/surface.ts` |
| 形态判定 | `decideSurface` 用上面两个常量算「窗口够不够大」 | `src/client/surface.ts` |
| 实际渲染尺寸 | `width: min(1040px, calc(100vw - 48px))`、`height: min(640px, calc(100vh - var(--anchor, 48px) - 24px))` | `src/client/styles.ts` |
| 弹窗元素 | `LeanspecHeaderView` 里一个 `role="dialog"` 的 div | `src/client/LeanspecHeaderAction.ts` |
| 状态 | 模块级 `viewerStore`，UI 偏好（split/surface/pin）在顶层，项目相关进 `projects` 分片 | `src/client/viewer-state.ts`、`store.ts` |
| 已有先例 | 目录分隔条：pointer capture + `clampSplit` + `localStorage['leanspec.split']` | `LeanspecViewer.ts`、`surface.ts`、`store.ts` |

本 Spec 复用这套先例，把「尺寸」也变成 store 里的一个 UI 偏好。

---

## 2. 尺寸模型（`surface.ts`，纯函数、零 DOM）

```ts
export interface PanelSize { width: number; height: number }

export const PANEL_MIN_WIDTH = 600
export const PANEL_MIN_HEIGHT = 420
/** 存储值的绝对天花板：只防脏数据，真实上限由视口决定。 */
export const PANEL_MAX_WIDTH = 2400
export const PANEL_MAX_HEIGHT = 1600
export const PANEL_STEP = 16
export const PANEL_STORAGE_KEY = 'leanspec.panel'
```

- `clampPanel(size, limits)`：先取整，再按 `[PANEL_MIN_*, 视口上限]` 夹取；视口上限 = `viewportWidth - 2 * edge`、`viewportHeight - anchor - edge`。视口小于最小值时**最小值胜出**（越界交给 CSS 兜底，不产生负值）。
- `panelFromDrag(start, dx, dy, limits)`：`start + delta` 后交给 `clampPanel`。抽出来是因为拖拽数学要能单测，不依赖 React。
- `readStoredPanel(raw)`：解析 `{"width":…,"height":…}`；缺字段、非数字、非有限、超出 `[MIN, MAX_ABS]` 一律回落默认 1040×640。**永不抛异常**（与 `readStoredSplit` 一致）。

`decideSurface` 增加可选 `panel?: PanelSize`，缺省为默认尺寸：

```ts
roomy = viewportWidth  >= (panel?.width  ?? PANEL_WIDTH)  + 2 * edge
     && viewportHeight >= (panel?.height ?? PANEL_HEIGHT) + anchor + edge
```

这样默认值代入后与 007 的判定**逐位相同**（D-8 / REQ-3.2）。

### 为什么不用 `min(存储值, 视口可用)` 判定

若判定用「压小后的实际值」，1087px 视口会得到 `min(1040, 1039) = 1039`，于是 `1087 >= 1039 + 48` 成立 → 判成弹窗，直接推翻 007 的 1087 → 标签矩阵。**判定用存储值、渲染用 CSS 上限**这一分工同时满足 D-4 与 D-8：

- 用户把弹窗调小 → 存储值小 → 窄窗口也能判成弹窗（D-4）
- 用户没调过 → 存储值是默认 → 判定与 007 完全一致（D-8）
- 存储值大于当前屏幕 → 判定为标签（弹窗放不下就是放不下，标签仍然可用），不会出现半个弹窗

---

## 3. 状态与持久化

`ViewerState` 增加顶层字段：

```ts
panel: PanelSize   // 初始 { width: PANEL_WIDTH, height: PANEL_HEIGHT }
```

动作 `{ type: 'set-panel'; width: number; height: number }`，reducer 在值相同的时候返回原对象（避免无意义重渲染）。

**不进 `ProjectSlice`**：`switchProject` 会用分片覆盖顶层字段，但分片里没有 `panel`，所以尺寸天然跨工作区存活（D-5 / REQ-4.2）。测试里钉死这条。

`store.ts` 增加与 split 同构的一对：

```ts
loadPersistedPanel(): PanelSize
persistPanel(size: PanelSize): void   // localStorage 被禁用时静默降级
```

---

## 4. 交互

### 4.1 拖拽

```
pointerdown  → 读 popover.getBoundingClientRect() 作为起点（所见即所调）
             → setPointerCapture，dragging = true
pointermove  → panelFromDrag(start, dx, dy, 视口/锚点) → set-panel
pointerup/-cancel → dragging = false，persistPanel(当前 store 值)
```

- 起点用**渲染尺寸**而不是存储值：窗口被 CSS 压小时，第一次拖动从看到的大小开始，不会突然跳变。
- 弹窗 `right: 0` / `top` 锚定，所以 `dx > 0` = 变宽、`dy > 0` = 变高；两个轴同时生效（REQ-1.1）。
- 拖动期间设 `set-dragging: true`：`planFollow` 已有该守卫（REQ-1.5），尺寸变化不会触发形态切换（REQ-1.2）。
- 只在 `pointerup` 写存储（REQ-1.3），与分隔条一致。

### 4.2 键盘与复位

手柄 `tabIndex=0`，`←/→` 调宽、`↑/↓` 调高，步长 16（`PANEL_STEP`），`preventDefault` 防止页面滚动；键盘调整**立即**持久化（REQ-5.2）。双击复位 1040×640。

### 4.3 手柄的无障碍角色

WAI-ARIA **没有二维 resize handle 的角色**：`separator` 只表达一条轴。这里用 `role="button"` + `aria-label="调整弹窗大小（方向键调宽高，双击复位）"`，把它当一个可聚焦、可键盘操作的控件播报；不假装它是 separator，避免读屏给出错误的轴向提示。这是有意的取舍（D-1 的配套假设）。

---

## 5. CSS

```css
.dsh-leanspec-popover {
  /* 尺寸来自 store，经内联自定义属性注入；var 的第二参数是首帧兜底。 */
  width: min(var(--panel-w, 1040px), calc(100vw - 48px));
  height: min(var(--panel-h, 640px), calc(100vh - var(--anchor, 48px) - 24px));
}
```

- `--panel-w` / `--panel-h` 由 `LeanspecHeaderView` 内联注入（与 `--anchor` 同一处）。
- CSS 的 `min()` 仍然兜底视口：存储值再大也不会越界（REQ-2.4）。
- 手柄：右下角 16×16 透明热区，`cursor: nwse-resize`，`touch-action: none`，一条 `linear-gradient` 斜线作视觉提示，颜色用主题 token；`:focus-visible` 画一圈 outline。

---

## 6. 组件边界

- `LeanspecHeaderAction`（有 hook）：读 store、装载持久化值、持有 `popoverRef` 与拖拽 ref、提供 5 个处理器（down/move/up/keydown/dblclick）。
- `LeanspecHeaderView`（**保持无 hook**）：新增可选 props `panel`、`popoverRef`、`onResize*`；把 `--panel-w/--panel-h` 拼进 dialog 的 style；在 dialog 内渲染手柄。没有这些 props 时行为与现在一致，现有结构测试只需更新 style 断言。
- `LeanspecViewer`、`tab-registration`、右栏标签：**不改**（REQ-7.1 / REQ-7.2）。

---

## 7. 失败与降级

| 情况 | 行为 |
|------|------|
| `localStorage` 禁用/损坏 | 回落默认，面板照常打开，本次会话内仍可拖 |
| 存储值超出绝对值 | 回落默认（不尝试「修」成边界值）|
| 视口小于最小值 | 按最小值渲染，CSS 上限保证不越界 |
| 指针捕获失败（老浏览器）| `setPointerCapture` 包在 try 里；拖拽退化为手柄上的 move 事件 |
| 移动端触摸 | `touch-action: none` 让拖动不被页面滚动吃掉 |

---

## 8. 测试策略

| 层 | 文件 | 内容 |
|----|------|------|
| 纯几何 | `test/surface.test.ts` | `clampPanel` 双向夹取、`panelFromDrag`、`readStoredPanel` 回落、`decideSurface({panel})` 的 800×700 → 弹窗与默认矩阵不变 |
| 状态 | `test/viewer-state.test.ts` | `set-panel` 生效；`switchProject` 后 `panel` 不被分片覆盖（全局作用域）|
| 结构 | `test/panel-resize.test.ts` | 手柄存在、`data-leanspec-resize`、`tabIndex=0`、aria-label、style 注入 `--panel-w/--panel-h`、回调路由 |
| CSS 量测 | `test/popover-metrics.test.ts` | 求值器支持 `--panel-w/--panel-h`；自定义尺寸下判定与真实盒子一致；默认尺寸矩阵不变 |
| 样式 | `test/styles.test.ts` | 弹窗声明使用变量 + 视口上限；手柄规则存在（`touch-action: none`、`cursor: nwse-resize`）|

浏览器手势（真机拖动）不在自动测试内，按 README「硬规则偏离说明」由用户目视确认。
