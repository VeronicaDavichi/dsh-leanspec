# 技术设计：Spec 列表状态标签

> 类型：设计驱动（design-first）。本文档先于 requirements.md 产出，需求由本设计反推。

---

## 1. 技术愿景

在不引入任何新依赖、不破坏现有测试约束的前提下，把 spec 状态从「藏在 README 正文里」变成「列表里一眼可见」：

- **零新增依赖**：复用 `node:fs` + 现有 React `createElement` 渲染方式
- **零硬编码颜色**：全部走宿主 `--dsw-*` 设计 token，必要时用 `color-mix()` 派生
- **零破坏性变更**：`/tree` 响应只做**追加字段**，旧调用方（若有）不受影响
- **可测试**：解析器是纯函数；渲染断言不依赖真实浏览器

---

## 2. 架构：现状 vs 目标

### 2.1 现状数据流（状态信息在此断链）

```
specs/001-x/README.md ──(GET /file)──▶ 预览区          ✅ 状态在文本里，但从未被解析成字段
specs/ ──(readdir)──▶ ["001-x"] ──(GET /tree)──▶ 文件树  ❌ 只有路径字符串，没有状态
```

关键事实（探索阶段实测）：

| 事实 | 位置 |
|------|------|
| 树仅由 `files` + `dirs` 两个字符串数组构建 | `src/client/file-tree.ts` |
| `/tree` 只返回 `specs / files / dirs` | `src/http.ts` L70-76 |
| `specs` 被抓取并存进 state，但**从未渲染** | `src/client/viewer-state.ts` L9 vs `src/client/LeanspecViewer.ts` L98 |
| spec 目录与普通子目录共用 `dsh-leanspec-dir` 渲染分支 | `src/client/LeanspecViewer.ts` L51-76 |
| 样式测试禁止 hex：`assert.doesNotMatch(STYLES, /#[0-9a-fA-F]{3,8}/)` | `test/styles.test.ts` L18 |

### 2.2 目标数据流

```
specs/NNN-x/README.md
   ├─ frontmatter  status: complete     ← 优先
   └─ 正文         **状态**: complete    ← 兜底
          │
          ▼ 新增：服务端解析（只读文件头部 ~2KB）
   GET /tree → { present, specs, files, dirs,
                 statusByDir: { "001-x": "complete" } }   ← 新增字段
          │
          ▼ 前端：按 spec 根目录（顶层 + ^\d{3,}-）取状态
   ▸ [ done ] 001-markdown-table-rendering-fix
```

---

## 3. 数据模型

### 3.1 状态枚举（与 LeanSpec markdown adapter 对齐）

| 值 | 含义 |
|----|------|
| `draft` | 正在编写 |
| `planned` | 已批准未开工 |
| `in-progress` | 正在开发 |
| `complete` | 完成并验证 |
| `archived` | 不再活跃 |

### 3.2 `/tree` 响应契约（向后兼容的追加）

```jsonc
{
  "present": true,
  "specs": ["001-markdown-table-rendering-fix"],
  "files": ["001-.../README.md"],
  "dirs": [],
  "statusByDir": { "001-markdown-table-rendering-fix": "complete" }
}
```

- `statusByDir` 为**可选追加字段**；解析不出状态的 spec **不出现在该 map 中**（而非填 `null`）
- `present: false` 时该字段为 `{}`
- key 一律为 spec 目录名（`NNN-name`），与 `specs[]` 元素同源

### 3.3 解析规则（纯函数 `parseSpecStatus(markdown): string | undefined`）

1. **frontmatter 优先**：匹配文件开头 `^---\r?\n([\s\S]*?)\r?\n---`，在其中取 `^\s*status\s*:\s*(.+)$`
2. **正文兜底**：匹配 `\*\*状态\*\*\s*[:：]\s*(\S+)`（**半角与全角冒号都要认**）
3. **归一化**：`trim()` → 去首尾引号 → 转小写 → 空白折叠为 `-`
4. **别名表**：`wip→in-progress`、`done→complete`、`arch→archived`、`archive→archived`、`in progress→in-progress`
5. **白名单校验**：归一化后仍不在 §3.1 枚举内 → 返回 `undefined`（即"无状态"；界面据此渲染 `-` 占位，见 §5.5）

容忍项（必须有单测覆盖）：CRLF、UTF-8 BOM、frontmatter 内 `status` 前后多余空格、值带引号、正文行结尾多余空格。

