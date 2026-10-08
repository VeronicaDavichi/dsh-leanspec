# 实现任务：双形态面板 + 可拖拽分栏

> 任务引用 [requirements.md](./requirements.md) 的 REQ-N；设计依据见 [design.md](./design.md)。
> 完成定义（每个任务）：代码 + 验证命令通过 + 无遗留监听/注册。

---

## Phase 0：前置确认

- [x] T0.1 确认 E2E 豁免仍然有效 —— **2026-10-08 用户当面确认「对」** ✅
  - 依据：用户指示「测试的问题我来，肉眼看」（002 已记录）+ 本 Spec 开工前确认
  - 替代验证：纯逻辑单测（`node --test`）+ CSS 文本量测 + 15 项目视清单
  - 说明：`leanspec-apply` 的「UI 需求必须配 E2E」预检因此**未通过**，属**显式记录后继续**（非静默跳过）；豁免依据见 README「硬规则偏离说明」

- [x] T0.2 复核宿主表面能力（右栏插槽 + 服务）
  - 内容：确认 `sidebar.right.pane.tab`、`sidebar.right.pane.tab.title`、`ctx.sidebarRightTabs`、`ctx.sidebarRight.openTab` 在当前版本存在；确认带键 seat 的注册顺序
  - 验证：最小验证代码能在右栏打出空标签并可关闭，卸载后无残留
  - 实测（2026-10-08）：插件加载后**真机右栏确实出现 LeanSpec 标签**（用户目视确认「已经能正常在侧边栏看到了」），宿主 × 关闭后无残留空白标签（目视清单 #7 通过）。asar 侧证据与编号见 design.md §13。**这条的用户结论是用户口述，不是我的量测。**

- [ ] T0.3 记录真机页眉几何（锚点 / 右内边距）—— **用户豁免（2026-10-08）**，保持未勾选、不做假勾
  - 内容：在真实宿主里量出按钮下沿、右内边距、`box-sizing` 生效情况
  - 验证：与 A-3 假设一致，或据此修订 REQ-1 的阈值并回写 README 冻结决策
  - 现状（2026-10-08）：**仍未量**。因此 T3.1/T3.3 全部走实测优先 + 兜底：`--anchor` 由行内样式注入（`anchorBottomFromTrigger(rect.bottom)` = 下沿 + 8），CSS 侧写 `var(--anchor, 48px)` 兜底首帧；宽度断点的 24px 右边距同样是假设（design.md §4）。T3.4 的量测把这两个假设写成参数，真机数字拿到后只需替换常量。**注意**：真值落地时 `ANCHOR_FALLBACK` 与 CSS 的 `var(--anchor, 48px)` 必须一起改（design.md §4.1 第 3 条）。
  - 豁免记录（2026-10-08，归档确认时用户选定）：用户在归档确认里选择**不量**（选项原文：「T0.3 记成『有理由豁免』—— 运行时它自己会量，48px 只是兜底」）。理由成立：① `--anchor` 由 `getBoundingClientRect().bottom` **实测注入**，真机用的不是 48；② CSS 的 `calc(100vh - var(--anchor, 24px 余量))` 自带视口上限，断点只是舒适阈值而非安全属性；③ 若日后要调断点，届时再量，且 `ANCHOR_FALLBACK` 与 CSS 兜底**必须一起改**。**本任务保持 `[ ]`：用户选择的是"不量"，不是"量过了"。**

---

## Phase 1：共享 store + 拖拽分栏（P1）

- [x] T1.1 [REQ-3.4] 抽出模块级 store —— 新增 `src/client/store.ts`（`createStore` + `viewerStore` + `useViewerStore`）
  - 内容：`getState` / `setState` / `subscribe`；选中文件、模式、草稿、内容、保存态、分栏比例全部迁移
  - 验证：`npm test` → `test/store.test.ts` 4 例通过（通知、退订后静默、同值不触发、通知中退订不炸）

- [x] T1.2 [REQ-5.1][REQ-5.2][REQ-5.3] 实现 `clampSplit` —— 新增 `src/client/surface.ts`（纯函数，零 DOM）
  - 内容：范围 `[180, min(420, 可用宽 - 360)]`；可用宽不足时下限胜出
  - 验证：`npm test` → `test/surface.test.ts` 覆盖 179/180/420/421、窄面板收缩（700 → 340；500 → 180 下限）、NaN / Infinity / 取整

- [x] T1.3 [REQ-5.1] 渲染分隔条并按指针拖动 —— `PanelSplitter`（无 hook、可单测）+ `setPointerCapture` + `touch-action: none`
  - 内容：`.dsh-leanspec-aside` 改 `flex: 0 0 auto` + 行内宽度；分隔条插在 aside 与 main 之间
  - 验证：`npm test` → `test/viewer-render.test.ts` 4 例（ARIA 契约、可达上限、拖动态 class、手势路由含 pointercancel）
  - 浏览器实测（Playwright，920px 面板，写入"拖动会写的同一个行内宽度"）：aside 280 → 380 时正文 **639 → 539**（正好让出 100px）；分隔条命中区 5px、`cursor: col-resize`、`touch-action: none` ✅
  - **勘误**：`flex: 0 0 auto` 并非"防止拖动被吃掉"的关键（换 `0 1 auto` 实测结果完全相同），真正保护正文的是 T1.2 的 clamp —— 已回写 design.md §6

