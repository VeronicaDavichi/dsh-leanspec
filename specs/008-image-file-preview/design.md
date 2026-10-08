# 技术设计：图片文件预览

> 需求见 [requirements.md](./requirements.md)；任务见 [tasks.md](./tasks.md)。
> 需求驱动，顺序为 需求 → 设计 → 任务。

---

## 1. 架构与数据流

```
目录树点中 x.png
      │
      ├─(浏览器请求)──> GET /leanspec-viewer/raw?root=<项目根>&path=<相对路径>
      │                      │
      │                      ├─ resolveExistingFile()   ← 复用既有三道守卫（越界即抛）
      │                      ├─ statSync: 是文件? ≤ 20MB?
      │                      └─ imageMimeType(path)     ← 白名单命中? 否则 415
      │                      ↓
      │                200 + 固定 MIME + nosniff + 原始字节
      │
      └─ 正文区 <img src=…>（绝不内联 SVG）
```

- **客户端不做路径拼接**：`src` 只带 `root` 与 `path` 两个查询参数，越权判断 100% 在服务端。
- **服务端不读 utf8**：图片路径走 `readSpecBinary`（Buffer），文本路径继续走 `readSpecFile`。
- **markdown 内嵌图片**复用同一端点：渲染后把相对 `src` 改写为 `rawUrl`。

---

## 2. 端点契约

| 项 | 值 |
|----|-----|
| 方法 | `GET`（`HEAD` 仅返回头部，无响应体） |
| 路径 | `/leanspec-viewer/raw` |
| 查询参数 | `root`（项目根，可省略走宿主默认）、`path`（相对路径，必填） |
| 200 | `Content-Type: <固定 MIME>`、`X-Content-Type-Options: nosniff`、`Cache-Control: no-cache`、原始字节 |
| 400 | `path` 缺失或为空 |
| 403 | 越出项目根 / 非普通文件 |
| 404 | 文件不存在 |
| 413 | 体积 > `MAX_IMAGE_BYTES`（20MB） |
| 415 | 后缀不在白名单（**尤其 `.html`、无后缀**） |
| 500 | 未预期 IO 错误（不得回显绝对路径） |

错误响应体一律 JSON `{ "error": "…" }`（人类可读，**不含绝对路径与服务端栈**）。

**宿主桥契约扩展**（`src/http.ts` → `src/index.ts`）：

```ts
export interface LeanspecHttpResult {
  status: number
  body?: unknown
  /** 新增：二进制响应。存在时 index.ts 优先走字节分支。 */
  binary?: { bytes: Buffer; contentType: string; headers?: Record<string, string> }
}
```

`src/index.ts` 只加一个分支：`result.binary` 存在 → `res.writeHead(status, { 'content-type': binary.contentType, 'x-content-type-options': 'nosniff', ...binary.headers })` + `res.end(binary.bytes)`；否则维持现在的 JSON 行为。**宿主 API 用法不变**（仍是 `ctx.webServer.register`），不新增扩展点。

---

## 3. 白名单与 MIME 表（唯一真相）

`src/media.ts`（**纯模块：不 import node/不碰 DOM**，服务端与客户端共用）：

```ts
export const IMAGE_MIME: Readonly<Record<string, string>> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', bmp: 'image/bmp', avif: 'image/avif',
  ico: 'image/x-icon', svg: 'image/svg+xml',
}
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024
export function imageMimeType(relPath: string): string | undefined   // 后缀键查表，大小写不敏感
export function isImagePath(relPath: string): boolean
export function isSvgPath(relPath: string): boolean
```

**后缀提取规则**（REQ-1 的边界都落在这里）：

1. 以 `/` 结尾 ⇒ 非图片（是目录）
2. 无 `.` 或 `.` 在最后一位 ⇒ 非图片
3. 取**最后**一个 `.` 之后的小写片段查表 ⇒ `a.png.txt` 因 `txt` 不在表内判为非图片

---

## 4. 安全设计

| 威胁 | 处置 |
|------|------|
| 目录穿越（`../../.ssh/id_rsa`、绝对路径、symlink 出界） | 复用 `assertRelPath` + `isInside` + `resolveExistingFile`，**不新增路径逻辑**；越界 403 |
| 同源 XSS（把 `.html` / `.svg` 当文档渲染） | 白名单外一律 415；`Content-Type` 只取固定表，永不采纳请求方输入；全响应带 `nosniff` |
| SVG 内嵌脚本 | 只用 `<img src>` 加载（脚本不执行）；**禁止** `dangerouslySetInnerHTML` 注入 SVG 文本 |
| 内存耗尽 | `statSync` 先量体积，超 20MB 在**读取之前**返回 413 |
| 路径/栈信息泄露 | 错误体只用固定文案；不把绝对路径写进响应 |
| 缓存污染 | `Cache-Control: no-cache`（文件可能被外部工具改写） |

反例（明确不做）：把文件内容 base64 后塞进 JSON（体积 +33%、大图阻塞主线程）、按请求的 `Accept`/后缀头决定 MIME、把 SVG 源码内联进 HTML。

---

## 5. 客户端设计

### 5.1 视图模式矩阵

`ViewMode` 增加 `'source'`（只读文本）。工具栏 chips 由**纯函数**决定：

