---
status: complete
type: bugfix
priority: high
tags: [viewer, state, workspace, bugfix]
created: 2026-10-15
completed: '2026-10-15'
---

# 切换工作区后，预览区仍显示上一个工作区的 Spec

**类型**: 缺陷修复（bugfix）· 单文件 Spec（缺陷修复型不拆 requirements / design / tasks）
**状态**: complete（2026-10-15 结项，用户复看通过）
**优先级**: high（含跨工作区写入风险）
**创建日期**: 2026-10-15
**报告人**: 用户（2026-10-15 口头报告，原话：「如果我在 a 工作区打开了一个 spec 看，到 b 工作区的时候，点开弹窗仍然会有 a 工作区的 spec 展示在预览处」）

---

## 缺陷描述

面板的选中、已加载内容与草稿都住在**模块级单例** store 里（[store.ts:46](../../src/client/store.ts)）—— 这是 007 有意为之（弹窗与「右栏 ⧉」标签必须共享同一份状态）。但「共享」的边界应当是**一个工作区**：跨工作区时，上一根的选中文件会原样留在下一根的预览区里。

## 当前行为

**WHEN** 在会话 A（工作区 `/repo-a`）的面板里选中并加载了某个文件（如 `001-x/README.md`），随后切到工作区 `/repo-b` 的会话并打开面板
**THEN**

1. 预览区**仍然渲染 A 的文件内容**；B 的目录树加载完成后预览区**依旧**是 A 的内容（不重取、不清空）
2. 目录树在刷新窗口内还会短暂显示 A 的树 —— 这条是 007 的**后台刷新**设计，本身正确，不在本缺陷范围
3. 派生风险 ❌：若此时按 `保存`，请求会带**新根 B + 旧相对路径**（`writeSpecFile(root=/repo-b, path=A 的路径)`）；只要 B 里存在同名文件，就会被 A 的草稿**覆盖** —— 与 008 修的图片数据丢失同级

## 预期行为

**WHEN** 工作区根发生变化（`/repo-a` → `/repo-b`）
**THEN SHALL**

1. 预览区**不再出现 A 的任何内容**：`selected === null`、`content === ''`、`draft === ''`、`loadedKey === null`
2. 上一根的树结果不再被当作新根的数据：`specs` / `files` / `dirs` 清空、`statusByDir` 清空、`present === false`
3. 切回 A 时**恢复** A 的选中、展开层级、已加载内容与**未保存草稿**（用户 2026-10-15 选定方案 B：每个工作区各记各的）
4. `保存` 在新根下必须先有新一轮选中：`selected === null` ⇒ 写路径不可达

## 不变行为（回归防护 —— 本 Spec 的必选章节）

**WHEN** 同一工作区内切换形态（弹窗 ↔「右栏 ⧉」标签）
**THEN SHALL CONTINUE TO** 保留选中、目录展开层级与未保存草稿（007 REQ-3.4 —— 本次改动最容易误伤的一条）

**WHEN** 同一根内 `projectReady` 由 `false` 变 `true`（每次挂载都会发生）
**THEN SHALL CONTINUE TO** 只翻 `projectReady`，**不清任何状态**（返回同一个 state 对象）

**WHEN** 根仍为 `''`（工作区尚未就绪 / 会话 cwd 暂缺）
**THEN SHALL CONTINUE TO** 按「无根」处理：不记忆、不恢复，落到空片

**WHEN** 在 A 保存后切到 B 再切回 A
**THEN SHALL CONTINUE TO** 看到 A 保存后的内容（`loadedKey` 命中 ⇒ 不重取、不覆盖）

**WHEN** 用户把分栏宽度 / 形态 / 钉住 / 拖拽中这些 **UI 偏好**带过工作区边界
**THEN SHALL CONTINUE TO** 保持不变（它们与项目无关）

**WHEN** 运行既有测试
**THEN SHALL CONTINUE TO** 全绿（本 Spec 开工前基线：**tests 271 / pass 271 / fail 0**）

