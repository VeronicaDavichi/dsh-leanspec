# 功能需求：图片文件预览

> 需求驱动（requirements-first）：需求 → 设计 → 任务。验收标准用 EARS（GIVEN / WHEN / THEN SHALL）。
> 任务见 [tasks.md](./tasks.md)，设计见 [design.md](./design.md)。

---

## 0. 项目文档摘要（docs/ 全量扫描）

本仓库**没有 `docs/` 目录**，故本 Spec 无 docs/ 来源可提炼。

| 子目录 | 状态 | 本 Spec 使用方式 |
|--------|------|-----------------|
| `docs/architecture.md` | （空） | — |
| `docs/api-contracts/` | （空） | — |
| `docs/db-schema/` | （空） | — |
| `docs/references/` | （空） | — |
| `docs/standards/` | （空） | — |

**替代真相来源**：`src/leanspec-fs.ts`（`walkSpecDir` 不过滤后缀 / `resolveExistingFile` 三道守卫）、`src/index.ts`（宿主 HTTP 桥当前写死 JSON）、`src/client/LeanspecViewer.ts`（选中后的文本加载路径）、宿主 `ctx.webServer.register`（插件已在用的接口）。

---

## 1. 概述

目录树里已有的图片文件，选中后应渲染为图片而不是乱码文本；同时**堵住"乱码被保存回原文件"这条数据丢失路径**。附带把 markdown 里内嵌的相对路径图片接上同一个只读端点。

---

## 2. 交互控件清单

| 控件 | 标识 | 触发行为 | 副作用（可观察） |
|------|------|---------|----------------|
| 树里的图片文件行 | `.dsh-leanspec-file`（后缀命中白名单） | 选中 | 正文出现 `<img>`，**不发** `/file` 文本请求 |
| 图片本体 | `.dsh-leanspec-image` | 点击 | 新标签打开 raw 原图 |
| 刷新/重试 | `[data-leanspec-image-retry]` | 点击 | 重新加载图片（失败态才出现） |
| SVG 源码切换 | `[data-leanspec-view-mode="source"]` | 点击 | 正文切为只读文本；再点「预览」切回图片 |
| 编辑 | `.dsh-leanspec-chip`（编辑） | — | 图片选中时 `disabled`，不可进入编辑 |
| 保存 | `.dsh-leanspec-save` | — | 图片选中时 `disabled`，**永不**发 PUT |

---

## 3. 功能需求

### REQ-1 图片后缀识别（纯函数，零 IO）

- GIVEN 一个文件相对路径，WHEN 其后缀（大小写不敏感）属于 `png / jpg / jpeg / gif / webp / bmp / avif / ico / svg`，THEN SHALL 判定为图片并返回**固定 MIME**。
- GIVEN 任意其他路径（`a.html` / `a.md` / `a.js` / `a.svgz` / 无后缀 / 目录路径 `/a.png/`），THEN SHALL 判定为非图片。
- GIVEN 形如 `a.png.txt` 的双重后缀，THEN SHALL 以**最后一段**为准判定为非图片。

**验收**：`npm test` → `test/media.test.ts` 覆盖 9 种后缀 + 大小写 + 5 类非图片 + 双重后缀 + 空串，全绿。

### REQ-2 二进制读取端点

- GIVEN 项目根内存在、后缀在白名单、体积 ≤ 20MB 的图片，WHEN 请求 `GET /leanspec-viewer/raw?root=<项目根>&path=<相对路径>`，THEN SHALL 返回 200 + 固定 MIME + **原始字节**（字节数完全一致）。
- THEN SHALL 同时返回 `X-Content-Type-Options: nosniff` 与 `Cache-Control: no-cache`。

**验收**：`npm test` → `test/http.test.ts` 用临时目录里的真实 PNG 断言状态码、`content-type`、`nosniff`、字节数。

### REQ-3 端点的安全边界（安全是硬需求）

- WHEN `path` 越出项目根（`../` / 绝对路径 / 符号链接指向外部），THEN SHALL 4xx 且**零字节响应体**。
- WHEN 后缀不在白名单，THEN SHALL **415**，且响应体里**不含**该文件内容。
- WHEN 文件不存在，THEN SHALL 404。
- WHEN 文件体积 > 20MB，THEN SHALL **413**。
- THEN SHALL NOT 依据请求头/查询参数决定 `Content-Type`（只取固定表）。

**验收**：`test/http.test.ts` 覆盖越权、415（含 `.html`）、404、413、HEAD（无响应体），全绿。

### REQ-4 正文渲染成图片

