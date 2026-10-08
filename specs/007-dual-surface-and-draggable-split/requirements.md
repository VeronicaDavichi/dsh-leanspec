# 功能需求：双形态面板 + 可拖拽分栏

> 从 [design.md](./design.md) 反推（design-first）。验收标准用 EARS（GIVEN / WHEN / THEN SHALL）。
> 任务见 [tasks.md](./tasks.md)。

---

## 0. 项目文档摘要（docs/ 全量扫描）

本仓库**没有 `docs/` 目录**，故本 Spec 无 docs/ 来源可提炼。

| 子目录 | 状态 | 本 Spec 使用方式 |
|--------|------|-----------------|
| `docs/architecture.md` | （空）| — |
| `docs/dev-guide.md` | （空）| — |
| `docs/api-contracts/` | （空）| — |
| `docs/db-schema/` | （空）| — |
| `docs/references/` | （空）| — |
| `docs/standards/` | （空）| — |

**替代真相来源**：`README.md`（仓库功能与版本历史）、`src/client/*`（现状实现）、宿主包内契约元数据（`packages/client/ui-conversation/src/client/contract/slots.ts`、dockkit / sidebarRight 相关文档，摘录见 design.md §2 与 §7）。

---

## 1. 概述

把 LeanSpec 面板从「单一弹窗」升级为「弹窗 / 右栏标签 双形态」，并让两个形态的目录-正文分隔均可拖拽。目标是**窄窗口不再挤坏排版**、**宽窗口用得更舒展**，且两种用法之间不丢状态。

---

## 2. 交互控件清单

| 控件 | 标识 | 触发行为 | 副作用（可观察）|
|------|------|---------|----------------|
| 页眉 LeanSpec 按钮 | `.dsh-leanspec-trigger` | 打开 / 关闭面板 | 宽裕 → 出现弹窗；局促 → 右栏出现 LeanSpec 标签；**标签已经开着 → 只聚焦它，不开弹窗**（REQ-3.3）|
| 切换按钮（弹窗内）| `[data-leanspec-switch]` | 切到右栏标签（单向）| 弹窗消失 + 右栏 LeanSpec 标签出现并聚焦 |
| ~~切换按钮（标签内）~~ | ~~`[data-leanspec-switch]`~~ | ~~切到弹窗~~ | **已移除（2026-10-08 用户决定）**：详见 REQ-3.2 |
| 目录节点 | `.dsh-leanspec-tree-node` | 点击 | 展开 / 收起该层级；层级属于**会话状态**，切形态不丢（REQ-3.4）|
| 分隔条 | `.dsh-leanspec-splitter` | 拖动 / ←→ 键 | 目录列宽变化，正文宽度联动；`aria-valuenow` 更新 |
| 分隔条双击 | 同上 | 复位 | 目录回到 280px |
| 宿主标签关闭 × | 宿主提供 | 关闭面板 | LeanSpec 视图卸载（正文卸载即通知 store）；再点页眉按钮可重开 |

---

## 3. 功能需求

### REQ-1 形态判定

- **REQ-1.1** GIVEN 用户点击页眉 LeanSpec 按钮，WHEN 宿主视口宽 ≥1088px **且** 高 ≥712px，THEN 系统 SHALL 以弹窗形态打开面板。
- **REQ-1.2** GIVEN 用户点击页眉 LeanSpec 按钮，WHEN 视口宽 <1088px **或** 高 <712px，THEN 系统 SHALL 以右栏标签形态打开面板。
- **REQ-1.3** GIVEN 面板已打开，WHEN 宿主窗口跨过 REQ-1.1 的阈值，THEN 系统 SHALL 切换为对应形态（宽裕 → 弹窗；局促 → 右栏标签）。
  > **裁量记录（2026-10-08，已确认：用户 + 上级）**：**自动判定只在「没有活标签」时生效**。已有 LeanSpec 活标签时**活标签优先** → 页眉按钮只**聚焦**该标签（`openTab` 用宿主默认 `revealIfOpened`，宿主去重 + 聚焦），SHALL NOT 在标签旁边再开弹窗，SHALL NOT 自动把持签换成弹窗。理由：主人的原话就是「标签转弹框没有必要」，而自动把活标签换掉等于**替他关东西**，不允许；同时 REQ-3.3 要求同屏只有一个面板，标签还挂着就开弹窗会出现两份面板。**定版行为**：标签的关闭只由用户/宿主 × 触发；标签关闭后，下一次点页眉按钮按当时的 `decideSurface` 重新判定（宽裕 → 弹窗）✅。反向（弹窗 → 局促 → 标签）照 REQ-1.3 自动执行 ✅。**明确不做**：恢复 `close(active().id)` 那一级来做「标签 → 弹窗」的自动切换（`close(tabId)` 是已量测的宿主能力，留档在 design.md §7.1/§13，本版不接）。
