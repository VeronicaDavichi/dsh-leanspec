# 技术设计：双形态面板 + 可拖拽分栏

> 派生自 [README.md](./README.md) 的概述与冻结决策；需求见 [requirements.md](./requirements.md)；任务见 [tasks.md](./tasks.md)。

---

## 1. 背景与约束

现有实现（`src/client/LeanspecViewer.ts` / `styles.ts`）：

- 单一出口：`.dsh-leanspec-popover`（`position:absolute; right:0; top:calc(100% + 8px)`，`width:min(920px,86vw)`，`height:min(560px,74vh)`）
- 内部：`.dsh-leanspec-aside` **固定 280px**（`min-width:220px` 实际从不生效，因为 `.dsh-leanspec-main` 有 `min-width:0`，所有收缩都被主区吸收）
- 状态全在组件内部（`useState` / reducer），没有跨实例共享的 store
- 插件目前只在 `conversation.session.header.utilities` 注册一个入口

**硬约束**

| 约束 | 来源 |
|------|------|
| 只能用宿主公开插槽 / 服务，不得 patch 私有 DOM | 插件开发契约（dsh.pub/develop-plugin.md）|
| 样式零硬编码 hex，只用 `--dsw-*` token | 仓库既有样式测试（`test/styles.test.ts`）|
| 每个注册 / 监听 / 定时器都要能干净卸载 | 插件开发契约「Definition of done」|
| `npm test` / `npm run typecheck` / `npm run build` 全绿 | 仓库既有质量门 |

---

## 2. 表面选型（含宿主契约证据）

三个候选表面，都在**当前安装版本**（`0.1.0-rc.5`，asar 实测）里核查过：

| | ① `conversation.view`（对话 / 轨迹 那条）| ② `sidebar.right.pane.tab` + `.title`（右栏标签）| ③ dockkit panes |
|---|---|---|---|
| 位置 | 对话 / 轨迹 旁边 | 右侧栏（Preview / Review 同类）| 宿主面板体系 |
| 编程打开 | ❌ 只有视图组件拿得到 `openView(view, focus)` prop；全包内**没有** `selectView` / `focusView` / `setActiveView` / `ctx.conversation*` 服务（探针命中 0）| ✅ 文档明写：`ctx.sidebarRight.openTab(...)` | ✅ `dock.focusTab` 系 |
| 标签关闭 × | ❌ 宿主不画：`conversation.view` 的 registerOptions 只有 `id` / `order` / `label` | ✅ 宿主 dock 提供（`dockkit` 有 `tabClose` 悬停态样式）| ✅ 自带 |
| 与聊天并排 | ❌「rendered one at a time」 | ✅ 天然并排 | ✅ |
| 额外白拿 | 跟随会话 | 宿主 dock 的拖拽 / 分屏能力 | 拖拽 + 分屏 + 浮动 |

**① 的契约原文（供追溯）**

```
conversation.view   kind: list   scope: session
doc: "Registered Conversation target Views, rendered one at a time."
occupants: client-ui-chat ChatView id 'chat' / client-ui-trajectory TrajectoryView id 'trajectory'
replaceRisk: none
registerOptions: id(required) / order(optional) / label(optional, string | (() => string))
ownerProps: inspectCall / viewRequest / openView(view, focus) / completeViewRequest
source: packages/client/ui-conversation/src/client/contract/slots.ts:185
```

**结论**：走 **②**，并把 ① 记录为「曾评估但否决」（否决理由 = 关闭能力与编程打开双缺）。

---

## 3. 架构

```
src/client/
├─ store.ts               ← 新增：模块级共享状态 + 订阅（选中文件 / 模式 / 草稿 / 分栏 / 形态 / 目录展开）
├─ surface.ts             ← 新增：纯函数 decideSurface() + 锚点换算 + clampSplit() + readStoredSplit()
├─ surface-follow.ts      ← 新增：planFollow() 纯策略 + createSurfaceFollower()（resize 节流 150ms 接线）
├─ viewer-state.ts        ← 改：ViewerState/ViewerAction（形态、pin、拖拽、目录展开、loadedKey）
├─ LeanspecViewer.ts      ← 改：同一份面板，弹窗与标签两种外壳下都直接渲染（不再接受 variant）
├─ LeanspecHeaderAction.ts← 改：读 store，负责判定形态、单向切换、聚焦、能力回退、锚点注入
├─ tab-surface.ts         ← 新增：能力探测 / 控制器（无关闭能力，见 §7.1）
├─ tab-registration.ts    ← 新增：右栏定义 + 正文 + chip 注册，openTab 包装，挂载/卸载信号
├─ LeanspecSidebarTab.ts  ← 新增：右栏标签正文出口（薄包装，内部就是 LeanspecViewer）
└─ index.ts               ← 改：注册页眉入口 + 右栏标签（定义 + 正文 + chip 标题）
```

**同一份内容两个出口**（2026-10-08 定版）：`LeanspecViewer` 不再区分 variant —— 弹窗外壳由页眉负责画，标签外壳由宿主标签页负责画，所以面板本身在两种形态下**是同一个组件、同样的 DOM**。唯一"形态相关"的东西是入口按钮，而它已经归属页眉：

