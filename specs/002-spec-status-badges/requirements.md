# 需求：Spec 列表状态标签

> 类型：设计驱动（design-first）。本文件的需求由 [design.md](./design.md) 反推而得。

---

## 0. 项目文档摘要

**`docs/` 全量扫描结果：（空）** —— 本仓库不存在 `docs/` 目录，无产品文档、无接口文档、无数据库文档可提炼。

本 Spec 的输入来源为：

| 来源 | 内容 |
|------|------|
| 用户需求描述 | "在 spec 预览列表里用简短 tag 标记状态，把分类序号前的点改成小标签，用 draft/planned/WIP/done/arch. 加色彩区分" |
| 代码库探索 | `src/http.ts`、`src/leanspec-fs.ts`、`src/client/file-tree.ts`、`src/client/LeanspecViewer.ts`、`src/client/styles.ts`、`test/*.test.ts` |
| 宿主设计系统勘察 | DSH app 资源中共 300 个 `--dsw-*` token 的枚举与色值提取 |
| 配色过程稿 | [assets/design-references/](./assets/design-references/) |

---

## 1. 功能需求

### REQ-1 列表显示状态标签（UI）

**用户故事**：作为 spec 作者，我希望在文件树里直接看到每个 spec 的状态，这样不必逐个点开 README 就能判断该关注哪个。

- GIVEN 面板已加载且某个 spec 目录有可解析的状态
- WHEN 该 spec 目录行被渲染
- THEN SHALL 在折叠箭头之后渲染一个 `dsh-leanspec-spec-status` 标签，文案为 `draft` / `plan.` / `WIP` / `done` / `arch.` 之一
- GIVEN 某个顶级 spec 目录**没有**可解析的状态（字段缺失 / 值为空 / 值不在词表内）
- WHEN 该 spec 目录行被渲染
- THEN SHALL 渲染 `-` 占位标签（类名后缀 `-none`），带 **1px 与文字同色的描边**以使形状可辨，且 SHALL NOT 渲染原始状态文本
- WHEN 该节点是 `docs/` 等非 spec 子目录或普通文件
- THEN SHALL NOT 渲染任何状态标签
- WHEN 渲染任意一个状态标签（含 `-` 占位）
- THEN SHALL 六个标签的**总宽完全相等（42px）**，使 spec 名称在竖向上对齐

> **需求变更（2026-10-08，用户目视验收后）**：本条第 4 项原为「无状态则不渲染标签」，用户要求改为渲染 `-` 占位符，以免该行看起来缺一块；随后追加「同色描边」（看出标签形状）与「六个标签等宽」。变更同时影响 REQ-3 / A3 / A4。

### REQ-2 状态取源与解析优先级

**用户故事**：作为 spec 作者，我希望 frontmatter 是权威来源，同时老的正文写法仍能被识别。

- WHEN 文件同时存在 frontmatter `status: X` 与正文 `**状态**: Y`
- THEN SHALL 以 frontmatter 的 `X` 为准
- WHEN 文件无 frontmatter 但正文含 `**状态**: complete`
- THEN SHALL 识别为 `complete`
- WHEN 正文使用全角冒号 `**状态**：complete`
- THEN SHALL 同样识别
- WHEN 值为 `wip` / `done` / `arch` / `archive`（大小写任意）
- THEN SHALL 分别归一化为 `in-progress` / `complete` / `archived` / `archived`

### REQ-3 无状态与非法状态的降级

**用户故事**：作为使用者，我不希望缺字段的 spec 破坏整个列表。

- WHEN spec 无 frontmatter 状态且正文无状态行
- THEN SHALL 渲染 `-` 占位标签，且该行高度与其他行**完全一致**
- WHEN 状态值归一化后不在枚举内（如 `foo`）
- THEN SHALL 渲染 `-` 占位标签，且 **SHALL NOT** 把原始文本渲染到界面上
- WHEN README.md 缺失或读取失败
- THEN SHALL 静默跳过该 spec，`/tree` 仍正常返回 200

### REQ-4 标签不破坏树交互（UI）