---

## 4. 服务端设计

### 4.1 实现要点

- 在 `listSpecs()` 的 spec 目录遍历中，对每个 spec 尝试读取 `README.md` 的**头部片段**（`fs.openSync` + 读前 2048 字节后关闭），避免整文件读入
- README 不存在 / 读取失败 / 无状态 → **静默跳过**（不抛错，不影响 `/tree` 主流程）
- 解析结果聚合为 `statusByDir` 一并返回
- 复用现有 `LeanspecError` 错误语义，**不新增错误码**

### 4.2 性能

- 复杂度 O(N) 次小读，N = spec 数量；50 个 spec 量级为毫秒级
- 状态字段位于文件头部，2KB 足够覆盖 frontmatter 与常见的正文状态行位置
- 不引入缓存（树加载本身已是"打开面板"的低频操作，缓存会带来失效复杂度）

### 4.3 安全

- 无新增写操作；读路径仍受 `resolveSpecsDir` + `isInside` 约束（`src/leanspec-fs.ts`）
- 只做**文本匹配**，不执行、不 eval、不解析 YAML 结构，避免引入 YAML 解析面
- 读到的状态值最终用于渲染文本，且白名单校验后才展示，防止任意内容注入

---

## 5. 配色系统

### 5.1 最终色板

| 状态 | 标签文案 | CSS 色源 | 近似色值 | 灰度 | 深字对比度 |
|------|----------|----------|----------|------|-----------|
| draft | `draft` | `color-mix(in srgb, var(--dsw-static-blue-400) 44%, var(--dsw-static-green-400) 56%)` | `#56beb5` | 157.9 | 8.48 |
| planned | `plan.` | `color-mix(in srgb, var(--dsw-static-deepseek-500) 60%, var(--dsw-static-blue-500) 40%)` | `#3f7bec` | 117.9 | 4.73 |
| in-progress | `WIP` | `var(--dsw-static-amber-400)` | `#f7ad31` | 181.0 | 9.88 |
| complete | `done` | `var(--dsw-static-green-500)` | `#22c55e` | 136.5 | 8.29 |
| archived | `arch.` | `var(--dsw-static-neutral-bluish-300)` | `#cfd3d6` | 210.1 | 12.55 |

- 标签文字色统一 `var(--dsw-static-neutral-bluish-1000)`（`#0f1115`）
- 灰度升序 `planned 117.9 → complete 136.5 → draft 157.9 → WIP 181.0 → arch. 210.1`，相邻间距 `18.58 / 21.36 / 23.11 / 29.16`，**最小 18.58 级**
- 对比度全部 ≥4.5:1（WCAG AA），最低 4.73:1

> **勘误（实现阶段实测）**：本表初稿把 planned 定为 `blue-500`（灰度 122），使 planned↔complete 间距仅 **14.53**，并且初稿把该值四舍五入写成「15」而误判达标。T4.1 的灰度断言在实现阶段实测出该缺陷后，planned 改为 `deepseek-500 × blue-500` 的 60/40 混色：间距升到 18.58，同时避开 `deepseek-500` 单独使用时的 4.46:1（低于 AA）。draft 的水青色与其余三色分毫未变。

### 5.2 为什么不用 hex（关键约束）

仓库测试 `test/styles.test.ts` 明令 `LEANSPEC_STYLES` 不得出现 hex。探索阶段验证过：宿主 300 个 token 中没有 teal/cyan 族，而用户期望的水青色 `#3fefff` / `#3DCCEF` / `#5bb9b2` **在 sRGB 线性插值下均不可达**（低红 + 高绿 + 高蓝的源色不存在）。

最终选择 `blue-400 × green-400` 的 44/56 混色，得到 `#56beb5`，与目标 `#5bb9b2` 的 ΔRGB 仅 **7.7/255**（肉眼不可辨），从而做到**零 hex 破例**。

### 5.3 为什么用 static 层而非 alias 层

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| `--dsw-alias-state-*` | 语义层，随主题明暗自适应 | `business-primary` 在浅/深主题分别是 `deepseek-400`(灰 165) / `deepseek-500`，**灰 165 会与 WIP 的 167 撞车**，且灰 165 对应哪个主题未能锚定 | ❌ 弃用 |
| `--dsw-static-*`（采用） | 色值与灰度完全确定，可写回归断言 | 不随主题变亮（但标签是实心底 + 深色字，两种主题下都成立） | ✅ 采用 |