| 形态 | 外壳 | 切换入口 |
|------|------|----------|
| `popup` | `.dsh-leanspec-popover`（1040×640，圆角 / 边框 / 阴影，页眉画）| 弹窗内「在右栏打开 ⧉」（单向）|
| `tab` | `width/height: 100%`，无圆角无阴影（宿主标签页已提供边界）| **无**（标签内不再有任何切换控件，用户用宿主 × 关闭）|

**store**：模块级单例，`getState()` / `setState(state)` / `subscribe(fn)`；组件用 `useState` + `useEffect(subscribe)` 订阅（不引入 react-dom）。持久化只做**分栏比例**一项（`localStorage`），其余为会话内存态。

**同屏约束**：`store.surface` 记录当前形态，只由两个事实改写 —— 打开成功（→ `tab`）、标签正文挂载/卸载（→ `tab` / `popup`）；页眉按钮在动手前先看 `leanspecTabIsOpen()`，标签活着就只聚焦，绝不叠加第二个面板。

---

## 4. 断点判定（为什么不是 1040 / 640）

判定必须用**按钮自身矩形**，而不是写死常量：

```
anchorBottom = trigger.getBoundingClientRect().bottom      // 实测页眉内 44
popoverTop   = anchorBottom + 8                            // 实测 52
可用高 = window.innerHeight - popoverTop - EDGE(24)
可用宽 = window.innerWidth  - 右内边距(16) - EDGE(24)
decideSurface: 可用宽 ≥ 1040 && 可用高 ≥ 640 → 'popup'，否则 'tab'
```

代回实测数据即可反推阈值的由来：

| 场景 | 推演 | 结果 |
|------|------|------|
| 视口宽 1040 | 左边界 = 1040 − 16 − 1040 = **−16px** | ❌ 越界，所以阈值必须 > 1040 |
| 视口宽 1088 | 左边界 = 1088 − 16 − 1040 = 32px | ✅ 取 1088 |
| 视口高 692 | 底边 = 52 + 640 = 692 | ⚠️ 贴边（0 余量）|
| 视口高 712 | 剩余 = 712 − 692 = 20px | ✅ 取 712 |

> `EDGE = 24`、`右内边距 = 16` 来自现有布局的取值；实现时以按钮矩形 + 常量现算，真机页眉高度不同也不会算错。

**定版与本文旧算术的差异（2026-10-08，T3.1 落地；上级已拍板 712/48）**：本文原按「页眉内 44 + 8 = 52」推导，得到高度阈值 716；上级在 P3 派单里把阈值钉为 **712 = 640 + 48 + 24**，即锚点兜底取 **48**（40px 按钮 + 8px 间隙）。实现取 **712/48**（`SURFACE_MIN_HEIGHT = PANEL_HEIGHT + ANCHOR_FALLBACK + PANEL_EDGE`），宽度阈值同派单为 **1088 = 1040 + 2×24**（本文表格里 1088 那一行是同一结论）。三件事必须写清：

1. **锚点真值仍未测**（T0.3 未完成）：48px 是 `/leanspec-viewer` 根元素下沿 + 8 的**兜底假设**，真机页眉实际高度可能不同。
2. **断点只是「舒适阈值」，不是安全属性**：CSS 侧 `height: min(640px, calc(100vh - var(--anchor) - 24px))` 自己带视口上限，锚点再大也只是让弹窗矮几像素，**绝不会越界**（REQ-2.2 由 CSS 保证，T3.4 量测覆盖）。所以断点取紧一点（712 而非 716）是安全的保守，不是 bug。
3. **真值落地时要一起改**：`ANCHOR_FALLBACK`（surface.ts）与 CSS 的 `var(--anchor, 48px)` 兜底**必须同一次改**，账面上的 712/716 也随之重算 —— 只改一个会让「断点判定」和「真实盒模型」错位。`test/surface.test.ts` 与 `test/popover-metrics.test.ts` 会在同一次运行里指出所有需要同步的地方（后者直接从 CSS 文本取值）。

### 4.1 实时求值（形态不是「打开时的快照」）

```
surface = decideSurface(viewport, anchor)     // 纯函数 = 唯一真相（src/client/surface.ts）
resize（节流 150ms）→ 重新求值 → 变化且通过守卫 → 切形态（src/client/surface-follow.ts）
```

| 守卫 | 原因 |
|------|------|
| 面板没打开 → 什么都不做 | 没有面板可跟随；打开动作由页眉按钮自己决定形态 |
| 决策与当前形态一致 → 不动 | 幂等，避免无意义的重挂 |
| 拖动分隔条期间推迟切换，拖动结束立刻补一次 | 换形态会重挂 DOM，指针捕获断掉，手感像「拖到一半东西没了」（REQ-1.5）|
| 右栏未挂载（`ctx.sidebarRight.mounted` 为假）时等待，并给出提示文案 | 宿主自己的自动打开就是这个策略（asar 439640–439658 / 439075–439080，见 §13.4）|
| 手动切换后钉住 | 否则用户手动选了形态，自动规则下一帧又把它翻回去（REQ-1.7）。**唯一的置位点是弹窗里的「在右栏打开」**（`switchToTab({ pin: true })`），清除点是「面板关闭 / 重新打开」；**标签正文挂载不清 pin** —— 挂载是宿主动作，不是用户动作（`noteTabMounted()` 会把 pin 原样带过去）。两条行为级测试见 `test/tab-switch.test.ts`：pin 住的形态忽略跨界 resize；宿主 × 关闭重开后自动跟随恢复 ✅ |
| **有活标签时不开弹窗**（`tab-wins`）| 标签只能由宿主 × 关掉，标签还在就开弹窗会出现两份面板（REQ-3.3）。**这是 REQ-1.3「宽裕 → 弹窗」那一半不自动执行的原因**，裁量记录见 requirements.md REQ-1.3 |
| 能力不可用时决策改写成 `popup` | 窄视口 + 无标签能力的宿主必须仍有面板（REQ-8.1）|