- [x] T1.4 [REQ-6.1][REQ-6.2][REQ-6.3] 持久化与回落 —— `loadPersistedSplit` / `persistSplit` / `readStoredSplit`
  - 内容：`localStorage['leanspec.split']`；写入只在 `pointerup` 与键盘调整后，绝不在 `pointermove` 期间
  - 验证：`npm test` → 覆盖 `null` / `undefined` / `''` / 空白 / `'abc'` / `'NaN'` / `'Infinity'` / `'179'` / `'421'` / `'-1'` 全部回落 280；合法值取用并取整

- [x] T1.5 [REQ-7.1][REQ-7.2] 键盘可达与 ARIA —— ←/→ ±16px（`SPLIT_STEP`）、`role="separator"` + 4 项 aria + `tabIndex=0`
  - 验证：`npm test` → 渲染断言确认 ARIA 与 tabIndex；步进走同一个 clamp 路径，端到端由目视清单 #10 覆盖

- [x] T1.6 [REQ-5.4] 双击复位 280px —— `onDoubleClick` → `applySplit(SPLIT_DEFAULT)` + 落库
  - 验证：`npm test` → 手势路由断言确认 `onDoubleClick` 已接线；数值路径同 T1.2

---

## Phase 2：右栏标签出口（P2）

- [x] T2.1 [REQ-8.1][REQ-8.3] 能力探测与缓存
  - 内容：注册阶段探测 `ctx.sidebarRight?.openTab` 与插槽可用性，`try/catch` 兜底；结果缓存供 UI 查询
  - 验证：`npm test`（mock 缺失上下文 → 探测结果 false 且不抛错）
  - 实测（2026-10-08）：`tab-surface.ts` 的 `readService()`（先 `ctx.get()` 再属性读，getter 抛错也算缺失）+ `detectTabCapability()`（整体 `try/catch`，任何敌意输入 → `NO_TAB_CAPABILITY`）+ `createTabController()`（创建时探一次、`noteRegistration()` 合并注册结果、`refresh()` 重探、`subscribe()` 通知）。**能力只含 `canOpen`/`registered`/`available`/`unavailableReason`**：本轮按用户决定删掉了 `close`/`canCloseViaService`（见 T2.7 移除记录）。
  - 实测门：`test/tab-surface.test.ts` —— 无服务/敌意 ctx/抛错 getter 全部折叠成 `NO_TAB_CAPABILITY`；两个服务必须同时在位才算 `canOpen`；控制器只探一次并缓存（`probes` 计数）；能力变化只通知一次；「the capability no longer carries a close strategy」钉住字段表。`npm test` **263 pass / 0 fail**。

- [x] T2.2 [REQ-4.1] 注册右栏定义 / 正文 / 标题
  - 内容：`ctx.sidebarRightTabs` 注册定义拿 id → `sidebar.right.pane.tab`（正文）+ `.title`（chip）；收集全部 disposer
  - 验证：真机点开右栏能看到 LeanSpec 标签且正文可交互（人工目视清单第 4 项）
  - 实测（2026-10-08）：新增 `src/client/tab-registration.ts` —— `applySidebarTab(ctx)` 用**作用域注入** `ctx.inject(['sidebarRightTabs', 'sidebarRight'], scope => …)`（两个服务都不进模块级 `inject`，缺失时静默退回纯弹窗），在 scope 里按「定义 → 正文 seat → 标题 seat」顺序注册 id `dsh-leanspec` / kind `leanspec` 的**页类型**（无 `patterns`/`canOpen`/`priority`，走宿主 `DEFAULT_BAND = "extension"`），每个注册都返回 disposer 并挂在 `scope.effect` 上（注册冲突/插槽缺失 → 回滚已注册项 + `available=false`）；导出 `openLeanspecTab({ params, revealIfOpened })` → `scope.sidebarRight.openTab('leanspec', …)`，返回 `{ ok } | { ok:false, reason }` 而**不抛**（宿主对未注册 kind / 无上屏会话会 throw）；导出 `tabCapability()` / `subscribeTabCapability()` 供 T3.5 的禁用态与原因文案（`TAB_UNAVAILABLE_HOST` / `TAB_UNAVAILABLE_REGISTRATION`）。新增 `src/client/LeanspecSidebarTab.ts`：正文 = `createElement(LeanspecViewer, {})`（**复用现有面板，不再套弹窗外壳**），chip = `span` 文本 `LeanSpec`。`tab-surface.ts` 扩出 `leanspecTabDefinition()`、`readService()`（先 `ctx.get()` 再属性读）与 `available`/`unavailableReason`。`LeanspecHeaderAction` 把解析出的 projectRoot 写进 store（`set-project`），`LeanspecViewer` 的 `projectRoot`/`projectReady` 在**没有 props 时**回落到 store —— 标签正文因此不需要会话身份（弹窗仍用 props，行为未变）。
  - 实测门：`npm run typecheck` 干净；`npm test` **205 pass / 0 fail**（本任务新增 17 例：`test/tab-registration.test.ts` 11 例 + `test/tab-surface.test.ts` 6 例；未改既有断言）；`npm run build` 成功，`lib/index.js` 12.2kb / `lib/client.js` 119.5kb。
  - **真机目视（用户 2026-10-08）**：右栏确实出现 LeanSpec 标签，宿主 × 关闭后干净 —— 目视清单 #4、#7 由用户确认。本任务只证明注册参数形状、服务缺失降级、注册冲突回滚、卸载清理与能力可读。