> `deepseek-500` 单独使用时灰度 115 更优，但其配深色文字的对比度仅 **4.46**，卡在 AA 线下；`blue-500` 单独使用虽满足 AA（5.14）却与 complete 只差 14.53 级。最终取 `deepseek-500 60% + blue-500 40%`：灰度 117.9、对比度 4.73，两个约束同时成立。

### 5.4 为什么保留折叠箭头

`▸/▾` 是树里**唯一**的展开态信号；用户希望的"标签取代箭头"会让展开/折叠状态不可见。现状箭头仅 10px 且为 `label-caption` 最弱色，视觉重量已接近一个点，因此"箭头保留 + 标签紧随"能在满足视觉意图的同时零语义损失。

### 5.5 无状态行的 `-` 占位（2026-10-08 用户变更）

用户目视验收后要求：读不出状态的行不要空着，显示一个 `-`。此变更改写了 REQ-3 / A3 / A4 原本的"不显示标签"。

| 决策 | 结论 | 理由 |
|------|------|------|
| `-` 要不要底色 | ❌ 不要 | 五色已按灰度等距铺满 117.9–210.1，**任何第六种实心灰都会撞车**：`bluish-400`≈178 撞 WIP 181、`-500`≈156 撞 draft 158、`-600`≈133 撞 done 137 |
| 文字用什么色 | `--dsw-alias-label-tertiary` | 没有底色 ⇒ 文字直接压在面板表面（`bg-base` = `bluish-00` / `bluish-950`），**必须**用随主题翻转的 alias token；若沿用五色那套固定深色 `bluish-1000`，暗色主题下会直接消失 |
| 对比度 | 亮 **3.71:1** / 暗 **8.54:1** | 亮色低于 AA 是**刻意**的：一条短横表示"此处没有状态"，本就该退到背景里；但**描边**属 UI 边界，WCAG 1.4.11 只要求 3:1，3.71 达标 —— 形状因此可辨 |
| 形状怎么看出来 | **1px 同色描边**（`border: 1px solid currentColor`） | 没有底色就看不出标签的形状，只剩一根孤零零的短横；用户 2026-10-08 追加要求"字符同色的描边"。用 `currentColor` 而非重写 token：文字色一变描边跟着变 |
| 描边不能撑高行 | `padding: 0 5px` + 1px 边框 | 边框会让盒子长高 2px，故内边距各减 1px：`0+1 = 1`、`5+1 = 6`，与五色标签的 `padding: 1px 6px` **内缩完全相等**，行高不变。styles.test.ts 有断言锁住这份补偿 |
| 类名 | `.dsh-leanspec-spec-status-none` | `none` 不属于状态枚举，避免与五个状态类混淆；渲染测试断言该 class 不与任何状态类重复 |

`--dsw-alias-label-tertiary` 的取值已从宿主 theme 包（`@deepseek-ai/dsh-client-ui-theme`）核实：亮色 `bluish-600`（`#81858c`）/ 暗色 `bluish-400`（`#adb2b8`）；`--dsw-alias-label-primary` 会翻成亮色，因此**绝不可**用于有底色的五个标签（既有断言已禁止）。

> 描边与文字同色，所以 `-` 是唯一"带边框"的标签类 —— 它属于**形状**层面的区分，而不是偷偷加了第六种颜色；色板仍是五色。

---

## 6. 前端渲染设计

### 6.1 DOM 结构（改动点在 `TreeNodes` 的 dir 分支）

```
<button class="dsh-leanspec-dir">          ← 保持 button（整行可点、可展开）
  <span class="dsh-leanspec-chevron">▸</span>
  <span class="dsh-leanspec-spec-status dsh-leanspec-spec-status-complete">done</span>   ← 新增
  <span class="dsh-leanspec-file-name">001-markdown-table-rendering-fix</span>
</button>
```

- 标签必须是 `<span>`：**button 内嵌套 button 是非法 HTML**
- 仅当节点是"spec 根目录"（顶层且匹配 `^\d{3,}-`）时渲染标签：`statusByDir` 里有值就用该状态，没有就用 `-` 占位
- `docs/` 等子目录、普通文件不渲染标签（由 `isSpecRootDir` 在调用点提前拦掉）

### 6.2 样式要点