- WHEN 标签渲染后
- THEN SHALL 标签为 `<span>`（不产生嵌套 button）
- WHEN 用户点击标签
- THEN SHALL 行为与点击该行一致（展开/折叠），且不产生任何额外副作用
- WHEN 面板宽度收窄至最小 220px
- THEN SHALL 标签文字完整显示不被截断，超长由 spec 名称承担 ellipsis

### REQ-5 配色与主题一致性（UI）

- WHEN 五个标签被渲染
- THEN SHALL 背景色分别取自 design.md §5.1 的色源（零硬编码 hex）
- THEN SHALL 标签文字对比度 ≥4.5:1（WCAG AA）
- THEN SHALL 五色灰度值两两间距 ≥15 级
- WHEN 在暗色主题下渲染
- THEN SHALL 沿用同一组色值且文字仍为深色（不使用会随主题变白的 `label-primary`）

### REQ-6 状态变更后同步（UI）

- WHEN 用户在预览/编辑面板中修改 README 的状态并保存成功
- THEN SHALL 该 spec 在列表中的标签在**无需刷新页面**的情况下更新为最新状态

---

## 2. 交互控件清单

| 控件 | 元素 | 行为 | 无障碍要点 |
|------|------|------|-----------|
| 折叠箭头 | `<span class="dsh-leanspec-chevron">` | 只作指示，不可单独点击 | 展开态由字形 `▸/▾` 表达 |
| 状态标签 | `<span class="dsh-leanspec-spec-status ...">` | 不可独立交互，点击冒泡到行 button | 文案本身可读（色彩失效时的兜底线索）；实心同形，不依赖形状区分 |
| spec 目录行 | `<button class="dsh-leanspec-dir">` | 点击展开/折叠 | 现有行为不变 |

---

## 3. 非功能需求

| 类别 | 要求 |
|------|------|
| 性能 | `/tree` 新增开销随 spec 数量线性；50 个 spec 量级下增加 < 20ms；单文件只读头部 ~2KB |
| 兼容 | `/tree` 只追加字段，不修改/删除既有字段；前端在字段缺失时每行显示 `-` 占位符（即"全部无状态"），而非空白 |
| 安全 | 不新增写操作；状态值经白名单校验后才渲染；不引入 YAML 解析依赖 |
| 可测试 | 解析器为纯函数；渲染断言可在 Node 环境完成，不强制依赖真实浏览器 |
| 依赖 | 零新增运行时依赖 |
| 主题 | 全部色值来自 `--dsw-*` 或由 `color-mix()` 从 token 派生；`styles.test.ts` 零 hex 断言保持通过 |

---

## 4. 约束与不做的事

**约束**

- 必须保持 `test/styles.test.ts` 的「零 hex」断言通过
- 必须保持现有测试全绿（当前 45 项）
- 不得改变树的排序、结构、默认折叠行为

**明确不做**

- ❌ 点击标签切换状态（需写回 frontmatter，另开 Spec）
- ❌ 按状态排序 / 分组 / 筛选
- ❌ 给 `docs/` 等子目录加标签
- ❌ 修复 `specs/001` 缺 frontmatter 的问题（另行确认后单独处理）
- ❌ 修改 `README.md` 正文状态行的写法约定（保留兜底能力即可）

---

## 5. 验收标准汇总（二值可判定）

| # | 判据 | 关联 |
|---|------|------|
| A1 | 仅有正文 `**状态**: complete` 的 spec 显示绿色 `done` | REQ-1, REQ-2 |
| A2 | frontmatter `status: in-progress` + 正文 `**状态**: draft` → 显示琥珀 `WIP` | REQ-2 |
| A3 | 无状态字段的 spec 显示 `-` 占位标签（**无底色 + 同色描边**），且行高与其他行一致 | REQ-3 |
| A3b | 六个标签总宽均为 **42px**，spec 名称左边界对齐 | REQ-1 |
| A4 | 状态值非法（如 `foo`）时显示 `-` 占位标签，且界面不出现 `foo` 文本 | REQ-3 |
| A5 | 面板 220px 宽时五个标签文案均完整可见 | REQ-4 |
| A6 | 标签元素为 `span`，行 button 内无嵌套 button | REQ-4 |
| A7 | `npm test` 全绿，其中「零 hex」断言通过 | REQ-5 |
| A8 | 五色灰度两两间距 ≥15（脚本断言） | REQ-5 |
| A9 | 五个标签文字与底色对比度均 ≥4.5:1 | REQ-5 |
| A10 | 保存状态改动后，列表标签无需刷新即更新 | REQ-6 |
| A11 | `/tree` 在无任何状态字段的仓库中仍返回 200 且 `statusByDir` 为空对象 | REQ-3 |