- [x] T2.3 [REQ-3.1] 弹窗 → 标签一键切换
  - 内容：切换按钮调用 `ctx.sidebarRight.openTab`，先关弹窗再开标签
  - 验证：点击后弹窗消失、标签出现并聚焦（人工目视清单第 5 项）
  - 实测（2026-10-08）：弹窗里新增 `.dsh-leanspec-switchbar` + 按钮「在右栏打开 ⧉」（`data-leanspec-switch="tab"`）。点击走 `tab-registration.switchToTab()`：**先** `openTab('leanspec', { params: {} })`，**成功才** `set-surface 'tab'`（reducer 顺带把 `popupOpen` 置 false，弹窗消失走的就是既有 store 路径）。顺序是刻意的：失败时 store 一动没动 → 弹窗原样留着，按钮旁显示原因（`headerActions.switchToTab()` → `setFailure`），绝不出现空白面板。
  - 实测门：`test/tab-switch.test.ts`「switching to the tab opens exactly once and dismisses the popup」断言 `openCalls.length === 1`、`kind === 'leanspec'`、`surface === 'tab'`、`popupOpen === false`；`test/tab-views.test.ts`「clicking the switch opens the tab once and closes the popup」用**真实 action** 点按钮（不是空壳 handler）跑通同一条路径。`npm test` 228 pass / 0 fail。
  - **真机目视（用户 2026-10-08）**：目视清单 #5 通过（弹窗内点按钮 → 弹窗消失、右栏标签出现并聚焦）✅
  - **本轮变更（P3/T3.2 接线后）**：入口语义升级为「先问 `decideSurface`」——宽裕才开弹窗→标签；局促时页眉按钮直接开标签；标签已开时按钮改为**聚焦**（见 T2.4/T2.7 移除记录）。`openTab` 一律不传 `revealIfOpened`，用宿主默认 `true`（去重 + 聚焦）。

- [x] ~~T2.4 [REQ-3.2] 标签 → 弹窗一键切换~~ —— **用户决定移除（2026-10-08）**
  - 内容：标签内切换按钮关标签 + 开弹窗
  - 验证：点击后标签关闭、弹窗出现（人工目视清单第 6 项）—— **该目视项已作废**
  - 原实测（2026-10-08，实现过并真机验证过）：标签正文 = `.dsh-leanspec-tab`（`LeanspecTabView`）：`.dsh-leanspec-switchbar` + 按钮「用弹窗打开 ⧉」（`data-leanspec-switch="popup"`）→ `switchToPopup(tabId)`；`tabId` 来自宿主注入的 `useTabInfo()` → `readTabId()`。**真机目视 #6 当时是通过的。**
  - **移除记录（2026-10-08，用户：「标签转弹框我觉得没有必要」）**：按钮、`switchToPopup()`、`dismissLeanspecTab()`、`readTabId()`/`useTabInfo` 接线、`.dsh-leanspec-tab-notice` 样式与 `LeanspecTabView` 的 props 全部删除（无死代码）；标签正文**永远**直接渲染 `LeanspecViewer`（`test/tab-views.test.ts`「the tab body draws the panel and nothing else」+「the tab body never reads the host tab payload」钉住「没有任何切换入口」）。替代语义 = **单向 + 聚焦**（页眉按钮聚焦已开标签，绝不在标签旁再开弹窗），详见 design.md §13.3。

- [x] T2.5 [REQ-3.3] 同屏唯一实例约束
  - 内容：store 的 `surface` 作为唯一真相；渲染层保证互斥
  - 验证：`npm test`（同一时刻只渲染一个面板外壳的断言）
  - 实测（2026-10-08）：互斥由两层保证，都有断言 —— ①**状态层**：`reduceViewer` 的 `set-surface 'tab'` 必然 `popupOpen: false`，`set-popup-open true` 必然 `surface: 'popup'`（`test/tab-switch.test.ts`「the store itself keeps the two exits exclusive」）；②**渲染层**：弹窗外壳只在 `popupOpen && surface === 'popup'` 时画（`test/tab-views.test.ts`「the popover is drawn only while the popup owns the panel」）。跨形态保留由 `popup → tab → popup` 往返断言钉住：`selected` / `draft` / `split` / `mode` / **`expanded`** 五个值逐一相等（REQ-3.4）。
  - 毛边 1（**已修，2026-10-08**）：正文挂载/卸载现在会写 store（`noteTabMounted()` → `surface = 'tab'`；`noteTabUnmounted()` → `surface = 'popup'`），所以「弹窗关掉后 surface 仍是 tab」的状态错位不可能再出现；同时「隐藏标签 + 弹窗」两份面板的路径也被挂载动作封掉。
  - 毛边 4（原：关掉弹窗后标签正文画占位而不是面板 —— **已随 T2.4 移除一并消失**）：正文不再有占位分支，挂载即渲染面板。