- 标签：`flex: 0 0 auto`（**不可被压缩**）、`border-radius` 小圆角、`padding: 1px 6px`、`font-size: 11px`、`line-height` 保证不撑高行、`min-width: 42px + text-align: center` 保证六标签等宽
- 名称仍是唯一的可收缩元素（`.dsh-leanspec-file-name` 已具备 `text-overflow: ellipsis`）
- 宽度预算：面板最窄 220px，行内 padding 8px×2 + 箭头 10px + gap 6px×2 + 标签 42px → 名称可用宽度显著变小，靠 ellipsis 收口
  - `plan.` 系 2026-10-08 用户反馈「`planned` 太长」后由 7 字缩为 5 字，与 `arch.` 同风格；比原 `planned`（≈57px）省约 13px
- **六个标签等宽 42px（2026-10-08 用户要求）**：`box-sizing: border-box; min-width: 42px; text-align: center` 写在基础规则上，六个类共同继承
  - 42px 的来历是**实测**而非估算（Playwright + 宿主字体栈 `-apple-system, … "Segoe UI" …`）：最宽文案不是 `draft` 而是 **`done` = 25.47px**；`draft` 24.42 / `plan.` 24.33 / `arch.` 23.95 / `WIP` 20.27 / `-` 4.42
  - 内容区 = 42 − 12 = **30px**，比最宽文案多 4.5px；跨字体最坏的 Verdana 为 27.05px，仍有余量
  - `box-sizing` **必须显式声明**：若宿主存在全局 `box-sizing: border-box`，`min-width` 会落到边框盒上，内容区只剩 18px，`done` 会把该标签撑宽、等宽失效
  - 用 `min-width` 而非 `width`：字体异常宽时宁可让该标签变宽，也绝不裁掉文字
  - 浏览器实测结果：六支均 **42 × 18px**，名称左边界一致（64px）
  - > 订正：本文件早期把最宽标签估为「≈44px（draft / plan. / arch.）」，实测最大自然宽度仅 **37.47px**（`done` 25.47 + 12），该估算偏大，已按实测重写。
- 五个状态各一个类：`.dsh-leanspec-spec-status-{draft,planned,in-progress,complete,archived}`，色值只在本组规则里出现
- 占位符一个类：`.dsh-leanspec-spec-status-none`，**只有颜色、没有背景**（见 §5.5）；它是唯一一个会随主题翻转文字色的标签类
- 类名带 `spec-` 前缀：既有的 `.dsh-leanspec-status-ok` / `.dsh-leanspec-status-err`（保存状态文案）已占用 `status-` 前缀，不加前缀会与之混淆

---

## 7. 错误处理矩阵

| 场景 | 行为 |
|------|------|
| README.md 不存在 | 该 spec 不进 `statusByDir`，列表照常渲染，显示 `-` 占位 |
| README 读取抛错（权限等） | 同上，静默降级，不污染 `/tree` 响应 |
| 无 frontmatter 且正文无状态行 | 显示 `-` 占位 |
| 状态值不在枚举内（如 `foo`） | 显示 `-` 占位（不显示原始文本，避免注入） |
| 文件超大 | 只读前 2KB，天然免疫 |
| 前端 `statusByDir` 缺失（旧服务端） | `state.statusByDir` 兜底为 `{}`，每行显示 `-` 占位，UI 不报错 |

---

## 8. 测试策略（三层）

| 层 | 覆盖 | 手段 |
|----|------|------|
| 单元 | `parseSpecStatus` 全部分支（frontmatter/正文/别名/容错/非法值） | `node --test`，纯函数 |
| 单元 | `/tree` 返回 `statusByDir`；无状态时不出现 key | `test/http.test.ts` 扩展，复用已有临时目录夹具 |
| 单元 | 树渲染含标签且类名正确；非 spec 目录无标签；标签为 `span` 且不产生嵌套 button | `test/viewer-render.test.ts`：`TreeNodes` 无 hook，直接调用后遍历元素树（**不引入 react-dom**，避免新增依赖） |
| 回归 | 样式零 hex、五色灰度间距 ≥15、深字对比度 ≥4.5 | `test/styles.test.ts` 扩展断言，内联灰度与 WCAG 对比度计算 |
| 回归 | 保存后标签同步 | `test/viewer-state.test.ts` 的 reducer 用例 |
| E2E | ⚠️ **已豁免**（用户裁定 2026-10-08） | 不建自动化 E2E；替代为组件级断言 + 人工目视验收（T-E1 / T4.3） |

