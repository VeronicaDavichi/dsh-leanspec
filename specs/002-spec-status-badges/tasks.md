# 任务：Spec 列表状态标签

> 每个任务均引用至少一个 REQ-N，并给出可执行的验证方法。
> 阶段顺序：Phase 0 测试策略裁定 → Phase 1 解析层 → Phase 2 服务端 → Phase 3 前端 → Phase 4 验证与文档。

---

## Phase 0：测试策略裁定（无实现任务）

> **裁定：豁免自动化 E2E，改由人工目视验收。**
> 依据：2026-10-08 用户明确指示 **「测试的问题我来，肉眼看」**。
>
> **背景**：本 Spec 的 REQ-1 / REQ-4 / REQ-5 属于 UI 需求，`leanspec-propose` 硬规则要求为每条 UI 需求生成 `e2e/*.spec.ts` 并由 `./harness/verify-e2e.sh` 跑绿。但本仓库：无 `harness/`、无 `e2e/`、无 Playwright；且实测浏览器直连 DSH GUI `http://127.0.0.1:43120` 返回 **403**（需会话 token），自动化不可达。为此新建整套浏览器测试能力的工作量**大于功能本身**。
>
> **替代方案（两道）**：
> 1. **组件级渲染断言**（T3.3）—— Node 环境断言标签 DOM、类名与文案
> 2. **人工目视验收**（T-E1 / T4.3）—— 由用户在真实面板逐条核对清单
>
> **已知代价**：`leanspec-apply` 可能因缺少 `e2e/*.spec.ts` 任务而拒绝开工；如遇拒绝，出示本节作为豁免依据。
>
> **开工预检记录（2026-10-08）**：
> 1. **一处假绿**：`grep -c "e2e/.*\.spec\.ts" tasks.md` 返回 **2**，但逐行匹配 `^- \[ \] .*e2e/` 返回 **0** —— 那 2 处命中全部来自本节自身的说明文字。任何"用 grep 数 E2E 任务"的自动化预检都会误判为"仍有 E2E 任务未完成"。据实记录，**不利用该假绿绕过门禁**。
> 2. 仓库既有故障（与本 Spec 无关）：`node_modules/react`、`node_modules/marked` 是**空目录**，`npm test` 基线实为 39 项 / 2 个文件失败。执行 `npm install` 后恢复为 **45 项全绿**。
> 3. 仓库既有故障：`tsconfig.json` 缺 `allowImportingTsExtensions`，`npm run typecheck` 基线 **21 个 TS5097 错误**。经用户确认补上该行后降为 **0 错误**。

---

## Phase 1：解析层（纯函数，可独立测试）

- [x] T1.1 实现状态解析器
  - 引用: REQ-2, REQ-3
  - 变更文件: `src/spec-status.ts`（新增）
  - 变更内容: 导出 `SPEC_STATUSES` 枚举常量、`normalizeStatus(raw)`、`parseSpecStatus(markdown): SpecStatus | undefined`
    - frontmatter `status:` 优先
    - 正文 `**状态**[:：]` 兜底（全角/半角冒号）
    - 去引号、trim、小写、空白折叠为 `-`
    - 别名表 `wip→in-progress`、`done→complete`、`arch/archive→archived`
    - 非枚举值返回 `undefined`
  - 验证: `node --test test/spec-status.test.ts` 全绿
  - 实测: 15 用例全通过。实现说明：frontmatter 值非法时**继续**回落到正文行（而非直接判为无状态），已补对应用例
  - 实现附加: 未用 TS `enum`（Node `--experimental-strip-types` 不支持 enum），改用 `as const` + 联合类型

- [x] T1.2 补齐解析器边界用例
  - 引用: REQ-2, REQ-3
  - 变更文件: `test/spec-status.test.ts`（新增）
  - 覆盖: 仅 frontmatter / 仅正文 / 两者并存（frontmatter 赢）/ 全角冒号 / CRLF / UTF-8 BOM / 值带引号 / 值前后空格 / 别名四种 / 非法值 / 空文件 / 超长英文正文
  - 验证: 用例数 ≥12 且 `npm test` 全绿
  - 实测: **15 用例**（要求 ≥12），全通过