- GIVEN 用户选中白名单内的图片文件，WHEN 正文渲染，THEN SHALL 出现 `<img>`，其 `src` 指向 REQ-2 的端点；THEN SHALL NOT 发起文本 `/file` 请求。
- GIVEN 图片加载失败（413/415/网络错误），WHEN 失败被感知，THEN SHALL 显示人话提示 + 重试按钮，而不是空白或裂图。

**验收**：`test/image-view.test.ts`（`rawUrl` / `imageViewFor` 纯函数）+ Playwright 复刻断言真实 `naturalWidth > 0` + 413 分支提示文案。

### REQ-5 图片不可编辑（数据丢失防护）

- GIVEN 选中图片文件，THEN `编辑` 与 `保存` SHALL `disabled`。
- THEN SHALL NOT 存在任何把图片内容写回的代码路径（`writeSpecFile` 不得被图片选中态触达）。

**验收**：`test/image-view.test.ts`（`canEditFile` 对图片恒为 false）+ `test/viewer-render.test.ts` 断言图片态下两个按钮 `disabled`。

### REQ-6 SVG 源码切换

- GIVEN 选中 `.svg`，THEN 工具栏 SHALL 出现「源码」按钮；WHEN 点击，THEN 正文 SHALL 以**只读**文本显示文件内容（走既有 `/file` 读取）。
- GIVEN 处于源码视图，WHEN 点「预览」，THEN SHALL 回到图片视图。
- GIVEN 选中位图（png/jpg/…），THEN SHALL NOT 出现「源码」按钮。

**验收**：`test/image-view.test.ts`（`viewModesFor('.svg')` = `['preview','source','edit']`，位图 = `['preview','edit']` 且 `编辑` 为 disabled）+ 手工清单第 3 条。

### REQ-7 markdown 内嵌相对图片

- GIVEN markdown 渲染出的 `<img src="./img/x.png">` 或 `src="img/x.png"`，WHEN 预览，THEN `src` SHALL 被改写为 REQ-2 的端点（绝对路径形式）。
- GIVEN `src` 是 `http://` / `https://` / `data:` / `//` 开头或已是端点路径，THEN SHALL 原样保留。
- GIVEN 相对路径含 `../`，THEN SHALL 依据**当前文件所在目录**解析，且改写结果不得越出项目根。

**验收**：`test/markdown-image.test.ts` 覆盖 6 类 src（相对、`./`、`../`、绝对 http、`data:`、协议相对），全绿。

### REQ-8 大图与错误提示

- GIVEN 图片 > 20MB，WHEN 预览，THEN SHALL 显示「图片过大（>20MB）」而不是裂图。
- GIVEN 后缀命中白名单但内容不是有效图片，WHEN 加载失败，THEN SHALL 显示「不是有效的图片」类提示。

**验收**：Playwright 复刻（构造 413 响应）断言文案 + 清单第 4 条。

---

## 4. 非功能需求

| # | 要求 | 验收 |
|---|------|------|
| N-1 | 不新增宿主扩展点（只用插件已在用的 `ctx.webServer.register`） | 代码评审 + grep 无新的 `ctx.` 服务引用 |
| N-2 | 不引入新依赖 | `package.json` dependencies 不变 |
| N-3 | 零硬编码颜色（仅 `--dsw-*`） | `test/styles.test.ts` 的 `#hex` 断言保持绿 |
| N-4 | 二进制绝不当 utf8 读 | 图片选中态下无 `/file` 请求（Playwright 网络断言） |
| N-5 | `tsc --noEmit` 干净、全部既有测试保持绿 | `npm run typecheck` + `npm test` |

---

## 5. 约束与假设

| # | 假设 | 影响 / 若不成立 |
|---|------|----------------|
| A-1 | 图片位于项目根内（`root` 参数语义） | 端点复用 `resolveExistingFile`，越界一律 4xx；不成立则需放宽守卫（不做） |
| A-2 | 树已列出非 `.md` 文件 | 已核实（`walkSpecDir` 不过滤）；若不列出则需求还要带树过滤改动 |
| A-3 | 宿主 HTTP 桥允许返回非 JSON | 需改 `src/index.ts` 的响应分支（本 Spec 唯一宿主接触点）；若宿主禁止则退化为 base64，收益下降 |
| A-4 | `<img>` 加载 SVG 不执行其中脚本 | 依浏览器规范；因此禁止内联 SVG（F-5） |
| A-5 | E2E 豁免沿用 007 | 用户「测试的问题我来，肉眼看」；替代验证见 README |