- [x] T2.6 [REQ-4.2][REQ-4.3] 关闭后重开与卸载清理
  - 内容：标签关闭 → 调用 disposer、移除 resize/指针监听；再点按钮能重开并恢复状态
  - 验证：`npm test`（卸载后监听数与注册数归零的断言）+ 人工目视清单第 7、8 项
  - 实测（2026-10-08）：宿主自带的 × 只卸载正文，不动我们的注册；正文卸载后 store 里的选中文件/草稿/分栏宽/目录展开层级原样保留，下一次点击（页眉按钮按 `decideSurface` 开弹窗或开标签）拿回同一份状态。卸载路径 `applySidebarTab` 返回的 disposer：先 `disposeScope()` 跑完 5 个 `ctx.effect` 清理，再 `forgetHost()`（清空 opener/host + 重新探测 + `available=false`）。**本轮变更**：`closer` / `releaseRegistrations`（三级关闭链的中间态）随 T2.7 一起删除；新增 `noteTabMounted()`/`noteTabUnmounted()` 作为「标签是否存在」的唯一信号（正文 `useEffect` 的挂载/清理各调一次）。
  - 实测门：`test/tab-switch.test.ts`「unloading zeroes the registrations and a second apply works again」（卸载后 `typeIds()` 空、seat 0、liveEffects 0、`openLeanspecTab().ok === false`；再 `applySidebarTab` 一次又能注册 2 个 seat 且 `available === true`）、「reopening after the host closed the tab by its × still works」与「the tab body unmounting hands the panel back to the popup」（× 之后 `surface` 复位 'popup'、`popupOpen` 未被动打开、选中/草稿未动）。
  - **真机目视（用户 2026-10-08）**：目视清单 #7 通过 —— × 之后标签栏干净、再点页眉按钮能重开 ✅。**#8（禁用/重启用后是否无重复标签）用户尚未确认，仍待验证。**

- [x] ~~T2.7 [REQ-4.4] 探测并实现 tab → popup 的三级关闭降级~~ —— **用户决定移除（2026-10-08）**
  - 内容：运行时探测 `ctx.sidebarRight.closeTab`；不存在则走 disposer 注销；再不行渲染「已切回弹窗」占位 + 「回到标签」按钮
  - 验证：`npm test`（三个分支各自可渲染且不抛错）+ 人工目视：切回弹窗后不出现空白标签 —— **该目视项随需求一并作废**
  - 原实测（2026-10-08，宿主事实先修正过）：服务上的真实入口是 **`close(tabId)`**（asar 675338，紧邻 `active()`/`focus(tabId)`），`closeTab` 只出现在 dock 的 intent 面 —— 探测因此 `close` 优先、`closeTab` 兜底（`readCloseMethod`）。`dismissLeanspecTab(tabId)` 返回 `{ level, closed }`：`service` → `disposer` → `placeholder`（占位文案「已切回弹窗」+「回到标签」）。服务 close 抛错会落到下一级。
  - **移除记录（2026-10-08）**：既然插件不再主动关标签，三级降级与占位都没有触发路径，全部删除（`dismissLeanspecTab` / `switchToPopup` / `readCloseMethod` / `CloseStrategy` / `chooseCloseStrategy` / `TabCapability.close`、`canCloseViaService`、`.dsh-leanspec-tab-notice` 样式、`test/tab-switch.test.ts` 的 5 例关闭链测试与 `test/tab-views.test.ts` 的 2 例占位测试）。**`close(tabId)` 这个宿主事实保留在 design.md §13**（登记为「已量测、本版不用」，将来若要恢复双向切换可直接接上）。仍然保留的硬约束是「失败也必须有面板」：页眉按钮 `openTab` 失败时回退到弹窗（REQ-8.1，`test/tab-switch.test.ts`「a tab that refuses to open falls back to the popup on the header path」）。

---

## Phase 3：断点判定与不越界（P3）

- [x] T3.1 [REQ-1.1][REQ-1.2][REQ-1.4] 实现 `decideSurface`
  - 内容：纯函数，入参 `{ viewportWidth, viewportHeight, anchorBottom, edge }`，返回 `'popup' | 'tab'`
  - 验证：`npm test -- --test-name-pattern=decideSurface`（边界 1087/1088、711/712、以及页眉变高场景）
  - 实测（2026-10-08）：`src/client/surface.ts` 里**所有魔数只写一次**并互相推导 —— `PANEL_WIDTH=1040`、`PANEL_HEIGHT=640`、`PANEL_EDGE=24`、`ANCHOR_GAP=8`、`ANCHOR_FALLBACK=48`，断点由 `SURFACE_MIN_WIDTH = PANEL_WIDTH + 2*PANEL_EDGE = 1088` 与 `SURFACE_MIN_HEIGHT = PANEL_HEIGHT + ANCHOR_FALLBACK + PANEL_EDGE = 712` 算出。`decideSurface()` 恒有返回值：视口不是有限数、或 `anchorBottom`/`edge` 不可用（NaN / 负数 / Infinity）时分别回落到 48 / 24，视口不可用则判为**局促**（`'tab'`），由调用方的能力回退（REQ-8.1）决定是否可行。`anchorBottomFromTrigger(bottom) = bottom + ANCHOR_GAP` 是「页眉下沿 → 锚点」唯一的加法点，供 T3.3 注入同值。
  - 实测门：`test/surface.test.ts` 6 例（断点推导；1088×712 popup / 1087 或 711 tab；锚点 60 → 724 / 40 → 704 的移动；自定义 edge；不可用输入回落；NaN/Infinity/负数/0 视口全部 'tab'；`anchorBottomFromTrigger` 的 4 种输入）。**与 design.md §4 的算术差异**：§4 按 52px 锚点写成 716，与上级钉的 712 冲突 —— 本实现取 **712**（48px 兜底），并把差异记在 design.md §4.1。真机锚点仍待 T0.3 量测。