---

## Phase 2：服务端

- [x] T2.1 `/tree` 返回 `statusByDir`
  - 引用: REQ-1, REQ-3
  - 变更文件: `src/leanspec-fs.ts`、`src/http.ts`
  - 变更内容:
    - `listSpecs()` 增加对每个 spec 的 `README.md` **头部 ~2KB** 读取（`fs.openSync` + `readSync` + `closeSync`）
    - 用 `parseSpecStatus` 解析；失败/缺失/非法一律跳过，不抛错
    - 返回体追加 `statusByDir`（`present: false` 时为 `{}`）
  - 验证: `node --test test/leanspec-fs.test.ts test/http.test.ts` 全绿
  - 实测: 32 项全通过；对真实 `specs/` 冒烟：`001-markdown-table-rendering-fix → complete`（正文兜底）、`002-spec-status-badges → draft`（frontmatter 优先）

- [x] T2.2 服务端测试扩展
  - 引用: REQ-3
  - 变更文件: `test/leanspec-fs.test.ts`、`test/http.test.ts`
  - 覆盖: 有状态 → 出现在 map；无状态 → 不出现 key；README 缺失 → 不出现 key 且响应仍 200；`present:false` → `{}`；大文件只读头部仍能命中 frontmatter
  - 验证: `npm test` 全绿
  - 实测: 新增 8 项（6 + 2）全通过。**兼容性说明**：`statusByDir` 是 `/tree` 响应体的**新增字段**，既有 3 处 `deepEqual` 断言（`leanspec-fs.test.ts` 2 处 + `http.test.ts` 2 处）已同步更新

---

## Phase 3：前端渲染

- [x] T3.1 状态标签渲染
  - 引用: REQ-1, REQ-3, REQ-4
  - 变更文件: `src/client/viewer-state.ts`、`src/client/LeanspecViewer.ts`、`src/client/spec-badge.ts`（新增）
  - 变更内容:
    - state 增加 `statusByDir: Record<string, SpecStatus>`，`load-success` 时写入（缺失兜底 `{}`）
    - `TreeNodes` 的 dir 分支：识别 spec 根目录（顶层且 `^\d{3,}-`）且有状态时，在 chevron 后插入 `<span class="dsh-leanspec-spec-status dsh-leanspec-spec-status-<status>">{label}</span>`
    - 标签文案映射：`in-progress→WIP`、`complete→done`、`archived→arch.`，其余同值
  - 验证: `node --test test/viewer-state.test.ts` 全绿 + T3.3 渲染断言通过
  - 实现说明: 类名按用户 2026-10-08 决定改为 `dsh-leanspec-spec-status`（避免与既有 `.dsh-leanspec-status-ok/-err` 混淆）；`spec-badge.ts` 为**无 React 依赖**的纯描述符模块，使渲染规则可在无 DOM 环境下单测；`TreeNodes` 为测试而导出（无 hook 的纯函数组件）

- [x] T3.2 标签样式
  - 引用: REQ-4, REQ-5
  - 变更文件: `src/client/styles.ts`
  - 变更内容: 新增 `.dsh-leanspec-spec-status` 基础样式（`flex:0 0 auto`、圆角、11px、不撑高）与 5 个状态类，色源严格按 design.md §5.1；文字色 `var(--dsw-static-neutral-bluish-1000)`
  - 验证: T4.1 零 hex 与灰度间距断言通过 + T-E1 目视确认 draft 呈水青色
  - 实测: 7 个 `--dsw-static-*` token 已逐个确认真实存在于宿主；`color-mix` 已确认进入构建产物

- [x] T3.3 渲染断言测试（替代自动化 E2E 的第一道）
  - 引用: REQ-1, REQ-4, REQ-5
  - 变更文件: `test/viewer-render.test.ts`（新增，夹具内联，无需 harness）
  - 覆盖: 五种状态各渲染对应类名与文案；非 spec 目录无标签；无状态 spec 渲染 `-` 占位（类名 `-none`）；越界值与原型键一律落到占位符；标签为 `span` 且不产生嵌套 button
  - 验证: `npm test` 全绿
  - 实测: 9 项全通过（后随 `-` 占位变更增至 10 项）。实现方式：`TreeNodes` 无 hook，直接调用后遍历 React 元素树断言 `type`/`className`/文案 —— 因此**不需要 react-dom、不需要浏览器、不新增任何依赖**