钉住的解除时机：任何一次形态移动（`set-surface`）或弹窗开合（`set-popup-open`）都清 pin —— 手动点在弹窗里的「在右栏打开」会紧接着重新置上（`switchToTab({ pin: true })`）。

**单向的完整语义（2026-10-08 用户决定）**：自动方向只有 `popup → tab`（视口变局促时）。反方向不做，因为那必须由插件调用 `ctx.sidebarRight.close(tabId)` 关掉用户的标签，与「标签转弹框没有必要」的决定直接冲突。标签关闭 = 只有用户/宿主 ×；关闭后正文卸载会写回 `surface = 'popup'`（§13.3），下一次点页眉按钮按当时视口重新判定。

---

## 5. 尺寸与不越界

- 弹窗宽：`min(1040px, calc(100vw - 48px))`（实现只写常量两倍的 `PANEL_EDGE`，T3.3 落地值）
- 弹窗高：`min(640px, calc(100vh - var(--anchor, 48px) - 24px))`
- `--anchor` 由行内 style 注入（= 我们根元素矩形下沿 + 8，`anchorBottomFromTrigger()`）；**没量到就不注入**，由 CSS 的 `var(--anchor, 48px)` 兜底首帧
- 形态由 §4.1 实时求值决定；本节的 `min()` / 锚点只负责**当前形态内部**的尺寸与不越界（REQ-2）
- 量测数值（8 格视口 × 3 档锚点，全部 `left ≥ 0` / `bottom ≤ 视口高` / `body ≥ 360`）记在 tasks.md T3.4；量测对象是 `LEANSPEC_STYLES` 里真正下发的 CSS 文本，不是重写一遍公式

---

## 6. 拖拽分栏

**DOM**

```html
<aside class="dsh-leanspec-aside" style="width: {split}px; flex: 0 0 auto">…</aside>
<div class="dsh-leanspec-splitter"
     role="separator" aria-orientation="vertical"
     aria-valuemin="180" aria-valuemax="420" aria-valuenow="{split}"
     tabindex="0" />
<div class="dsh-leanspec-main">…</div>
```

**交互**

| 事件 | 行为 |
|------|------|
| `pointerdown` | `setPointerCapture`，记录起点 x 与起始宽度，面板加 `.is-dragging`（`user-select:none`）|
| `pointermove` | `next = clamp(startWidth + (x - startX), 180, min(420, 可用宽 - 360))` |
| `pointerup` / `pointercancel` | 释放捕获、落库 `localStorage` |
| `keydown` ← / → | ±16px（并更新 `aria-valuenow`）|
| `dblclick` | 复位 280px（便利项）|

**要点（都是既有布局的坑）**

1. `.dsh-leanspec-aside` 用 `flex: 0 0 auto` + 行内宽度，让设定值即权威。
   **勘误（实现期实测）**：原稿写「否则主区的 `min-width:0` 会把拖动吃掉」——**不成立**。实测在 920px 面板里，把 aside 从 280 拖到 380，正文同步由 639 让到 539；把 `flex` 换成 `0 1 auto` 结果**完全相同**（主区 `flex-basis: 0` + `min-width: 0`，flex 行从不溢出，没有东西可收缩）。真正保护正文 ≥360px 的是 §6 的 **JS clamp**，不是这条 flex。反过来说，若面板窄到 180px 以下，`0 1 auto` 会优雅收缩而 `0 0 auto` 会溢出被裁——所以 clamp 必须一直在。
2. clamp 上限实时用**当前可用宽**算，窄面板下不能把正文挤到 360 以下。
3. `.dsh-leanspec-splitter` 需要 `touch-action: none`，否则触控板 / 触屏拖动会被滚动抢走。
4. 分隔条是可聚焦元素（`tabindex="0"` + `role="separator"`），键盘用户可用（REQ-7）。
5. 落库做节流（`pointerup` 才写），避免拖动期间高频写 `localStorage`。

---

## 7. 宿主 API 使用与能力探测

```ts
// 能力探测：插槽/服务存在才注册，缺失不抛错
const hasSidebar = typeof ctx.sidebarRight?.openTab === 'function'
try { disposeTab = ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(...)) }
catch { hasSidebar = false }   // 槽位缺失 → 退回纯弹窗
```

- `ctx.slots.inject(name, factory)` 与 `ctx.slots.register(options, component)` **都返回 disposer**（宿主自用写法：`unregister ??= ctx.slots.register({…})`、`const disposeExpand = ctx.slots.inject(...)`）→ 这是 REQ-4「关闭后能重开」的实现基础
- 右栏标签是**带键 seat**：先注册定义（`ctx.sidebarRightTabs`）拿到 id，再按该 id 注册正文 `sidebar.right.pane.tab` 与标题 chip `sidebar.right.pane.tab.title`
- 打开标签用 `ctx.sidebarRight.openTab(...)`（REQ-3.1）
- **所有 disposer 收集到数组，在插件卸载/标签关闭时统一调用**

