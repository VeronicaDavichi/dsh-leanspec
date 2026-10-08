---
status: in-progress
priority: medium
tags: [viewer, media, ui, security]
created: 2026-10-08
---

# 图片文件预览（含 markdown 内嵌相对图片）

**类型**: 需求驱动（requirements-first）
**状态**: in-progress（Phase 1、2、3、T4.1、T4.3 完成；**待 T4.2 手工清单 —— 需你肉眼**）
**优先级**: medium
**创建日期**: 2026-10-08

---

## 概述

目录树里**一直就有图片文件** —— `src/leanspec-fs.ts` 的 `walkSpecDir` 只跳过点开头的条目，**不按后缀过滤**，所以 `specs/007-…/assets/x.png` 之类早就列在树里了。

问题是选中它之后的处理**全按文本**：

1. `readSpecFile` 用 `fs.readFileSync(file, 'utf8')` 读 ✅ → 正文区显示一堆乱码或替换字符
2. `编辑` 按钮对任何已选文件都可用 ✅ → 用户一旦手滑在编辑器里改动并点 `保存` ✅ → `writeSpecFile` 会把**这份损坏的文本写回原文件** ❌ **真·数据丢失**

也就是说这不是"少个功能"，而是一条**能毁掉用户图片**的缺口。本 Spec 补上"后缀是图片就渲染成图片"这条规则，并把 markdown 里内嵌的相对路径图片一起接上同一个只读端点。

## 冻结决策

| # | 决策 | 理由 |
|---|------|------|
| F-1 | 白名单 9 种：`png / jpg / jpeg / gif / webp / bmp / avif / ico / svg`，大小写不敏感 | 覆盖浏览器原生可渲染格式；白名单是**安全边界**，不是顺手过滤 |
| F-2 | 图片走新端点 `/leanspec-viewer/raw`，**只读** | 二进制不能塞进 JSON，也不该 base64（体积 +33%，大图还会卡住主线程） |
| F-3 | 服务端**永不**吐白名单外的类型；`Content-Type` 只能取固定表 | 否则同源下可被用来渲染 HTML/HTML-like ⇒ XSS |
| F-4 | SVG **默认当图片**，工具栏额外给「源码」只读切换 | 用户选定「两者都要」：既要是图片，也要能读 XML |
| F-5 | 图片一律 `<img>` 加载（**绝不内联为 HTML**） | `<img>` 里的 SVG 不执行脚本；内联就等于把小宇宙交给文件作者 |
| F-6 | 上限 20MB，超限 413 + 人话提示 | 防止一次误点把宿主内存吃满；20MB 覆盖正常截图/设计稿 |
| F-7 | markdown 内嵌**相对路径**图片改写为 raw 端点；绝对 URL / `data:` 原样保留 | 复用同一个端点，顺手修掉"markdown 图片裂图"这个同族 bug |
| F-8 | 不改目录树 | 图片已经在树里（已核实），加图标属于本期范围外 |

## 导航

- [requirements.md](./requirements.md) —— REQ-1…REQ-8 + EARS 验收标准
- [design.md](./design.md) —— 端点契约、安全边界、客户端视图矩阵、测试策略
- [tasks.md](./tasks.md) —— Phase 0…4 任务与验证方法

## 实现实测数字（Phase 1–3 + T4.1 完成后）

三绿命令的实际输出（**由验收方独立复跑**，非实现者自述）：

| 命令 | 结果 |
|------|------|
| `npm run typecheck` | 干净（`tsc --noEmit` 无输出） |
| `npm test` | **tests 185 / pass 185 / fail 0**（基线 143 全绿，本 Spec 新增 42） |
| `npm run build` | `lib/index.js` **12.2kb** / `lib/client.js` **110.4kb**（= 12,522 B / 113,045 B）；产物里能 grep 到 `dsh-leanspec-image-wrap`、`/leanspec-viewer/raw`、两处 `x-content-type-options` |

新增测试分布：`media` 7、`image-view` 6（Phase 1 已完成）＋ `markdown-image` **17**、`leanspec-fs` **+3**（26）、`http` **+10**（19）、`viewer-state` **+3**（15）、`viewer-render` **+9**（23）。

端点实测状态矩阵（`test/http.test.ts`，真实临时目录 + 运行时构造的 1×1 PNG）：

