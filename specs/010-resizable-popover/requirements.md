# 功能需求：弹窗可调长宽

> 从 [README.md](./README.md) 的冻结决策展开。验收标准用 EARS（GIVEN / WHEN / THEN SHALL）。
> 实现方案见 [design.md](./design.md)，任务见 [tasks.md](./tasks.md)。

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

**替代真相来源**：`src/client/surface.ts`（尺寸常量与形态判定）、`src/client/styles.ts`（弹窗 CSS 上限）、`src/client/LeanspecHeaderAction.ts`（弹窗宿主组件）、`test/popover-metrics.test.ts`（CSS 与判定的一致性量测）。

---

## 1. 概述

给弹窗加一个**右下角对角调整手柄**，把宽高从常量变成**用户可调、可持久化、全局共用**的状态，并让「弹窗还是右栏标签」的判定使用这个尺寸。

---

## 2. 交互控件清单

| 控件 | 标识 | 触发行为 | 副作用（可观察）|
|------|------|---------|----------------|
| 调整手柄 | `[data-leanspec-resize]` | 按住拖动 | 弹窗宽高随指针变化，正文与目录树同步重排 |
| 调整手柄 | 同上 | 双击 | 宽高复位 1040×640 并持久化 |
| 调整手柄 | 同上 | `←` / `→` | 宽度 −/+ 16px（两侧都不越界）|
| 调整手柄 | 同上 | `↑` / `↓` | 高度 −/+ 16px（两侧都不越界）|
| 调整手柄 | 同上 | 松开指针 | 尺寸写入 `localStorage`（拖动期间不写）|

---

## 3. 功能需求

### REQ-1 可拖拽调整长宽

- **REQ-1.1** WHEN 用户在弹窗右下角手柄上按下指针并移动 THEN SHALL 弹窗宽度随水平位移变化、高度随垂直位移变化，且两者同时生效（单次拖动可只动一个轴）
- **REQ-1.2** WHEN 拖动进行中 THEN SHALL 尺寸实时反映在弹窗上（无需松手），且不触发形态切换
- **REQ-1.3** WHEN 用户松开指针或指针被取消 THEN SHALL 结束拖动，并且只在此刻持久化一次尺寸
- **REQ-1.4** WHEN 指针在拖动中移出手柄 THEN SHALL 仍持续接收移动（指针捕获），不会中断

### REQ-2 尺寸边界

- **REQ-2.1** WHEN 调整结果小于 600×420 THEN SHALL 被夹到 600×420（任一轴独立夹取）
- **REQ-2.2** WHEN 调整结果超过视口可用空间 THEN SHALL 被夹到 `100vw - 48px` 宽、`100vh - anchor - 24px` 高
- **REQ-2.3** WHEN 视口本身小于最小值 THEN SHALL 仍按最小值渲染，由 CSS 的上限负责不越界（不抛错、不出现负值）
- **REQ-2.4** WHEN 窗口缩放导致已存尺寸超过新的可用空间 THEN SHALL 渲染尺寸被 CSS 上限压小；**存储值不被静默改写**

### REQ-3 形态判定跟随尺寸

- **REQ-3.1** GIVEN 用户把弹窗调到 700×500 WHEN 视口为 800×700 THEN SHALL 判定为弹窗（而不是右栏标签）
- **REQ-3.2** WHEN 用户从未调整过尺寸 THEN SHALL 判定结果与 007 的 1040×640 规则**逐位一致**（1088×712 是弹窗，1087 与 711 是标签）
- **REQ-3.3** WHEN 尺寸变化后再次打开面板 THEN SHALL 用新尺寸判定，不需要刷新页面

### REQ-4 持久化与作用域

- **REQ-4.1** WHEN 用户调整过尺寸 THEN SHALL 关闭浏览器后重开仍使用该尺寸
- **REQ-4.2** WHEN 用户切换到**另一个会话或另一个工作区** THEN SHALL 使用同一份尺寸（不按会话/项目分片）
- **REQ-4.3** WHEN 存储缺失、损坏、非数字或超出绝对值 THEN SHALL 回落到 1040×640，面板照常打开
- **REQ-4.4** WHEN `localStorage` 被策略禁用 THEN SHALL 本次会话内仍可调整，且不抛异常

### REQ-5 复位

- **REQ-5.1** WHEN 用户双击手柄 THEN SHALL 尺寸回到 1040×640 并持久化
- **REQ-5.2** WHEN 用户按方向键调整 THEN SHALL 立即持久化（键盘没有「松手」事件）

### REQ-6 可访问性

- **REQ-6.1** 手柄 SHALL 可聚焦（`tabIndex=0`），并带有可读的无障碍名与操作提示
- **REQ-6.2** WHEN 手柄获得焦点并按方向键 THEN SHALL 调整尺寸且阻止页面滚动
- **REQ-6.3** 手柄 SHALL 使用 `touch-action: none`，触摸设备上拖动不会被页面滚动手势吃掉

### REQ-7 不变量（不得破坏的既有行为）

- **REQ-7.1** 目录 / 正文分隔条（`.dsh-leanspec-splitter`）行为不变，其宽度仍受面板宽度 clamp
- **REQ-7.2** 右栏标签的渲染与尺寸完全不受本 Spec 影响
- **REQ-7.3** 弹窗仍锚在页眉按钮下方（`--anchor` 注入不变），不出现越界
- **REQ-7.4** 卸载后不残留监听器、指针捕获或定时器

---

## 4. 验收清单（二值判定）

| # | 判定 | 命令 / 方式 |
|---|------|------------|
| A-1 | 拖动手柄宽高都变，松手才写存储 | `node --test test/panel-resize.test.ts` + 目视 |
| A-2 | 600×420 与视口上限双向夹取 | `node --test test/surface.test.ts` 新用例 |
| A-3 | 700×500 @ 800×700 判定为弹窗 | `node --test test/surface.test.ts` |
| A-4 | 默认尺寸判定与 007 矩阵一致 | `node --test test/popover-metrics.test.ts` |
| A-5 | 重开浏览器尺寸仍在（跨会话共用） | 目视（同一浏览器 profile）|
| A-6 | 损坏的存储回落 1040×640 | `node --test test/surface.test.ts` |
| A-7 | 双击复位 | `node --test test/panel-resize.test.ts` + 目视 |
| A-8 | 手柄可聚焦、方向键可用 | `node --test test/panel-resize.test.ts` |
| A-9 | 分隔条与右栏标签不变 | 既有 `test/*.test.ts` 全绿 |
| A-10 | 构建与类型检查 | `pnpm build && pnpm typecheck && pnpm test` |