### 7.1 ~~tab → popup 的关闭能力（三级降级）~~ —— 已作废（2026-10-08）

**本节的方案不再实现**：用户决定「标签转弹框没有必要」，标签改为单向（插件只打开/聚焦，从不关闭），所以没有任何代码路径需要关闭能力，三级降级与占位文案已随 T2.4/T2.7 删除。保留本节作为**决策留档**：

- 实测到的服务面：`ctx.sidebarRight.openTab(kind, { replaceTab })`、`openResource`、`mounted` ✅，以及 **`close(tabId)`**（asar 675338，紧邻 `active()`/`focus(tabId)`）；`closeTab` 只在 dock 层出现过（UI intents），**服务文档未承诺**。
- 当年据此设计的三级降级（`close(tabId)` → 注销 disposer → 占位文案）后来确实落地并真机验证过（目视 #6 通过），随需求变更整体移除。将来若要恢复「标签 → 弹窗」的主动切换，直接复用 `close(active().id)`（`active()` 675345 返回活动 tab 记录）；此时必须同时处理 REQ-3.3：关标签与开弹窗之间不能出现两份面板。
- 反过来（popup → tab）从来没有这个问题：`openTab` 就是"打开或聚焦"，实测文档明写，且本版依赖它做「聚焦已开标签」。

---

## 8. 卸载清单（teardown）

| 资源 | 释放方式 |
|------|----------|
| 页眉入口注册 | `slots.inject` 返回的 disposer |
| 右栏正文 / 标题 seat | 各自的 `slots.register` disposer |
| 标签定义 | `ctx.sidebarRightTabs` 注册返回的 disposer |
| `window.resize` 监听 | 卸载时 `removeEventListener` |
| 拖拽指针 / 键盘监听 | 元素级，卸载时移除；进行中拖拽要 `releasePointerCapture` |
| store 订阅 | 组件 `useEffect` 返回退订 |

---

## 9. 错误与降级

| 情况 | 行为 |
|------|------|
| 右栏插槽 / 服务缺失 | 退回纯弹窗；切换按钮置灰并提示「当前宿主版本不支持右栏标签」|
| `localStorage` 不可用 / 值非法 | 回落 280px，不抛错 |
| 拖拽中组件卸载 | 释放捕获、丢弃本次变更、不落库 |
| 标签被宿主关闭 | store 保留状态，页眉按钮可重新打开 |
| 跨阈值切换时右栏未就绪 | 等 `mounted` 为真再切；等待期间保持原形态，不静默失败 |
| 手动切换后又跨阈值 | 尊重手动选择（钉住），不自动翻回 |

---

## 10. 测试策略

| 层 | 内容 |
|----|------|
| 纯逻辑单测（`node --test`）| `decideSurface` 边界（1087/1088、711/712 + 锚点/边距/不可用输入回落）、`planFollow` 全部守卫与顺序、`clampSplit`（含窄面板上限收缩）、`readStoredSplit`（null / NaN / 越界 / 合法）、`needsFileLoad`（重挂载不重拉）|
| store 单测 | 订阅 / 退订 / patch 合并；互斥不变式（`set-surface`/`set-popup-open`）；`toggle-dir` 产出新 Set 且不被任何其它 action 清空；`loadedKey` 生命周期 |
| 假宿主逻辑测试 | 注册参数形状、服务缺失/敌意回退、注册冲突回滚、`openTab` 抛错回退、单向切换、聚焦已开标签、pin 的置/清、卸载后归零与再启用 |
| 渲染断言（element tree）| 分隔条 `role="separator"` + `aria-*` 齐全；标签正文只有面板、`tabId` 一律不读；弹窗外壳只在 `popupOpen && surface === 'popup'` 时画；锚点行内注入 / 无锚点时不注入 |
| 样式 + 量测断言 | `test/styles.test.ts` 零 hex + 只用 `--dsw-*`；`test/popover-metrics.test.ts` **求值下发的 CSS 文本**，在 1920/1440/1088/1087 与 712/711 × 3 档锚点断言左边界 ≥0、底边 ≤视口高、正文 ≥360 |
| 人工目视（替代 E2E，用户豁免）| 见 tasks.md「人工目视清单」+ 真机验收记录（#4/#5/#7 已通过，#2/#8/#9/#11/#12 待验证）|

> **测试边界（诚实说明）**：`node --test` 里没有渲染器，所以**所有 hook 外壳本身不可单测** —— `LeanspecViewer` / `LeanspecHeaderAction` / `LeanspecSidebarTab` 的 effect、订阅、DOM 量测、`useSidebarMounted` 都只能通过「把它们依赖的纯函数与 store 掏出来测」间接保证。这也正是本 Spec 把策略（`planFollow`/`decideSurface`/`needsFileLoad`）与接线分开的原因。

---

## 11. 工作量与分期

| 期 | 内容 | 规模 |
|----|------|------|
| P1 | store 提取 + 拖拽分栏（含键盘、持久化、clamp）| 中 |
| P2 | 右栏标签出口（定义 + 正文 + chip）+ 单向切换 + 宿主关闭后重开 | 中偏大 |
| P3 | 断点判定（现算锚点）+ 不越界守卫 + 能力回退 + 实时跟随 | 小 |
| P4 | 文档 / 测试 / 目视清单 | 中小 |