| 场景 | 状态 | 断言要点 |
|------|------|---------|
| 白名单内、≤20MB | 200 | 字节完全一致 + `image/png` + `cache-control: no-cache` + 无 JSON 外壳 |
| `path` 缺失 / 空串 / 全空格 | 400 | 无 `binary` |
| `.html` / `.md` / 无后缀 / `dir/` | 415 | 响应体**不含**文件内容，也不含项目绝对路径 |
| 白名单内但不存在 | 404 | 同上，不回显绝对路径 |
| 20MB + 1（稀疏文件） | 413 | 在 `readFileSync` **之前**由 `statSync` 判定 |
| `../` / 绝对路径 / 目录 / 外指符号链接 | 403 | 只回固定文案 |
| `HEAD` | 200 | 同样的头，`end` 的字节数为 0；超限时同样是 413 |

### T4.1 复刻量测（真浏览器，不是推理）

`.explore/verify-image-preview.ts` 复用**真** `handleLeanspecHttp` 与**真** `LEANSPEC_STYLES`，只需一张 487 B 真 PNG（240×140），其余 fixture 脚本自建。
复现：`node --experimental-strip-types .explore/verify-image-preview.ts`

| 层 | 实测 |
|----|------|
| 端点矩阵（Node 侧，先于浏览器） | **7/7 PASS**：200 → `image/png` **487 B** + `no-cache` + `nosniff`；415 / 413（21MB）/ 404 / 400（缺 `path`）/ 403（`..` 越界）全对，**六条错误响应零文件内容泄漏** |
| 浏览器解码 | `complete=true`、**`naturalWidth 240` × `naturalHeight 140`**（与 fixture 真尺寸一致）、`currentSrc` 即 `rawUrl` 产出、渲染盒 **240×140**（不拉伸） |
| 真实样式生效 | img `max-width:100%` / `max-height:100%` / `object-fit:contain`、link `display:flex`、wrap `overflow:auto`（大图可滚） |
| 像素确证 | 绿像素 **30,624** 个、包围盒 **232×132**、白边 **2,976** 个 ⇒ `240×140 − 232×132 = 2,976` **分毫不差**（截图 `.explore/t4-1-render.png`） |

**实测勘误（本轮发现，属正确设计、记录以免后人踩坑）**：端点路径是**相对 `specs/`** 的 —— `resolveExistingFile` 内部为 `path.resolve(<root>/specs, relPath)`。首轮 fixture 误用「相对项目根」，于是 200 与 413 都假报 404；改对后 7/7。该约定与 `rawUrl`、markdown 改写、`/file`、目录树完全一致。

数据丢失防护（REQ-5）在**三层**同时生效，渲染层的 `disabled` 只是其中一层：

1. `ViewerMain` 渲染 `编辑` chip 但 `disabled`（保留可见，不隐藏）+ `保存` `disabled`
2. `viewer-state.ts` 的 `set-mode` 遇图片切 `edit` 直接返回**原 state 对象**（绕不过 disabled 属性）
3. `LeanspecViewer.save()` 入口再查 `canEditFile(state.selected)`，图片选中态下 `writeSpecFile` 不可达

## 验证完成情况

| 任务 | 状态 | 证据 |
|------|------|------|
| T4.1 Playwright 复刻量测 | **完成 ✅** | 上表：7/7 端点矩阵 + `naturalWidth 240×140` + 像素 30,624 个（`.explore/t4-1-render.png`） |
| T4.2 手工清单（5 条） | **待用户肉眼** | 清单见 [tasks.md](./tasks.md)；想先看端点侧效果可跑 `.explore/verify-image-preview.ts` 再开它打印的 URL |
| T4.3 文档回写 | **完成 ✅** | 本 README + tasks.md（根 `README.md` 的功能章节与版本历史仍待补一行「图片预览」，属范围外待办） |

## 硬规则偏离说明

| 硬规则 | 偏离 | 依据 |
|--------|------|------|
| UI 需求必须配 E2E | **豁免** | 用户「测试的问题我来，肉眼看」（002 起记录，007 显式确认）；本 Spec 沿用同一豁免 |
| 生成前先读模板 | `.lean-spec/templates/` 只有 `bugfix-template.md`，需求/设计/任务模板**缺失** | 按 007 已成型的房屋风格写作；模板缺失本身记录在此，不静默跳过 |
| E2E 替代验证 | 纯逻辑单测 + Playwright 复刻量测 + 手工清单 | 与 007 同一套策略；**复刻量测已按替代验证执行完毕（T4.1 ✅）**，手工清单待用户肉眼 |