## 根因分析

| # | 位置 | 事实 |
|---|------|------|
| 1 | `src/client/store.ts:46` | `viewerStore` 是模块级单例，跨工作区一直存活（007 有意：两形态共享一份状态） |
| 2 | `src/client/viewer-state.ts`（原 `case 'set-project'`） | 只替换 `projectRoot` / `projectReady`，**其余字段原样保留** |
| 3 | `src/client/LeanspecViewer.ts:492` | 树 effect 依赖 `[projectReady, projectRoot]` ⇒ 换根**会**重取（所以树看着会更新，掩盖了问题） |
| 4 | `src/client/LeanspecViewer.ts:494-499` | 文件 effect 先问 `needsFileLoad`；`loadedKey === textKey` ⇒ **提前返回** ⇒ A 的内容既不重取也不清空 |
| 5 | `src/client/viewer-state.ts:172-179` | `needsFileLoad` 只看 `loadedKey`（不含根）⇒ 旧根的「已加载」在根变后仍然成立 ❌ |

⇒ 一句话：**根变了，但「这份内容属于哪个根」没有被表示**，于是 A 的内容合法地留在了 B 的预览区。

## 修复设计（最小变更）

1. 新增 `ProjectSlice` —— 把「根相关字段」收成一个可停放的**值**（`src/client/viewer-state.ts`）
2. 新增纯函数 `sliceOfProject` / `withProjectSlice` / `switchProject` / `rememberProject`（+ 私有 `refreshedSlice`）
3. `set-project` 改走 `switchProject`：
   - 同根同 ready ⇒ 返回**原对象**（零重渲染）
   - 同根异 ready ⇒ 只翻 `projectReady`（**绝不清**）
   - 异根 ⇒ 停放旧片 + 恢复新片（无记忆则空片）
4. 记忆上限 `PROJECT_MEMORY_LIMIT = 8`，LRU 淘汰（对象键插入顺序 + 重插到末尾）；**正在恢复的那个根永不淘汰**
5. **不动**：store 单例结构、任何 React 组件、host 契约；`needsFileLoad` 的语义也一字不改（换根后 `loadedKey` 自然为 `null`，原语义自动成立）

**为什么把记忆放进 state 而不是模块级 Map**：放进 state 才能被纯函数与测试完全驱动，也避免模块级缓存污染测试；这与仓库既有风格一致（一切皆可 `reduceViewer` 的值）。

## 既有断言的语义订正（2026-10-15，改动过程中发现）

`test/viewer-state.test.ts` 的 `the expanded set survives every other action (the surface-switch bug)`（007 时期写下）原本把 `{ type: 'set-project', root: '/repo', ready: true }` 混在「其他所有 action」里，断言它**不得清树**。那条断言成立于「`set-project` 从不清任何东西」的旧语义 —— 正是本缺陷的成因。

订正后该用例表达的是**它本来想表达的场景**：一次重挂载 = **同一个根**被再次宣告（含 `ready` 翻转），树必须原样保留；而**不同的根**是工作区切换，按根各自的记忆开始（新增用例覆盖）。代码层面两者都仍然成立：同根 ⇒ 返回原对象或只翻 `ready`；异根 ⇒ 换片。

> 这条订正不与「不变行为」冲突：`WHEN 同一工作区内切换形态 THEN SHALL CONTINUE TO 保留展开层级与草稿` 仍由同根路径保证，并被该用例逐条钉住。

## 已知残余（诚实记录，不在本 Spec 范围）

- **保存竞态**：`保存` 与「切工作区」几乎同时发生（毫秒级窗口）时，晚到的 `save-success` 会落到**新片**上，可能把新片的 `content` 顶成它的 `draft` 并把保存提示点亮。影响仅限提示与显示，**不写错文件**。彻底修需把 `root` 带进 `save-*` action（扩大改动面），本期记为已知项。
- **根抖动**：`A → '' → A`（工作区列表瞬时未就绪）会走两次换根：A 先被停放、面板短暂落到空片，随后恢复。数据无损，只有一次闪烁。
- **记忆是进程内的**：刷新页面即清空（与 split 之外的所有面板状态一致）。