> 明确说明：本 Spec 的体量**大于**此前 001/002 两件（002 是纯渲染 + 单点数据链路），主要复杂度在「共享 store + 双出口 + 宿主标签注册顺序 + 拖拽」。
> 定版变更（2026-10-08）：P2 里的「互切」缩为**单向**（弹窗 → 标签），标签 → 弹窗的手动入口与三级关闭降级整体删除。

---

## 12. 风险与已知阻塞

1. **宿主插槽是版本事实**：`sidebar.right.pane.tab` / `ctx.sidebarRight.openTab` 在 `0.1.0-rc.5` 实测存在，但公开契约文档未承诺 → 靠能力探测 + 回退（REQ-8）兜住。**2026-10-08 真机确认座位可用**（用户目视右栏出现 LeanSpec 标签）。
2. **注册顺序**：带键 seat 需要「先定义、后正文/chip」，顺序错可能出现空标签 → P2 首个任务先做最小验证（真机已确认无空标签）。
3. **两份实例**：若互切时旧形态未卸载干净，会出现两个编辑器 → store 的 `surface` 作为唯一真相 + 渲染断言覆盖；定版后额外由「标签正文挂载即接管面板」这条硬规则封死（§13.3）。
4. **重挂载丢状态**：弹窗与标签互斥渲染，组件局部 state 会随卸载消失 → 会话级 state 必须进 store（§13.4 逐项审计），已有真机 bug 与回归测试。
5. **`specs/001` 缺 frontmatter**（既有阻塞）：不影响本 Spec 实现，但会让 `leanspec validate` 整体报错。

---

## 13. 宿主侧栏 tab 实测契约（T2.2 实现依据）

> 来源：宿主 `0.1.0-rc.5` 安装产物 `D:\Programs\DeepSeek Harness\resources\app.asar`（**实测 dump，不是文档猜测**）。
> 行号口径 = 用 .NET `StreamReader.ReadLine()` 逐行读（它把裸 `\r` 也当换行，所以**与 `rg` 的行号在有裸 CR 的区段会差几十行** —— 引用一律以本口径为准）。重新核对可跑：

```powershell
$r=[System.IO.File]::OpenText('D:\Programs\DeepSeek Harness\resources\app.asar'); $i=0
while($null -ne ($l=$r.ReadLine())){
  $i++
  if($l -match 'SidebarRightTabRegistry|ctx\.reflect\.provide\("sidebarRight|entryKey: definition|sidebarRightTabs\.register\(\{ id, kind|key: "sidebar\.right\.pane\.tab'){ "$i`t$l" }
  if($i -gt 760000){ break }
}
$r.Close()
```

| 事实 | 出处（asar 行号 → 包内文件） |
|------|------------------------------|
| `SidebarRightTabRegistry` 实现（`register`/`enter`/`leave`/`get`/`candidates`/`claim`/`subscribe`）| 677458–677700（类文档 677504、`register` 677534–677565）→ `lib/types/client/tab-registry.js` |
| 档位常量 `RANKS` / `DEFAULT_BAND = "extension"` / `coexists` | 677463 / 677469 / 677474 |
| 侧栏 API 文档**英文**原文（类型 / 正文 / 标题 / openTab 语义 / params / throw / `mounted`）| 668609–668625 → `packages/client/ui-sidebar-right/README.md` |
| 侧栏 API 文档**中文**原文（同上，逐段对应）| 668768–668782 → `ui-sidebar-right/README.zh.md` |
| `ctx.sidebarRight` / `ctx.sidebarRightTabs` 由**同一 effect** 经 `ctx.reflect.provide` 提供并随之拆除 | 677917–677918、668685（「Runtime invariant」）|
| `openTab` 实现（`placeTab`：未注册 kind 直接 throw；页地址去重；`title(address)` 此刻捕获）| 675240、675293–675300 |
| `require()`（无上屏会话时 throw，故 `openTab` 可能失败而非静默）| 675588（定义）、668623（文档原文 with no Session on screen … they throw）|
| 框架如何把正文组件派发到 keyed seat（`renderSlot(seat, {}, { entryKey: definition?.id ?? tab.kind, hookContext })`）| 674363–674398（`entryKey` 674395）|
| 正文/标题 seat 的**注入面**：`hookContext = { tabId, shortcuts, title, fullscreen, active, signal, actions, useStore, useTabNavigation }`；组件从 props 解出 `useTabInfo` 再 `const { tab } = useTabInfo()`（`tab.id` / `tab.navigation` / `tab.actions`）；`.title` seat 的返回被框架套一层 `<span class={tabTitle}>` | 674373–674401；第一方调用点 426187–426188（ui-deliverables 正文）、439146–439147 + 439187–439188（ui-plan 正文/标题）、469655–469656 + 469752–469753（ui-schedule）、491698–491699（ui-sidebar-browser）|
| `close(tabId)` **确实**是 `ISidebarRight` 的服务面（紧邻 `active()` / `isExpanded()` / `toggleExpanded()` / `focus(tabId)`）；`closeTab` 只出现在 dock 的 intent 面，不是服务方法 | 675338（`close`）、675345、675355、675359、675371 |
| 插件作者视角的 seat 文档与示例（`{ name, key }`）| 738455–738540（`.title` 738505）；作者示例 `ctx.slots.inject('sidebar.right.pane.tab', …)` 738501 |
| 第一方调用点：**ui-schedule**（`scheduleTask` **页**类型）、**ui-plan**（`plan` **资源**类型：`patterns` + `canOpen` + builtin 档）| 470941–470953（文档 464019）；439594–439605 + 439659–439667 |
| 第一方**页类型**调用点：**ui-sidebar-browser**（`keepMounted`）、**ui-sidebar-files**（builtin、无 patterns、含 chip 标题）| 493170–493206；668343–668362（文档 667218–667220）|
| 第一方**资源类型**调用点：**ui-deliverables**（`changes-review`，builtin 档 + `patterns` + `canOpen`）、**ui-sidebar-documentpreview**（`text`，fallback 档）| 426698–426700（文档 424204）；634287–634329 |
| **可选服务**正确姿势：`ctx.inject(["sidebarRightTabs"], scope => …)`；服务不在则回调永不触发 | 400994–400999（ui-chat）、493199（ui-sidebar-browser）|

### 13.1 注册与打开的真实形状

> **真机状态（2026-10-08）**：座位可用 —— 插件加载后真机右栏确实出现 LeanSpec 标签，宿主 × 关闭后无残留（用户目视确认，见 tasks.md 真机验收记录）。以下形状是 asar 实测 dump，注册参数、服务探测与失败回退都有单测覆盖。

```js
// 1) 注册一种 tab 类型（静态声明，无运行时钩子）
ctx.effect(() => ctx.sidebarRightTabs.register({
  id,                       // 本实现在 tab 系统里的身份，全注册唯一；重复 → throw
  kind,                     // 判别符；同 kind 同档（或与 fallback）重复 → throw
  patterns,                 // 仅资源类型：含 ':' 匹配整个 dsh-resource:// 地址，不含则匹配 URI path（basename、忽略大小写）
  priority,                 // 'extension' | 'builtin' | 'fallback'，省略 = DEFAULT_BAND 'extension'（RANKS: 3/2/1）
  canOpen,                  // 仅资源类型：否决一次 glob 命中
  title: (address) => …,    // 必填：openTab 时被调用一次，结果作为 chip 文字被捕获
  guide,                    // 引导页入口框；页类型可选
  keepMounted,              // true 时正文在标签不可见时仍保留挂载
}), 'label')                // → 幂等 disposer