- [x] T3.2 [REQ-1.3][REQ-1.5][REQ-1.6][REQ-1.7] 实时跟随 + 守卫 + 手动钉住
  - 内容：`resize` 节流 150ms → 重新 `decideSurface` → 有变化则切形态；拖动中推迟；`ctx.sidebarRight.mounted` 为假则等挂载；手动切换置 `pinned`，面板关闭/重开时清除
  - 验证：`npm test`（跨阈值翻转 surface、拖动中不切、pinned 期间不切、清 pin 后恢复跟随）+ 人工目视清单第 9、11、12 项
  - 实测（2026-10-08）：新增 `src/client/surface-follow.ts`，切成两半 —— ①`planFollow(snapshot, { measured, mounted })` 是**全部策略的纯函数**，守卫按顺序：`no-panel` → `in-sync` → `pinned` → `dragging` → `tab-wins`（有活标签就不开弹窗）→ `sidebar-not-mounted`（deferred）→ `switch`；能力不可用时决策被改写成 `popup`（REQ-8.1）。②`createSurfaceFollower()` 只负责接线：一次 `resize` 订阅、**150ms 节流（前沿立即 + 窗口内合并到尾部再跑一次）**、每次求值前 `onTick()` 刷新注入的 `--anchor`、`dispose()` 退订并清定时器。守卫解除（拖动结束 / 右栏挂载 / pin 清除）时由 `LeanspecHeaderAction` 的一个 effect 主动 `evaluate()`，不必等下一次 resize。页眉按钮语义（A.2）：活标签 → **聚焦**（`openTab` 宿主默认去重）+ 绝不开弹窗；否则先 `decideSurface`，'tab' 才 `openTab`（失败回退弹窗），'popup' 才开弹窗。`pinned` 只由弹窗内「在右栏打开」设置，`set-surface`/`set-popup-open` 任何一次移动都清 pin（REQ-1.7）。
  - 实测门：`test/surface-follow.test.ts` 14 例（策略守卫逐个 + 顺序；节流的前沿/尾部/窗口内合并；150ms 常量；deferred 只播报一次；`dispose` 后监听与定时器归零；`evaluate()` 直接被调用的两条路径）+ `test/tab-switch.test.ts` 3 例（手动 pin / 自动不 pin / 关面板清 pin；页眉按钮宽→弹窗、窄→标签；活标签时聚焦不开弹窗）+ 1 例（不可用宿主窄视口仍拿弹窗）+ 1 例（`openTab` 抛错回退弹窗并给原因）+ `test/client-apply.test.ts` 2 例（宿主有 `sidebarRight.mounted` 时 seat 的 `inject` 返回 `{ hooks: { sidebarMounted } }`；无服务或 `get` 抛错时返回 `{}`）。
  - **未验证（诚实边界）**：`useSidebarMounted` 是**宿主注入的 hook**，Node 里没有渲染器，所以「真实宿主确实把 `sidebarMounted` 传给了我们的组件」只能靠 asar 里第一方写法（design.md §13.4）对齐，**我没有在真机上确认过**；deferred 分支只有纯函数级证据。目视清单 #9（拉伸跨阈值自动切换）、#11（pin）、#12（拖动中推迟）**仍待用户**。

- [x] T3.3 [REQ-2.1][REQ-2.3] 弹窗尺寸改为 1040×640 + CSS 上限
  - 内容：`width: min(1040px, calc(100vw - 48px))`、`height: min(640px, calc(100vh - var(--anchor) - 24px))`；锚点行内注入
  - 验证：`npm test`（样式断言：两条 `min()`/`calc()` 规则存在、零 hex）+ `npm run typecheck`
  - 实测（2026-10-08）：`styles.ts` 的 `.dsh-leanspec-popover` 改为 `width: min(1040px, calc(100vw - 48px))` / `height: min(640px, calc(100vh - var(--anchor, 48px) - 24px))`（零 hex、只 `--dsw-*` 颜色 token，未引入反引号/`${}`）。锚点是**行内注入**：`LeanspecHeaderView` 在弹窗外壳上写 `style={{ '--anchor': anchor + 'px' }}`，值来自 `rootRef.current.getBoundingClientRect().bottom` → `anchorBottomFromTrigger()`（挂载时量一次、每次节流 tick 与打开时刷新）；没量到就不写行内样式，交给 CSS 兜底 `var(--anchor, 48px)`。
  - 实测门：`test/popover-metrics.test.ts` 直接**求值 CSS 文本**（40 行 `min()/calc()/var()` 求值器）而非复述常量；`test/tab-views.test.ts`「the popover receives the measured anchor, and no inline style without one」断言 `style = { '--anchor': '56px' }` 与「无锚点时 `style === undefined`」；`test/styles.test.ts` 新增「标签正文不再留切换样式」例。
  - **未验证**：真实页眉高度（T0.3）与右边距仍是假设；`box-sizing: border-box` 对弹窗生效情况未在真机量过（宿主全局样式决定）。