### 8.1 为什么豁免自动化 E2E

原始设计考虑过「自建最小挂载页 + 桩 `fetch` + Playwright」，以绕开 DSH GUI 的鉴权（实测直连 `http://127.0.0.1:43120` 返回 **403**，需会话 token，自动化不可达）。

**但用户于 2026-10-08 裁定「测试的问题我来，肉眼看」**，理由是：本仓库无 `harness/`、无 `e2e/`、无 Playwright，为此新建整套浏览器测试能力的工作量**大于功能本身**。

因此本 Spec 的验证手段改为：

1. **组件级渲染断言**（T3.3）—— 在 Node 环境断言标签 DOM、类名与文案，覆盖 REQ-1 / REQ-4 / REQ-5 的结构性部分
2. **人工目视清单**（T4.3，8 项）—— 覆盖色彩、主题、窄面板、`color-mix` 生效等**只有眼睛能判定**的部分

残余风险：颜色类名正确但实际观感异常（如 `color-mix` 未生效）无法被自动化捕获 → 由 T4.3 第 2 项（draft 呈水青色）兜住。


---

## 9. 决策权衡（含被否决方案）

| 方案 | 结论 | 原因 |
|------|------|------|
| 客户端逐个 `GET /file` 后解析 | ❌ | N+1 请求、解析逻辑重复、竞态与取消复杂 |
| 复用 LeanSpec MCP 已解析的 status | ❌ | 插件服务端与 MCP 是两个进程，无共享通道 |
| 硬编码 hex 色值 | ❌ | 违反 `styles.test.ts` 的零 hex 约束，且破坏主题一致 |
| 用 alias 层状态色 | ❌ | planned 灰 165 与 WIP 167 撞车，且主题映射未能锚定 |
| 标签取代折叠箭头 | ❌ | 丢失展开态信号（视觉意图改用"箭头弱化 + 标签紧随"达成） |
| 空心描边区分 draft | ❌ | 用户明确要求五个实心同形 |
| 建 Playwright E2E 能力 | ❌ 用户裁定豁免 | 仓库无 `harness/`/`e2e/`，GUI 直连 403 不可达，能力建设成本大于功能本身；改为组件断言 + 人工目视 |
| 点击标签切换状态 | ⏸ 另开 Spec | 需写回 frontmatter 并保留格式，工作量翻倍 |
| 按状态排序/分组/筛选 | ⏸ 不做 | 用户未提出；会改变现有树序，风险外溢 |

---

## 10. 已知阻塞与风险

| 项 | 类型 | 影响 | 处置 |
|----|------|------|------|
| `specs/001` 缺 frontmatter | 阻塞工具链 | `leanspec list/validate` 整体报错 | 本 Spec 不修，另行确认后单独处理 |
| 缺 `spec-template.md` | 阻塞工具链 | `leanspec create` 不可用 | 本 Spec 用 `mkdir` 绕过 |
| `color-mix` 支持度 | 假设 | 若不支持则 draft 与 planned 均无色 | 宿主自身已使用 `color-mix()` 派生 token，判定为可用；实现阶段已确认 `color-mix` 进入 `lib/client.js`，观感由 T4.3 第 2 项目视兜住 |
| 视觉未亲眼验证 | 验证缺口 | 布局/观感仅凭数值与用户看图 | 实现阶段在真实面板目视；色板稿见 `assets/design-references/` |
| 最接近的一对（planned↔complete 18.58 级） | 残留风险 | 黑白截图下可辨性偏弱 | 标签文字（`plan.` vs `done`）为最终兜底线索；18.58 已高于 15 级阈值 |
| `-` 在亮色主题仅 3.71:1 | **已接受的取舍** | 低于 WCAG AA 的 4.5:1 | 刻意为之：短横表示"无状态"，应退到背景；信息由五色标签承担。若要达标，改用更深的 alias 文字色（如 `--dsw-alias-label-secondary`）即可，本轮按用户选的"淡灰"执行 |
| 等宽 42px 依赖 `box-sizing` 显式声明 | 已消除 | 若宿主全局 `border-box` 生效而未显式声明，内容区只剩 18px，`done` 会撑宽自己、等宽失效 | 基础规则里显式写 `box-sizing: border-box`；`styles.test.ts` 断言该声明存在且占位符类不得覆盖它 |