// 2) 正文 + 标题：两个带键 seat，key 必须等于上面的 id
ctx.slots.inject('sidebar.right.pane.tab',       () => ctx.slots.register({ name: 'sidebar.right.pane.tab',       key: id }, Body))
ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({ name: 'sidebar.right.pane.tab.title', key: id }, Title))

// 3) 打开（页 tab：按 kind，不需要资源地址）
ctx.sidebarRight.openTab('leanspec', { params: {}, revealIfOpened: true, replaceTab, preferNewPane, paneId })
//    未注册的 kind / 无人认领的地址 / 无上屏会话 → throw（接线或时序问题，不是用户错误）
//    页 tab 在目标分栏内**始终去重**（重复 open 复用已存在的那个）；params 以 navigation.params 抵达正文，revision 递增

// 4) 正文组件拿自己的身份（框架注入，不是平铺 owner props；实测 hookContext 见上表）
function Body({ useTabInfo, renderSlot, t, ...injected }) { const { tab } = useTabInfo() }  // tab.id / tab.navigation / tab.actions
//    .title seat 的组件同样拿到 useTabInfo（ui-plan ScheduleTaskTitle 就这么用），返回节点被套 <span class={tabTitle}>

// 5) 关闭 / 读活动 tab（服务面只暴露操作，没有按地址查找、没有布局快照）
close(tabId)  active()  isExpanded()  toggleExpanded()  focus(tabId)  split(paneId?)  float(tabId, rect?)  dock(paneId)
//    close(tabId) 是实测的服务方法（675338），**本版不用**（2026-10-08 用户决定：标签单向，只由宿主/用户关闭）
//    → 三级关闭降级（旧 §7.1）与占位文案因此一并删除；这条事实留档，将来恢复双向切换可直接接上
//    active() 返回当前活动 tab 记录（675345），需要 tabId 时不必自己记账

// 6) 可选服务：拿不到就静默降级，绝不进模块级 inject
ctx.inject(['sidebarRightTabs'], (scope) => { const tabs = scope.sidebarRightTabs /* … */ })
ctx.get('sidebarRightTabs') / ctx.get('sidebarRight')   // 宿主自己的探测写法；拿不到 = undefined
tabs.get(kind)   tabs.subscribe(listener)               // 注册表还暴露这两个
```

### 13.2 本仓库据此刻意选择的写法（与第一方的差异）

| 点 | 第一方 | 本插件 | 原因 |
|----|--------|--------|------|
| `id` | `@deepseek-ai/dsh-client-ui-*` | `dsh-leanspec` | `@deepseek-ai` 是保留前缀；`id` 唯一即可 |
| 类型 | 资源类型（`patterns` + `canOpen`）或 builtin 页 | **页类型**：只给 `id`/`kind`/`title` | 没有 `dsh-resource://` 地址要认领；省略 `patterns`/`canOpen`/`priority` 即走宿主默认档 |
| 注入 | ui-chat 只 inject `sidebarRightTabs` | `['sidebarRightTabs', 'sidebarRight']` 一起 inject | 两者由同一 effect 提供；少了 `openTab` 的标签面没有意义，等齐再注册 |
| 注册失败 | 交给 `ctx.effect` 生命周期 | `try/catch` + 已注册项**回滚** + `available=false` | 冲突（id 撞车 / 插槽缺失）不能把插件的「切到标签」变成静默无响应（REQ-8.2）|
| `openTab` | 直接调用 | 包一层返回 `{ ok } \| { ok:false, reason }` | 宿主对未注册 kind / 无上屏会话会 throw，点一下按钮不该炸（REQ-1.6）|
| 正文数据 | 框架注入 `useTabInfo()` 读 `navigation.params` | 读**共享 store** 的 `projectRoot`（`navigation.params` 仍可用） | 两个形态同一份状态、跨形态保留（REQ-3.4）；store 是 design §3 定的唯一真相 |
| 正文 props | 第一方正文都解 `useTabInfo()`（拿 `tab.id`/`navigation`/`actions`） | **不接任何 props** | 标签单向之后我们没有需要 tabId 的动作（旧 T2.4 的关闭链是唯一理由）；少一个宿主 hook = 少一个契约面 |
| `keepMounted` | ui-sidebar-browser 设 `keepMounted: true` | **不设**（默认 false） | 不设时正文卸载 = 标签消失（或切走），这正是我们要的信号（见 §13.3）；设了反而让「标签还活着但不可见」和「标签已关闭」无法区分，并且会在隐藏分栏里多画一份面板 |