- [x] T3.4 [REQ-2.2] 不越界量测
  - 内容：复现上轮量测脚本：注入真实 CSS + 宿主全局 `border-box`，在 1920/1440/1088/1087 与 712/711 视口断言左边界 ≥0、底边 ≤ 视口高、正文 ≥360
  - 验证：量测脚本输出全部通过（记录数值到本任务下）
  - 实测（2026-10-08）：量测对象是**线上真正下发的那段 CSS 文本**（从 `LEANSPEC_STYLES` 里正则取出 `width`/`height` 声明再求值），不是重写一遍公式。假设：页眉右内边距 24px（`HEADER_GUTTER`，T0.3 未量）、弹窗内切换条高 41px（26px 按钮 + 2×6px padding + 1px 边框 + 1px 下边框，从 CSS 规则推出）、锚点取兜底 48（另测 40 / 80 两档）。
  - 实测数值（锚点 48；`left = 视口宽 - 24 - 实际宽`，`bottom = 锚点 + 实际高`，`body = 实际高 - 41`）:

    | 视口 | 决策 | width | height | left | bottom | body |
    |---|---|---|---|---|---|---|
    | 1920×712 | popup | 1040 | 640 | 856 | 688 | 599 |
    | 1920×711 | tab | 1040 | 639 | 856 | 687 | 598 |
    | 1440×712 | popup | 1040 | 640 | 376 | 688 | 599 |
    | 1440×711 | tab | 1040 | 639 | 376 | 687 | 598 |
    | 1088×712 | popup | 1040 | 640 | 24 | 688 | 599 |
    | 1088×711 | tab | 1040 | 639 | 24 | 687 | 598 |
    | 1087×712 | tab | 1039 | 640 | 24 | 688 | 599 |
    | 1087×711 | tab | 1039 | 639 | 24 | 687 | 598 |

  - 全部 8 格 × 3 档锚点都不越界：`left ≥ 0`、`bottom ≤ 视口高`、`body ≥ 360`（最小 598）✅。**已知保守 1px**：1087 宽时 CSS 实际宽 1039，物理上仍能放下，但断点按上级钉的 1088 判为 `tab`（少 1px 就退到标签）——这是刻意的保守，不是 bug。**未验证**：真实宿主页眉的右内边距（若 > 48px，1088 宽下 `left` 才会变负）。

- [x] T3.5 [REQ-8.2] 能力缺失时的按钮态
  - 内容：禁用 + 原因文案「当前宿主版本不支持右栏标签」
  - 验证：`npm test`（能力 false 时按钮 disabled + 文案断言）
  - 实测（2026-10-08）：页眉弹窗里的切换按钮读 `tabCapability()`（组件订阅 `subscribeTabCapability`，服务于作用域注入到达后会刷新，不是只在挂载时采样一次）；`available === false` 时按钮 `disabled` + `title` 与旁边文案都给 `unavailableReason`（`TAB_UNAVAILABLE_HOST` = 「当前宿主版本不支持右栏标签」，含「不支持」）。**能力不可用时点不动也不会偷偷什么都不发生**：`switchToTab()` 在没有 opener 时直接返回 `{ok:false, reason}`，`headerActions` 把它写进 `failure` 文案，且一次都没碰宿主 `openTab`。
  - 实测门：`test/tab-views.test.ts`「an unusable switch button is disabled and says why」（`disabled === true` + 文案匹配 `/不支持/` + `title` 等于常量）与「a failing switch keeps the popup and hands the reason to the button」（`failure` 收到原因、弹窗仍然开着、页面里渲染出该原因）；`test/tab-switch.test.ts`「with no tab surface at all the click never reaches the host」（宿主无 `inject` 时 `available === false`、原因 = `TAB_UNAVAILABLE_HOST`、store 未被改动）。

---

## Phase 4：文档、测试与验收（P4）

- [x] T4.1 更新 `README.md`
  - 内容：新增「双形态面板」「拖拽分栏」两节；版本历史补条目；说明断点为何是 1088/712
  - 验证：人工通读；`grep -n "1088" README.md` 命中
  - 实测（2026-10-08）：README 新增「功能说明」两节（双形态面板 / 拖拽分栏）、「为什么是 1088 / 712」的推导（1040 + 2×24 与 640 + 48 + 24，含「真实锚点未测 ⇒ `ANCHOR_FALLBACK` 与 CSS `var(--anchor, 48px)` 必须一起改」的提醒）、「已知限制」三条（单向、活标签优先、pin 只维持一次会话）与「真机验收状态」表。`grep -n "1088" README.md` 命中 ✅

- [x] T4.2 样式测试补齐
  - 内容：分隔条样式（宽度、hover 态、`touch-action`）、零 hex 断言、`flex: 0 0 auto` 回归断言
  - 验证：`npm test` 全绿（含既有 002 断言未被破坏）
  - 实测（2026-10-08）：`test/styles.test.ts` 新增两例 ——「the popover declares both caps in the shipped stylesheet」（正则取自真正下发的 CSS：`width: min(1040px, calc(100vw - 48px))`、`height: min(640px, calc(100vh - var(--anchor, 48px) - 24px))`、标签正文 `width/height: 100%`）与「the tab body keeps no styling for a switch it no longer has」（`.dsh-leanspec-tab-notice` 不存在、`.dsh-leanspec-switchbar` 仍在）。零 hex 与 `--dsw-*` 断言沿用既有例 ✅ `test/styles-source.test.ts` 的「模板字面量里只有两个反引号 + 无 `${`」守卫继续通过（本轮改过 CSS，特意复跑）。