## 验收标准（EARS，可二值判定）

| # | GIVEN | WHEN | THEN SHALL | 判定方式 |
|---|-------|------|-----------|---------|
| A1 | 根 A，已选中并加载 `001-x/README.md` | 根变为 B | `selected === null` 且 `content === ''` 且 `draft === ''` 且 `loadedKey === null` | 单测 |
| A2 | 同上 | 根变为 B | `specs`/`files`/`dirs` 为空、`statusByDir` 为 `{}`、`present === false` | 单测 |
| A3 | A 有选中 + 未保存草稿 + 展开项 + 状态表 | B 切回 A | A 的 `selected`/`draft`/`content`/`expanded`/`statusByDir` 全部恢复，`saveStatus === 'idle'`、`saving === false` | 单测 |
| A4 | 根 A（含选中与草稿） | `ready` 由 `false` 变 `true` | 返回**同一个 state 引用**（`Object.is` 为真），字段一个不动 | 单测 |
| A5 | 根 A 已加载 key K | 根变为 B | `needsFileLoad(state, K, true) === true`（旧根的「已加载」对新根无效） | 单测 |
| A6 | 根变为 B | 立刻 | `selected === null` ⇒ 组件的保存入口（`textKey === null`）不可达 | 单测 + 代码路径 |
| A7 | 任意根切换 | 切换前后 | `split` / `surface` / `popupOpen` / `pinned` / `dragging` 全部不变 | 单测 |
| A8 | 依次切过 9 个根 | 第 9 次切换后 | 记忆恰好保留最近 8 个根、最早的被淘汰，且不抛错 | 单测 |
| A9 | 根为 `''` | 再收到 `''` | 返回原对象（幂等） | 单测 |
| A10 | 全部改动 | `npm run typecheck` / `npm test` / `npm run build` | 三绿，且测试数 ≥ 271 + 新增 | 命令输出 |

## 硬规则偏离说明（显式记录，非静默跳过）

| 硬规则 | 偏离 | 依据 |
|--------|------|------|
| UI 需求必须配 E2E（`e2e/*.spec.ts` + `./harness/verify-e2e.sh`） | **豁免** | 本仓库既无 `harness/` 也无 `e2e/`（实测 `Test-Path` 均为 `False`）；用户自 002 起持续裁定「测试的问题我来，肉眼看」（007 显式确认、008 沿用）。本缺陷正是**用户肉眼发现**的，修后同样由用户复看确认 |
| 生成前先读模板 | 已读 `.lean-spec/templates/bugfix-template.md` ✅（需求/设计/任务模板在本仓库缺失，缺陷修复型只需本模板） | 本章节即模板「不变行为」必选项的落地 |
| `docs/` 全树 SSoT 预检 | **不适用** | 本仓库没有 `docs/` 目录（实测），无资料需登记 |
| 原型视觉对照（`verify-visual.sh`） | **不适用** | 无原型链接或截图，本次修复不改变任何视觉呈现 |

## 任务

- [x] T1 新增纯函数与 `set-project` 改造
  - 变更文件：`src/client/viewer-state.ts`
  - 验证：`npm run typecheck` 干净（无输出）
- [x] T2 复现测试（先红后绿）
  - 测试文件：`test/viewer-state.test.ts`
  - 验证：新增用例在改动前**失败**、改动后**通过**（先红后绿的证据留在汇报里）
- [x] T3 不变行为回归（对应 A3 / A4 / A5 / A7）
  - 测试文件：`test/viewer-state.test.ts`
  - 验证：`npm test` 全绿，含既有 271 项
- [x] T4 记忆上限与边界（对应 A8 / A9）
  - 测试文件：`test/viewer-state.test.ts`
  - 验证：9 个根切换后仅留 8 个；`''` 幂等