### 13.3 双形态切换的状态机（T2.3–T2.7 落地，实测于假 ctx）

**定版变更（2026-10-08，用户决定「标签转弹框没有必要」）**：切换是**单向**的 —— 插件只打开/聚焦标签，从不关闭它。上版的三级关闭降级（`service`/`disposer`/`placeholder`）与「已切回弹窗」占位全部删除（无死代码），旧 §7.1 相应作废。

宿主只提供「按 kind 打开」「按 tabId 关闭」两个动作，没有布局快照、没有按地址查找，也不告诉我们某个 tab 是否还活着。所以「现在该谁画面板」只能由本插件的 store 记账，而**"标签是否存在"这件事由正文组件的挂载生命周期回答**：

```
surface = 'popup' | 'tab'      ← 谁拥有这块面板（唯一真相，决定谁画 Viewer）
popupOpen: boolean             ← 弹窗是否可见（页眉 popover 的显示条件）
pinned: boolean                ← 手动选择是否钉住（REQ-1.7）
dragging: boolean              ← 分隔条是否正在被拖（跟随要推迟，REQ-1.5）
expanded: Set<string>          ← 目录展开层级（会话级，跨形态保留，REQ-3.4）

不变式（reducer 保证，两个方向都有断言）
  set-surface 'tab'      ⇒ popupOpen = false      // 切到标签就必然收起弹窗
  set-popup-open true    ⇒ surface   = 'popup'    // 弹窗一升起就收回面板所有权
  set-surface / set-popup-open ⇒ pinned = false   // 任何一次移动都结束上一轮的钉住
渲染层随之只认一个条件：
  弹窗外壳  画 ⟺ popupOpen && surface === 'popup'
  标签正文  永远画面板（本组件挂载 = 标签在屏上，没有第二种状态）
```

**"标签是否存在"的唯一信号 = 正文的挂载/卸载**（两个方向都由 `LeanspecSidebarTab` 的一个 `useEffect` 发布）：

| 时机 | 动作 | 为什么 |
|------|------|--------|
| 正文挂载 | `noteTabMounted()`：控制器记 `open = true`；`surface = 'tab'` | 组件挂载本身就证明宿主把我们画在屏上了。顺手把面板从弹窗手里接管过来，**隐藏标签 + 弹窗**这种两份面板的路径从根上封掉（REQ-3.3）|
| 正文卸载 | `noteTabUnmounted()`：控制器记 `open = false`；`surface = 'popup'` | 只有宿主能关标签（×、或插件卸载），所以这是唯一能观测到「标签没了」的时刻。复位 `surface` 才能让弹窗重新可渲染（否则 `popupOpen && surface === 'popup'` 永远为假，× 之后面板再也打不开），同时清掉 pin |

**唯一的切换动作**（单向，顺序就是失败语义）：

| 动作 | 顺序 | 失败时 |
|------|------|--------|
| `switchToTab({ pin? })` 弹窗 → 标签（T2.3） | ① `openTab('leanspec', {params:{}})` ② 成功才 `set-surface 'tab'`（手动调用再 `set-pinned true`）| store 未动 → 弹窗原样留着 + 按钮旁显示原因（REQ-8.2）；`revealIfOpened` 交给宿主默认 `true`（已在的标签被**聚焦**而不是复制，REQ-1.2/REQ-4.2）|

页眉按钮的三种结果（T3.1/T3.2 接线）：

| 当时状态 | 动作 |
|----------|------|
| 弹窗开着 | 关掉（仍是开合开关，`aria-expanded` 跟着变）|
| 标签活着（`leanspecTabIsOpen()`）| `openTab` **聚焦**它，绝不开弹窗（REQ-3.3）|
| 都没有 | 先 `decideSurface`：'tab' → `openTab`（失败则回退开弹窗，REQ-8.1）；'popup' → 开弹窗 |

### 13.4 状态归属审计：哪些是会话级、哪些是瞬态（2026-10-08 真机 bug 的根因与复查）

真机 bug「弹窗 → 标签 时把展开的目录层级合上」的根因很清楚：弹窗与标签是**互斥渲染**（REQ-3.3），所以任何「应该跨形态活着」的 `useState` 都会在切换时被销毁。本轮把三个客户端组件里的每个局部 state 过了一遍：