- **REQ-1.4** 判定 SHALL 基于按钮自身矩形与视口实测值现算，SHALL NOT 依赖写死的页眉高度常量。
- **REQ-1.5** GIVEN 形态切换被触发，WHEN 用户正在拖动分隔条，THEN 系统 SHALL 推迟到拖动结束后再切换。
- **REQ-1.6** GIVEN 需要切到右栏标签，WHEN 宿主右栏尚未挂载（`ctx.sidebarRight.mounted` 为假），THEN 系统 SHALL 等挂载后再执行，SHALL NOT 静默失败。
- **REQ-1.7** GIVEN 用户手动点过切换按钮，THEN 该形态 SHALL 被钉住直到面板关闭或重新打开；期间窗口变化 SHALL NOT 改变形态。
  > **落地说明（2026-10-08）**：单向定版后，「手动切换」只剩弹窗内那颗「在右栏打开」（T2.4 的标签内按钮已移除）。`pinned` 仍然实现并被测试（`set-pinned` + 任何一次 `set-surface`/`set-popup-open` 清 pin），但**当前没有能触发「pin 与自动规则打架」的路径**（标签侧不会自动翻回），因此它是安全网而非活跃机制 —— 如实记录，不假装它每天在起作用。

### REQ-2 弹窗尺寸与不越界

- **REQ-2.1** GIVEN 弹窗形态打开，WHEN 视口满足 REQ-1.1，THEN 弹窗 SHALL 为 1040 × 640px（含边框，`box-sizing: border-box`）。
- **REQ-2.2** GIVEN 弹窗打开，WHEN 视口任意变化，THEN 弹窗左边界 SHALL ≥0px 且底边 SHALL ≤ 视口高度。
- **REQ-2.3** 弹窗宽度 SHALL NOT 超过 `100vw - 48px`；高度 SHALL NOT 超过 `100vh - 锚点 - 24px`。

### REQ-3 形态互切

- **REQ-3.1** GIVEN 弹窗已打开，WHEN 用户点击「在右栏打开」，THEN 系统 SHALL 关闭弹窗、调用宿主 `sidebarRight.openTab` 打开并聚焦右栏 LeanSpec 标签。
- **REQ-3.2** ~~GIVEN 右栏标签已打开，WHEN 用户点击「用弹窗打开」，THEN 系统 SHALL 关闭该标签并打开弹窗。~~
  > **已由用户于 2026-10-08 决定移除**：标签 → 弹窗的手动切换「没有必要」。因此标签内不再有任何切换按钮/占位（正文永远直接渲染面板），插件也不再关闭宿主标签（实测的 `ctx.sidebarRight.close(tabId)` 保留在 design.md §13 作为宿主事实，代码不再探测）。**替代行为（单向 + 聚焦）**：标签已打开时，页眉按钮**聚焦**该标签（`openTab` 走宿主默认 `revealIfOpened`，宿主去重 + 聚焦），SHALL NOT 在标签旁边再开一个弹窗；标签的关闭只由用户/宿主 × 触发，之后下一次点页眉按钮按 `decideSurface` 重新判定。