- [x] T3.4 状态保存后同步
  - 引用: REQ-6
  - 变更文件: `src/client/viewer-state.ts`、`src/client/LeanspecViewer.ts`
  - 变更内容: `save-success` 后基于最新内容重算该 spec 的状态并更新 `statusByDir`（复用 Phase 1 的纯函数，避免二次请求）
  - 验证: `node --test test/viewer-state.test.ts` 含"保存后标签更新"用例并通过
  - 实测: 新增 6 项全通过，含"存掉状态行则回落到 `-` 占位""保存 `design.md` 不动标签""旧 state 不被就地修改"

- [ ] T-E1 [REQ-1] 端到端验收（人工目视，替代自动化 E2E 的第二道）
  - 执行人: **用户本人**（依据 Phase 0 裁定）
  - 验证方法: 按 T4.3 的目视清单在 DSH GUI 的 LeanSpec 面板中逐条核对，确认无一项失败
  - 覆盖: 五色可见且文案正确 / 颜色可区分 / `docs/` 行无标签 / 无状态 spec 行显示**无底色**的淡灰 `-` / 220px 窄面板不截断标签
  - 状态: ⏳ **待用户执行**（AI 无法代做：直连 GUI 返回 403，且本模型不支持图像输入）

---

## Phase 4：验证与文档

- [x] T4.1 样式与配色回归断言
  - 引用: REQ-5
  - 变更文件: `test/styles.test.ts`
  - 覆盖: 零 hex 断言保持；5 个状态类存在；断言五色灰度两两间距 ≥15（内联灰度计算函数）；断言标签文字色为固定深色 token
  - 验证: `npm test` 全绿
  - 实测: 新增 4 项全通过。**该断言当场抓出真实缺陷**：初稿 planned（`blue-500`）与 complete 的灰度间距仅 **14.53**，低于 15 阈值（design.md §5.1 的勘误即为此）。另加断言：五色深字对比度全部 ≥4.5:1（最低 4.73:1）

- [x] T4.2 全量回归与类型检查
  - 引用: 全部
  - 验证: `npm test` 全绿（原 45 项 + 新增）；`npm run typecheck` 无新增错误；`npm run build` 成功
  - 实测: `npm test` **85 项全通过**（45 基线 + 40 新增）；`npm run typecheck` **0 错误**（基线 21 → 0，见 Phase 0 预检记录第 3 条）；`npm run build` 成功，`lib/client.js` **85.0 KB**，并已确认产物含 `window.__ModuleLoader__.load({ id: "dsh-leanspec" })`、新类名与 `color-mix`