---

## 6. 验收证据（实现阶段实测，2026-10-08）

> 判定口径：**自动化**= 由 `npm test` 中的具名用例断言；**实测**= 对真实 `specs/` 目录跑出的结果；**待目视**= 只有人眼能判定，归 T-E1 / T4.3。

| # | 结论 | 证据 |
|---|------|------|
| A1 | ✅ 实测 | 真实仓库冒烟：`specs/001-markdown-table-rendering-fix`（无 frontmatter，仅正文 `**状态**: complete`）解析为 `complete`；用例 `the repository spec 001 style README parses through the body fallback`、`falls back to the body 状态 line for legacy specs`；绿色为 styles 断言的 `green-500` |
| A2 | ✅ 自动化 | 用例 `frontmatter wins over the body line`（frontmatter `in-progress` + 正文 `draft` → `in-progress`）；渲染用例断言文案 `WIP`，styles 断言其色源为 `amber-400` |
| A3 | ✅ 自动化（行高部分待目视） | 用例 `a spec without a status renders the bare dash placeholder`、`omits specs whose README has no usable status`；「行高一致」与「无底色」归 T4.3 第 6 项目视 |
| A3b | ✅ 自动化 + 实测（浏览器） | 用例 `all six badges share one pinned width and centre their label` 锁定 `box-sizing` / `min-width: 42px` / `text-align`；Playwright 以宿主字体栈实测六支均 **42 × 18px**、名称左边界一致（64px），跨字体最坏 Verdana 27.05px 仍容于 30px 内容区。宽度换算与版本订正见 design.md §6.2 |
| A4 | ✅ 自动化 | 用例 `unknown values never leak through`（含 `<script>` 注入值）、`a status outside the vocabulary becomes the placeholder, never raw text`、`a prototype key can never masquerade as a status`（`constructor` / `__proto__` / `toString`） |
| A5 | ⏳ 待目视 | 无法自动化（无浏览器）；断言层面已保证标签 `flex: 0 0 auto` 不可压缩，归 T4.3 第 4 项 |
| A6 | ✅ 自动化 | 用例 `a spec row with a status renders a span badge carrying the short label`、`the row button never gains a nested button` |
| A7 | ✅ 自动化 | `npm test` **93 项全通过**；`viewer styles use Harness theme aliases instead of hardcoded palette` 中的零 hex 断言通过，且全仓库 `src/**.ts` 扫描无 hex |
| A8 | ✅ 自动化 | 用例 `the five status fills stay at least 15 grey steps apart` → 实测最小间距 **18.58**（planned↔complete）。**该断言在实现阶段抓出了初稿 14.53 的缺陷**，见 design.md §5.1 勘误 |
| A9 | ✅ 自动化 | 用例 `badge text keeps at least 4.5:1 against every fill` → 最低 **4.73:1**（planned） |
| A10 | ✅ 自动化（端到端待目视） | 用例 `saving a spec README updates its badge without a reload`；「真实点击保存」归 T4.3 第 8 项 |
| A11 | ✅ 自动化 | 用例 `GET /tree returns an empty statusByDir when nothing parses`、`GET /tree returns present=false ... statusByDir: {}`、`omits a spec without README.md instead of failing the listing` |

**结论**：A1–A4、A3b、A6–A9、A11 已由自动化与实测判定为**通过**；A5、A10 与 A3 的行高部分只能由人眼判定，归入 T-E1 / T4.3（见 tasks.md）。

**验证缺口（据实记录）**：AI 无法自行完成 T-E1 / T4.3 —— 直连运行中的 GUI（`http://127.0.0.1:43120`）返回 **403**（需会话 token），且本模型不接受图像输入，无法判读自己生成的截图。因此色彩观感、窄面板布局、暗色主题三项**只有用户能验收**。