- **REQ-3.3** GIVEN 任一时点，THEN 系统 SHALL 最多存在一个面板实例（弹窗与标签不得同时存在）。
- **REQ-3.4** GIVEN 用户切换形态，WHEN 切换完成，THEN 选中文件、预览/编辑模式、未保存草稿、分栏比例、**目录展开层级** SHALL CONTINUE TO 保持不变。
  > **同根因顺带修复（2026-10-08；真机 bug + 审计发现，上级批准保留）**：两者根因相同 —— 弹窗与标签互斥渲染，切换会**卸载并重挂**面板组件，于是「组件内的会话级状态」和「重挂载时重跑的 effect」都会造成丢失。
  > ① **目录展开层级**（用户真机报告「弹窗 → 标签 时会把展开的目录层级合上」）：`expanded` 从组件 `useState` 移入 store（`ViewerState.expanded` + `toggle-dir`，每次产出新 Set），回归见 `test/viewer-state.test.ts` / `test/tab-switch.test.ts`（往返后 5 个值逐一相等、跨形态同一个 Set 实例、卸载重挂后仍可变）。
  > ② **未保存草稿**（审计发现，**数据丢失级**）：`/file` 加载 effect 在每次重挂载时无条件拉取，而 `file-loaded` 会把 `draft` 覆盖成磁盘内容 ⇒ 编辑到一半切形态草稿静默消失。修法 = store 记 `loadedKey`（`path\0mode`）+ 纯函数 `needsFileLoad()` 判断是否需要真拉；四条边界都有断言：同路径 + 脏草稿 → **不拉**；换路径 → 拉；无 `loadedKey` → 拉；保存成功后 → **不拉**。
  > ③ **重拉不清屏**（上级要求，REQ-1.3 的伴随项）：有数据时 `/tree` 重拉走**后台刷新**（旧树继续渲染，只 `aria-busy`），只有首次无数据才显示加载态 —— 否则每次切形态目录都会闪空一次。

### REQ-4 标签关闭与重开

- **REQ-4.1** GIVEN 右栏标签已打开，WHEN 用户点击宿主标签的关闭 ×，THEN 系统 SHALL 卸载 LeanSpec 视图并调用所有 disposer（插槽注册 / resize 监听 / 拖拽监听 / store 订阅）。
  > **落地补充（2026-10-08）**：正文卸载是**唯一**能观测到「宿主把标签关掉了」的信号（我们不再自己关标签）。因此正文 `useEffect` 的清理函数 SHALL 把 `surface` 复位为 `popup` 并标记标签已关闭——否则弹窗的渲染条件 `popupOpen && surface === 'popup'` 永远为假，宿主 × 之后面板无法再打开。挂载时则相反：正文挂载即证明标签在屏上，SHALL 把面板从弹窗手里接管过来（`surface = 'tab'`），这样隐藏标签 + 弹窗不会同屏出现两份面板（REQ-3.3）。
- **REQ-4.2** GIVEN 标签已被关闭，WHEN 用户再次点击页眉按钮（且视口仍满足 REQ-1.2），THEN 系统 SHALL 重新打开标签，并 SHALL 恢复此前的选中文件与草稿。
- **REQ-4.3** GIVEN 插件被卸载，THEN 系统 SHALL NOT 遗留任何 `resize` 监听、指针捕获或未释放的插槽注册。
- **REQ-4.4** ~~GIVEN 需要从标签切回弹窗，THEN 系统 SHALL 按可用能力依次降级：① `ctx.sidebarRight.closeTab` ② 注销本插件的 seat 注册 ③ 标签内显示「已切回弹窗」占位；SHALL NOT 留下空白标签或抛错。~~
  > **仅在「关闭降级为主动作」时才有意义，本版不适用（2026-10-08 用户决定）**：既然插件不再主动关闭标签，三级降级与占位文案都没有触发路径，已随 T2.4/T2.7 一并删除（无死代码）。仍然保留的硬约束：任何失败路径 SHALL 结束在「用户手上有一个能用的面板」（REQ-8.1），由页眉按钮的 `openTab` 失败回退弹窗承担 ✅。

### REQ-5 拖拽分栏