- [x] T5 三绿 + 文档回写
  - 变更文件：本 README、`README.md`（仓库根「版本历史」加一条）
  - 验证：`npm run typecheck` / `npm test` / `npm run build` 三绿并记录实际数字
- [x] T6 用户肉眼复看（2026-10-15 完成 ✅）
  - 场景：A 选中文件 → 切到 B（预览区不应再出现 A 的内容）→ B 选一个 → 切回 A（应原地恢复，含未保存草稿）→ 同工作区内弹窗 ↔ 右栏标签切换（草稿不丢）
  - 验证：用户逐条口头确认（本仓库无 E2E，依据见「硬规则偏离说明」）
  - 结项依据：用户 2026-10-15 原话「已经可以了」（重启 `dsh web` 后复看）

---

## 执行记录（2026-10-15，全部为本机真实输出）

| 任务 | 状态 | 证据 |
|------|------|------|
| T1 | ✅ | `npm run typecheck` → `tsc --noEmit` 无输出，`exit=0` |
| T2 先红 | ✅ | 临时把 `case 'set-project'` 退回旧语义后跑 `node --test --experimental-strip-types test/viewer-state.test.ts` → `ℹ tests 28 / pass 25 / fail 3`，`exit=1`。失败断言原文：`AssertionError: A1: no stale selection under B`、`AssertionError: A8: bounded at the limit`，以及 A9 用例整体失败。取证后按 SHA256 校验还原（改动前 = 改动后 = `942C0B72…D53FAF8`） |
| T2/T3/T4 后绿 | ✅ | `npm test` → `ℹ tests 277 / pass 277 / fail 0`，`exit=0`（基线 271 + 新增 6） |
| T5 | ✅ | `npm run build` → `lib/index.js` 12,522 B（未变）、`lib/client.js` 140,932 B（139,087 → +1,845 B），`exit=0`；仓库根 `README.md` 版本历史已加一条 |
| T6 | ✅ | 用户重启 `dsh web` 后逐条复看，2026-10-15 原话「已经可以了」 |

**关于「先红」的诚实说明**：6 个新增用例里，旧语义下真正变红的是 3 个（A1/A2/A5/A6 合一条、A8、A9）—— 它们直接钉住缺陷；`A3`（切回恢复）、`A4`（同根只翻 ready）、`A7`（UI 偏好不受影响）在旧语义下**也会通过**（旧代码什么都不清，所以"恢复"是平凡的），它们的价值是给**新实现**当护栏，防止换片时误伤。这一点不粉饰。

---

## 归档（2026-10-15）

- **状态转换，非物理搬运** ✅：目录仍为 `specs/009-project-switch-state-leak/`（与 002 / 007 / 008 一致 —— 保持路径稳定，不破坏跨文档引用、AGENTS.md 索引与 git 历史链接）
- **任务**：**6/6 全部完成** ✅（T6 由用户复看确认）
- **验收**：A1–A10 逐条可判定通过 ✅；「不变行为」6 条各有对应用例 ✅
- **结项门（本机真实输出）**：`npm run typecheck` 无输出 `exit=0` ✅ / `npm test` **277 tests · 277 pass · 0 fail** `exit=0` ✅ / `npm run build` `lib/index.js` 12,522 B、`lib/client.js` 140,932 B `exit=0` ✅
- **遗留（不影响结项，已在「已知残余」记录、未做代码改动）**：①「保存」与切工作区毫秒级撞车时，晚到的成功回执可能落到新片的提示位（**不写错文件**）；② `A → '' → A` 转场有一次闪烁，数据无损；③ 记忆为进程内，刷新页面即清
- **未提交**：本次改动仍在工作区，由用户自行提交

---

## 完成定义（DoD）

1. T1–T5 全部勾选，三绿命令留**实际输出**
2. 「不变行为」6 条各有对应用例，或有明确不做保证的理由
3. A1–A10 逐条可判定为通过
4. T6 由用户确认