| 位置 | state | 判定 | 处置 |
|------|-------|------|------|
| `LeanspecViewer` | `expanded: Set<string>` | **会话级**（REQ-3.4 要跨形态保留）| ✅ 移入 store（`ViewerState.expanded` + `toggle-dir`，reducer 每次产出**新 Set**，绝不原地改）|
| `LeanspecViewer` | `dragging: boolean` | **会话级**（T3.2 的跟随守卫要读它，而读取方在组件之外）| ✅ 移入 store（`set-dragging`），组件改为读 `state.dragging` |
| `LeanspecViewer` | `imageFailure: {path,text}` / `imageNonce: number` | 瞬态 ⚠️ | 保留。丢失的后果只是「重挂载后再试一次图片」：真失败会再次报同样的错（同一个 effect 重新拉取），假失败本来就不该记住 |
| `LeanspecViewer` | `panelWidth: number` / `panelWidthRef` | 瞬态（量测）| 保留。挂载后由 `ResizeObserver` 立刻重测，丢的只是首帧 |
| `LeanspecViewer` | `dragRef`（指针起始点）| 瞬态（一次拖拽内有效）| 保留。跨形态切换时本来就该结束拖拽（跟随守卫就是为此）|
| `LeanspecHeaderAction` | `capability` | 派生（模块控制器的镜像）| 保留，挂载时从 `tabCapability()` 初始化 + `subscribeTabCapability` 订阅 |
| `LeanspecHeaderAction` | `failure` / `anchor` | 瞬态（一次失败文案 / 一次量测）| 保留；`anchor` 每次节流 tick 与打开时重测 |
| `LeanspecSidebarTab` | 无局部 state（只有挂载/卸载 effect）| — | 正文的「存在」本身就是状态，发布给 store（见 §13.3）|

**顺带发现并修掉的第二个同类 bug（同一根因：重挂载重跑 effect；上级批准保留，2026-10-08）**：`/file` 的加载 effect 在每次挂载/`textKey` 变化时无条件拉取，而 `file-loaded` 会把 `draft` 覆盖成磁盘内容 —— 于是在编辑到一半切形态时，**未保存草稿会被静默丢弃**（REQ-3.4 承诺保留，属数据丢失级）。修法：store 记 `loadedKey`（`path\0mode`），纯函数 `needsFileLoad(state, key, projectReady)` 决定「是否真的还需要拉」，加载/失败都写入 key，`select` 清空。四条边界全部有断言（`test/viewer-state.test.ts`）：

| 边界 | 期望 |
|------|------|
| 同路径 + 脏草稿 | **不拉**（拉了就会覆盖用户正在写的东西）|
| 换路径 | 拉 |
| 无 `loadedKey` | 拉 |
| 保存成功后 | **不拉**（磁盘内容 == 面板内容，重拉只浪费一次往返）|

切模式（preview↔edit）用的是不同的 key，所以照旧重拉 ✅。

**重拉不清屏（上级要求 2026-10-08，T4.6）**：`/tree` 的重拉是当前**唯一**的新鲜度来源（没有手动刷新按钮），所以不能掐掉；但每次切形态都让目录闪空一次并不值得。规则改为：`loadStatus === 'loading'` **且** store 里已有 `specs`/`files`/`dirs`（`hasTreeData()`）**且** `present` → 继续渲染旧树，只在 `<nav>` 上标 `aria-busy`（**后台刷新**，无占位、无文案）；只有首次没有数据时才回到加载态。`load-start` 本来就不清数据、`load-error` 才清空，所以这条规则在 reducer 侧不需要新字段。两例测试钉住：有数据时重拉期间 `showTree === true` / `refreshing === true`；无数据时 `showTree === false` / `refreshing === false`。

**同一次审计确认的预期行为（未改）**：切形态会重挂 `/tree`（`useEffect` 依赖 `[projectReady, projectRoot]`，重挂载必然重跑）—— 重拉本身保留（新鲜度），只是不再清屏（见上）。`load-start`/`load-success` 只动 `loadStatus`/`specs`/`files`/`dirs`/`statusByDir`，**不动** `selected`/`content`/`draft`/`split`/`expanded`/`mode`。

### 13.5 `sidebarMounted` 的宿主契约（REQ-1.6 的实现依据）

| 事实 | 出处 |
|------|------|
| 生产端把 hooks 放在 `inject` 的**返回值**里：`ctx.slots.register({ name, id, locale, inject: (sessionId) => ({ …, hooks: { sidebarMounted: ctx.sidebarRight.mounted } }) }, PlanReviewOpen)` | asar 439640–439658（hooks 在 439656）|
| 消费端把它当 hook 用，并用选择器判断：`const mounted = useSidebarMounted((session) => session !== void 0)`，随后 `if (opened \|\| !mounted) return` —— 即「等挂载后再执行」就是宿主自己的策略 | asar 439075（签名）、439078、439080 |

本插件照抄这个形状：`index.ts` 的 seat 注册带 `inject: () => injectMountedHook()`，探测方式用 `ctx.get?.('sidebarRight')`（与 §13.1 第 6 条一致），拿不到或抛错就返回 `{}` —— 绝不把可选服务变成硬依赖。**未验证**：真实宿主是否真的把该 hook 传进我们的组件（Node 里没有渲染器，只有形状对齐 + `test/client-apply.test.ts` 的注入断言）。