- **REQ-5.1** GIVEN 面板已打开（任一形态），WHEN 用户按住分隔条拖动，THEN 目录列宽 SHALL 实时跟随指针。
- **REQ-5.2** GIVEN 拖动过程中，THEN 目录列宽 SHALL 被限制在 `[180, 420]px`，且正文可用宽 SHALL ≥360px。
- **REQ-5.3** GIVEN 可用宽不足（`可用宽 - 360 < 180`），THEN 上限 SHALL 收缩为 `可用宽 - 360`，SHALL NOT 出现目录吃掉正文的情况。
- **REQ-5.4** GIVEN 分隔条被双击，THEN 目录列宽 SHALL 复位为 280px。

### REQ-6 比例持久化

- **REQ-6.1** GIVEN 用户调整过分栏，WHEN 关闭后重新打开面板（含刷新页面），THEN 目录列宽 SHALL 恢复为上次的值。
- **REQ-6.2** GIVEN `localStorage` 中缺失、非数字、非有限值或越界，THEN 系统 SHALL 回落 280px 且 SHALL NOT 抛错。
- **REQ-6.3** 写入 SHALL 发生在拖动结束（`pointerup` / 键盘调整后），SHALL NOT 在 `pointermove` 期间高频写入。

### REQ-7 键盘可达

- **REQ-7.1** GIVEN 焦点位于分隔条，WHEN 按 ← 或 →，THEN 目录列宽 SHALL 按 16px 步进变化并夹紧在 REQ-5.2 范围内。
- **REQ-7.2** 分隔条 SHALL 暴露 `role="separator"`、`aria-orientation="vertical"`、`aria-valuemin` / `aria-valuemax` / `aria-valuenow`，且 `aria-valuenow` 随宽度更新。

### REQ-8 能力回退

- **REQ-8.1** GIVEN 宿主缺少 `ctx.sidebarRight.openTab` 或右栏插槽，WHEN 用户点击页眉按钮，THEN 系统 SHALL 以弹窗形态打开（忽略 REQ-1.2 的窄窗口分流）。
- **REQ-8.2** GIVEN 能力缺失，THEN 切换按钮 SHALL 处于禁用态并显示原因文案，SHALL NOT 抛错或静默无响应。
- **REQ-8.3** 能力探测 SHALL 在注册阶段完成并缓存结果，SHALL NOT 在每次点击时重复探测。

---

## 4. 非功能需求

- **NFR-1** 样式零硬编码 hex，仅使用 `--dsw-*` token（仓库既有测试约束）。
- **NFR-2** 新增/修改的样式规则不得破坏现有预览排版（表格行线、`hr` 间距、badge 等宽 42px 等既有断言须保持全绿）。
- **NFR-3** `npm test`、`npm run typecheck`、`npm run build` 三项 SHALL 全绿。
- **NFR-4** 弹窗放大到 1040×640 后，正文可用宽 SHALL ≥700px（用于校验目录栏占比仍合理）。
- **NFR-5** 不新增运行时依赖（沿用 `react` + `marked` 现有依赖）。

---

## 5. 约束与假设

| # | 内容 | 影响 |
|---|------|------|
| C-1 | 只用宿主公开插槽 / 服务，不 patch 私有 DOM | 决定了表面选型（design.md §2）|
| C-2 | 插件契约要求所有注册/监听可卸载 | REQ-4 的验收基础 |
| A-1（**已确认**）| 2026-10-08 用户当面确认沿用 E2E 豁免（「测试的问题我来，肉眼看」）| 替代验证 = 纯逻辑单测 + CSS 文本量测 + 15 项目视清单（2026-10-08 起 13→15 条）；若日后要求恢复，需先集成 Playwright capability |
| A-2（假设）| 右栏插槽与 `ctx.sidebarRight.openTab` 在目标版本可用（已在 `0.1.0-rc.5` asar 实测到文档与示例）| 不成立时由 REQ-8 回退兜住 |
| A-3（假设）| 弹窗锚点（按钮下沿 + 8）与页眉右内边距（16px）在真机与实测重现页一致 | 不一致时阈值由现算逻辑自动适配；若页眉明显更高，需重测 712 这个值 |