| 选中文件 | chips | 正文 |
|----------|-------|------|
| 非图片（`.md` 等） | 预览 / 编辑 | 现状不变 |
| 位图（png/jpg/…） | 预览（激活） / 编辑（disabled） | `<img>` |
| SVG | 预览 / 源码 / 编辑（disabled） | 预览 → `<img>`；源码 → 只读 `<pre>` |

`保存` 在图片选中态恒 `disabled`（REQ-5，堵住"乱码写回"）。

### 5.2 请求矩阵（避免把二进制当 utf8 读，N-4）

| 选中态 | `GET /file`（文本） | `GET /raw`（字节） |
|--------|--------------------|-------------------|
| 非图片 | 是 | 否 |
| 图片 + 预览 | **否** | 是（由 `<img>` 发起） |
| SVG + 源码 | 是 | 否 |

### 5.3 新增纯函数（`src/client/image-view.ts`，无 hook 无 DOM）

```ts
export function rawUrl(projectRoot: string, relPath: string): string
export function viewModesFor(relPath: string | null): ViewMode[]     // 上表第一列
export function canEditFile(relPath: string | null): boolean          // 图片恒 false
export function shouldLoadText(relPath: string | null, mode: ViewMode): boolean
export function imageLoadErrorText(status: number): string            // 413/415/其他 → 人话
```

markdown 改写放在 `src/client/markdown.ts`（纯）：`rewriteImageSrc(html, docPath, projectRoot)` —— 只改**相对** `src`（`http(s)://`、`data:`、`//`、已含 `/leanspec-viewer/raw` 的一律跳过），并按 `docPath` 所在目录解析 `./` 与 `../`。

### 5.4 样式（零硬编码色）

`.dsh-leanspec-image-wrap`（居中、可滚动）、`.dsh-leanspec-image`（`max-width/max-height: 100%`、`object-fit: contain`、`cursor: zoom-in`）、`.dsh-leanspec-image-error`（复用 warning 语义 token）。

---

## 6. 错误处理与文案

| 触发 | 文案（人话） | 可操作项 |
|------|-------------|---------|
| 413 | 图片过大（超过 20MB），未加载 | 重试 / 用外部工具打开 |
| 415 | 这个后缀不在可预览的图片白名单里 | 仅提示 |
| 解码失败 | 这个文件不是有效的图片 | 重试 |
| 403/404 | 文件不存在或不在当前项目内 | 重试 |

失败态渲染 `role="alert"` + `[data-leanspec-image-retry]` 重试按钮（`<img>` 的 `key` 变更触发重新加载）。

---

## 7. 决策权衡

| 选择 | 舍弃的方案 | 理由 |
|------|-----------|------|
| 独立只读端点 | 扩展现有 `/file` 返回 base64 | 端点职责单一；大图不占 JSON 内存；浏览器可原生缓存 |
| 20MB 硬上限 | 无上限 / 按像素上限 | 与"防误点"目标匹配，且 `statSync` 即可判定（无需解码） |
| SVG 默认 `<img>` + 显式「源码」 | 默认源码 / 默认内联 | 用户要求"两者都要"；内联是 XSS 面 |
| 白名单固定 9 种 | 按 MIME 嗅探（magic bytes） | 嗅探要读头部 + 实现嗅探器；白名单足够且**更安全**（默认拒绝） |
| 不改目录树 | 给图片加图标 | 树里已经有图片条目，加图标属范围外（记入后续 spec 池） |

---

## 8. 测试策略（三层 + E2E 豁免）

| 层 | 覆盖 | 手段 |
|----|------|------|
| 单测 | `media`（后缀矩阵）、`http`（200/400/403/404/413/415/HEAD）、`image-view`（视图矩阵、`rawUrl` 编码）、`markdown-image`（6 类 src） | `node --test --experimental-strip-types` |
| 复刻量测 | 真实 1×1 PNG 断言 `naturalWidth > 0`；413 分支文案 | Playwright + DOM 断言 + Pillow 像素扫 |
| 手工清单 | 真机宿主里点一遍（树→图片→源码→重试） | 人工肉眼（用户自测） |

**E2E 豁免**：与 007 相同（用户「测试的问题我来，肉眼看」），偏离已记入 README 表格，非静默跳过。

---

## 9. 影响文件

| 文件 | 变更 |
|------|------|
| `src/media.ts` | 新增（纯）：白名单 + MIME + 上限 + 判定 |
| `src/leanspec-fs.ts` | 新增 `readSpecBinary`；`LeanspecErrorCode` 增 `too-large` / `unsupported-media` |
| `src/http.ts` | 新增 `/raw` 路由；结果类型增 `binary` |
| `src/index.ts` | 响应分支支持二进制 + 统一 `nosniff` |
| `src/client/image-view.ts` | 新增（纯）：视图矩阵、`rawUrl`、文案 |
| `src/client/viewer-state.ts` | `ViewMode` 增 `'source'` |
| `src/client/LeanspecViewer.ts` | 图片分支渲染 + chips/禁用逻辑 + 文本加载条件 |
| `src/client/markdown.ts` | `rewriteImageSrc`（纯）并接入预览 |
| `src/client/styles.ts` | 图片容器/图片/错误态样式 |
| `test/*` | `media`、`http`、`image-view`、`markdown-image`、渲染断言 |