- [ ] T4.3 真实面板人工目视验收（**本 Spec 的核心验证手段**）
  - 引用: REQ-1, REQ-4, REQ-5, REQ-6
  - 执行人: 用户本人
  - 前置: 已 `npm run build`，并按仓库说明重载 web profile
  - 目视清单（逐条打勾）:
    1. 树中 5 个 spec 行的标签文案分别为 `draft` / `plan.` / `WIP` / `done` / `arch.`
    2. 五色肉眼可区分；**draft 呈水青色**（证明 `color-mix()` 生效，而非回退成无色/黑色）
    3. 切换暗色主题后标签文字仍为深色且可读
    4. 面板拖到最窄（约 220px）时五个标签文字均完整显示，超长由名称 ellipsis 承担
    5. `docs/` 等子目录行**无**标签
    6. 无状态字段的 spec 行显示淡灰 `-` 占位标签（**无底色 + 同色描边**），描边让形状可辨，且行高与其他行一致
    7. 点击标签的效果与点击整行一致（展开/折叠），无额外副作用
    8. 修改某个 README 的状态并保存后，标签**无需刷新**即更新
    9. 六个标签（含 `-`）**等宽 42px**，各 spec 名称在竖向上对齐
  - 验证: 以上 9 项全部通过；任一项失败则回填为新任务再修
  - 状态: ⏳ **待用户执行**。`npm run build` 已完成，下一步是重载 web profile 后打开面板
  - 提示: 本仓库原有 2 个 spec（`001` = complete、`002` = draft），只看得到 2 色。已按用户指示新建 **4 个临时夹具**凑齐 5 色，并各自覆盖一条不同解析路径：
    | 夹具目录 | 状态来源 | 预期标签 | 顺带验的判据 |
    |----------|----------|----------|--------------|
    | `003-status-demo-planned` | 仅 frontmatter `planned` | 蓝 `plan.` | REQ-2 单一来源 |
    | `004-status-demo-wip` | frontmatter `in-progress` + 正文 `draft`（**故意矛盾**） | 琥珀 `WIP` | **A2：frontmatter 优先** |
    | `005-status-demo-archived` | frontmatter `archived` | 灰 `arch.` | REQ-4 缩写文案 |
    | `006-status-demo-none` | **无任何状态** | 淡灰 `-`（无底色 + 同色描边，等宽 42px） | **A3：占位符 + 行高一致** |
  - **需求变更留痕（2026-10-08，用户目视后）**: REQ-3 / A3 / A4 原为「无状态则不显示标签」，用户改为「显示 `-`」。查证：第六种实心灰必与五色撞车（`-400`≈178 撞 WIP 181、`-500`≈156 撞 draft 158、`-600`≈133 撞 done 137），故 `-` 定为**无底色 + 主题感知文字 + 1px 同色描边**（亮 3.71:1 / 暗 8.54:1；描边靠 `padding: 0 5px` 补偿 1px 内缩以保行高）；用户随后追加「同色描边看得清形状」与「六标签等宽」。等宽取 **42px**：Playwright 实测宿主字体下最宽文案是 `done` = 25.47px（Verdana 27.05px），内容区留 30px；`box-sizing: border-box` 必须显式声明，否则宿主的全局 border-box 会让内容区只剩 18px 而把 `done` 撑宽。实现见 design.md §5.5 / §6.2
  - **验收后清理**（用户执行）: `Remove-Item -Recurse -Force specs\003-status-demo-planned, specs\004-status-demo-wip, specs\005-status-demo-archived, specs\006-status-demo-none`
  - 备注: `006` 缺 `status` 字段，按 LeanSpec schema 属**故意不合规**的夹具（`leanspec validate` 会报它；该命令本就因 `specs/001` 缺 frontmatter 而整体报错）。作为临时文件可接受，清理后不影响仓库
  - 已验证（实现阶段实测）: 对真实 `specs/` 跑 `listSpecs` → `buildFileTree` → `TreeNodes`，6 行渲染结果与上表预期**逐行一致**

- [x] T4.4 更新用户可见文档
  - 引用: REQ-1, REQ-2
  - 变更文件: `README.md`（仓库根）
  - 变更内容: 说明状态标签的颜色约定、状态取源规则（frontmatter 优先 / 正文兜底）、不支持点击切换
  - 验证: 文档描述与实际行为逐条对照一致
  - 实测: 已新增「🏷️ Spec 状态标签」小节，逐条对照实现与断言写入

---

## 完成定义（DoD）

1. Phase 1–3 全部任务勾选，`npm test` / `npm run typecheck` / `npm run build` 三项全绿
2. **T-E1 人工目视清单逐条通过**（替代自动化 E2E，依据见 Phase 0 裁定）
3. A1–A11 验收标准逐条可判定为通过
4. T4.3 目视验收完成（含暗色主题 + 窄面板两种场景）

---

## 数据迁移

**无。** 本 Spec 不改动任何持久化结构；`specs/` 下的 Markdown 为唯一数据源，且为只读解析。

---

## 遗留的可选增强（不在本 Spec 范围）

| 项 | 说明 |
|----|------|
| 自动化 E2E | 若日后需要，按「静态挂载页 + 桩 fetch + Playwright」方案补建，避免依赖 403 的 DSH GUI |
| 点击标签切换状态 | 需写回 frontmatter 并保留原文格式，另开 Spec |