- [x] T4.3 全量质量门
  - 验证：`npm test` + `npm run typecheck` + `npm run build` 三者全绿，记录用例数与 `lib/client.js` 体积
  - 实测（2026-10-08，最终一轮，上级独立复跑一致）：`npm run typecheck` → **0 error**；`npm test` → **tests 270 / pass 270 / fail 0**（本轮起点 228；269 是 T4.3 当时的快照，其后 pin 挂载修复 +1 例）；`npm run build` → `lib/index.js` **12522 B**、`lib/client.js` **137138 B**（133.9kb，上一版 130706 B）；`test/styles-source.test.ts` 守卫通过（2 个反引号 / 无 `${`）。

- [x] T4.4 [REQ-4.3] 卸载回归 —— **用户真机目视通过（2026-10-08）**
  - 内容：插件禁用/重启用一次，确认无重复注册、无重复标签、无遗留监听
  - 验证：人工目视清单第 8 项
  - 实测（2026-10-08）：用户在归档确认时选定「两项都过了 ✅ 直接归档」，即**真机禁用 → 重启用后标签栏里只有一个 LeanSpec、无报错**（目视 #8 通过）。假宿主侧证据同向：卸载后注册 / seat / effect 全 0，再 `apply` 一次可重新注册（`test/tab-switch.test.ts`）。

- [x] T4.5 [REQ-3.4] 同根因顺带修复：切形态不丢会话状态（2026-10-08，用户报告 + 审计，上级批准保留）
  - 内容：① `expanded` 从组件 `useState` 移入 store（真机 bug「弹窗 → 标签 时会把展开的目录层级合上」）；② store 记 `loadedKey` + 纯函数 `needsFileLoad()`，阻止重挂载重拉 `/file` 覆盖未保存草稿（**数据丢失级**）
  - 验证：`npm test`（往返 5 值相等、跨形态同一 Set 实例、卸载重挂后仍可变；`needsFileLoad` 四条边界：同路径+脏草稿→不拉 / 换路径→拉 / 无 key→拉 / 保存成功后→不拉）
  - 披露方式：先报告后落地（上级第 ③ 条拍板「保留，不回退」），审计表见 design.md §13.4

- [x] T4.6 [REQ-1.3] 后台刷新：重拉 `/tree` 不清屏（2026-10-08 上级要求）
  - 内容：`loadStatus === 'loading'` 且已有数据（`hasTreeData()`）且 `present` 时继续渲染旧树，只在 `<nav>` 标 `aria-busy`；首次无数据才显示加载态。**不掐掉重拉**（它是当前唯一的新鲜度来源）
  - 验证：`npm test` 两例 —— 有数据时重拉期间 `showTree === true` / `refreshing === true` 且 `specs/files/dirs` 原样；无数据（首次 & 加载失败后）`showTree === false` / `refreshing === false`

---

## Phase 5：验收后追加调整（2026-10-08）

- [x] T5.1 [REQ-8.1] 把「在右栏打开」搬到目录栏标题行、靠右对齐（用户验收后小调）
  - 需求原文（用户 2026-10-08）：「在右侧打开是否可以做到和左边目录栏里面的 LeanSpec 字样同行，并在目录栏的区域里靠右对齐」
  - 实现：`LeanspecViewer` 新增可选 `headAction`（`ReactElement`）；左栏标题改渲染成 `.dsh-leanspec-aside-head`（`display: flex` + `justify-content: space-between` + `flex: 0 0 auto` + `padding: 8px 14px 6px`）；`.dsh-leanspec-aside-title` 让出内边距并加 `min-width: 0` / `overflow: hidden` / `text-overflow: ellipsis` / `white-space: nowrap`（分隔条拉到 180px 下限时**先压标题**，不把按钮挤出目录栏）；弹窗把按钮作为 `headAction` 传入，`.dsh-leanspec-switchbar` 降级为**只在有原因或失败时**才渲染的提示行（CSS 规则保留，`padding` 由 `6px 8px` 改 `6px 14px` 与左栏对齐）。
  - 验收：`npm run typecheck` 干净；`npm test` → **271 / 271 / fail 0**（新增两条：`tab-views` 断言按钮作为 viewer 的 `headAction` 传递且只渲染一次、`styles` 断言 header row 是 `space-between` 且标题可省略）；`npm run build` → `lib/index.js` 12522 B 未变、`lib/client.js` 135.1kb。
  - 真机复验：**待用户** —— 弹窗里按钮应与「LeanSpec」**同一行**且靠**目录栏右边缘**；把分隔条拉到 180px 时按钮仍在（标题先被省略）；宿主不支持时顶部原因行仍在。
  - ⚠️ 踩坑留痕：本轮我曾在 `styles.ts` 的 CSS 注释里写**反引号**，直接把 `LEANSPEC_STYLES` 模板串截断（`test/styles-source.test.ts` 守卫与 `tsc` 同时报错，一次性抓到）→ 已改回全角引号「」。这就是该守卫存在的意义。

---

- [x] T5.2 [REQ-8.1] 目录栏标题行不换行：按钮不收缩 + 文案精简为两字（用户报告，2026-10-08）
  - 需求原文：「控制一下目录栏最小宽度，不要让【在右侧打开】转行，或者把这五个字精简成两三个字」
  - 结论：**两条都做，但不动 180px 下限**。账：180px 内 `28(左右内边距 14+14) + ~58(LeanSpec 12px 粗体) + 8(间距) + ~64(两字按钮 + 图标 + 10px 内边距×2 + 边框) ≈ 158px` —— **放得下**。真正导致换行的是按钮**缺 `white-space: nowrap`**：flex 子项被压缩后中文在**字间**断行，整行随之变高，看起来像"栏目太窄"。
  - 实现：① `.dsh-leanspec-switch` 加 `flex: 0 0 auto` + `white-space: nowrap`（该行唯一**不可压缩项**；标题靠 `min-width: 0` + ellipsis 先让位）；② 可见文案 `在右栏打开 ⧉` → **`右栏 ⧉`**（两字 + 图标），全句移入 `title` 与**新增的 `aria-label`**（无障碍名包含可见文字，符合 label-in-name）。
  - 验收：`npm run typecheck` 干净；`npm test` → **271 / 271 / fail 0**（新增断言：`.dsh-leanspec-switch` 必须 `flex: 0 0 auto` 且 `nowrap`；弹窗按钮**可见文字 ≤4 字**且带全句 `aria-label`）；`npm run build` → `lib/index.js` 12522 B、`lib/client.js` **135.8kb**。
  - 若日后仍要抬高下限：把 `surface.ts` 的 `SPLIT_MIN` 180 → 200/220 即可，但**必须同步**改 `design.md` T1.2 冻结值、`test/surface.test.ts` 的 179/180/420/421 边界与文档里的「180–420px」表述（**本轮未做，等用户拍板**）。
  - 真机复验：**待用户** —— 把分隔条拉到最窄，按钮应**始终一行**；「LeanSpec」可被省略，按钮不可。

---

## 人工目视清单（替代 E2E，用户豁免）

> **真机验收记录（2026-10-08，用户口述，逐条照记）**
>
> | 项 | 结果 | 依据 |
> |---|---|---|
> | #4 右栏出现 LeanSpec 标签 | ✅ 通过 | 用户：「已经能正常在侧边栏看到了」 |
> | #5 弹窗内点「在右栏打开」 | ✅ 通过 | 用户当面确认 |
> | #6 标签内点「用弹窗打开」 | ✅ 曾通过，**该入口已移除**（用户：「标签转弹框我觉得没有必要」） | 见 T2.4 移除记录 |
> | #7 点宿主标签 × 后再点页眉按钮 | ✅ 通过 | 用户当面确认（无残留空白标签） |
> | 高度风险（弹窗比原设计高 80px 会不会顶到页眉） | ✅ 解除 | 用户：「目录高度正常」→ 因此**不**加 `min-height`（保持 CSS 单一上限，见 T3.3） |
> | #2 拉窄窗口自动出标签 | ✅ 通过 | 用户 2026-10-08「验证过了」（归档确认）|
> | #8 禁用/重启用无重复标签 | ✅ 通过 | 用户 2026-10-08 选定「两项都过了」|
> | #9 / #11 / #12 跟随、钉住、拖动中推迟 | ✅ 通过 | 同上（用户整体确认）|
> | #13 / #14 / #15 展开层级、不闪空、草稿保留 | ✅ 通过 | 同上（#13/#15 是两个 bug 修复的回归项）|
> | T0.3 真机页眉几何（锚点 / 右内边距） | ⚪ **用户豁免**（不量）| 运行时实测注入 + CSS 视口上限；见 T0.3 豁免记录 |
>
> 除上表之外，本 Spec 的所有结论都来自纯函数单测、假宿主逻辑测试与 CSS 量测；**没有一项是"我在真机上看到的"**。

| # | 场景 | 期望 |
|---|------|------|
| 1 | 宽窗口点页眉按钮 | 弹窗 1040×640，不越界 |
| 2 | 拉窄窗口（<1088）点按钮 | 右栏出现 LeanSpec 标签（不是弹窗）|
| 3 | 拖分隔条到最左 / 最右 | 目录 180 / 420；正文始终 ≥360 不消失 |
| 4 | 刷新页面后打开 | 目录宽度与上次一致 |
| 5 | 弹窗内点「在右栏打开」| 弹窗消失、右栏标签出现并聚焦 |
| 6 | ~~标签内点「用弹窗打开」~~ | ~~标签关闭、弹窗出现~~ **已移除（2026-10-08）**：标签内不再有任何切换入口 |
| 7 | 点宿主标签 × 关闭后再点页眉按钮 | 标签重开，选中文件与草稿还在（目录展开层级同样保持）|
| 8 | 禁用插件再启用 | 无重复标签（只一个）、无报错 |
| 9 | 面板打开时拉伸窗口跨过 1088 / 712 | 自动切到对应形态，内容与草稿不断 |
| 10 | 焦点在分隔条按 ←/→ | 宽度 16px 步进，屏幕阅读器可读 |
| 11 | 手动切一次后再拉伸跨阈值 | 保持手动选的那个形态（钉住）|
| 12 | 拖动分隔条途中拉伸跨阈值 | 拖动结束后才切换 |
| 13 | 弹窗里展开两层目录 → 切到标签 | 展开的层级仍在（2026-10-08 真机 bug 的回归项）|
| 14 | 切形态的瞬间看目录栏 | 不闪空（后台刷新，旧树继续显示，无加载占位）|
| 15 | 编辑到一半（草稿未保存）切形态 | 草稿原样还在，不被磁盘内容覆盖 |
