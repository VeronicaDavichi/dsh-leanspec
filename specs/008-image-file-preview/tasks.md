# 实现任务：图片文件预览

> 任务引用 [requirements.md](./requirements.md) 的 REQ-N；设计依据见 [design.md](./design.md)。
> 完成定义（每个任务）：代码 + 验证命令通过 + 无遗留监听/注册。

---

## Phase 0：前置确认

- [x] T0.1 确认 E2E 豁免沿用 007 —— **已确认 ✅**
  - 依据：用户「测试的问题我来，肉眼看」（002 起记录，007 已确认）；本轮用户以 `/leanspec-apply 008` 授权开工，且上一轮已被告知"默认照旧"未提异议
  - 替代验证：纯逻辑单测（`node --test`）+ Playwright 复刻量测 + 手工清单
  - 说明：`leanspec-apply` 的「UI 需求必须配 E2E」预检因此**未通过**，属**显式记录后继续**（非静默跳过）；预检实测：`e2e/`=不存在、`harness/verify-e2e.sh`=不存在、tasks.md 中 e2e 任务数=0
  - 命令替换：本仓库无 `harness/`，`./harness/test-backend.sh` 等一律替换为 `npm run typecheck` / `npm test` / `npm run build`
  - 验证：README「硬规则偏离说明」表格存在且含本行 ✅

- [x] T0.2 记录模板缺失 —— **已记录 ✅**
  - 内容：`.lean-spec/templates/` 仅有 `bugfix-template.md`；需求/设计/任务模板不存在，本 Spec 按 007 房屋风格书写
  - 验证：`glob .lean-spec/**/*.md` → 只命中 `bugfix-template.md` ✅，与 README 描述一致 ✅

---

## Phase 1：纯逻辑（零 IO、零 DOM）

- [x] T1.1 [REQ-1][REQ-3] 新增 `src/media.ts` —— **完成 ✅**
  - 内容：`IMAGE_MIME`（9 种）、`MAX_IMAGE_BYTES`、`imageMimeType`、`isImagePath`、`isSvgPath`；后缀取最后一段、大小写不敏感、目录路径与非白名单后缀返回 undefined
  - 验证：`npm run typecheck` 干净；模块**无 `node:` import**（客户端直接复用同一张表，两侧不可能对 `.webp` 各说各话）✅

- [x] T1.2 [REQ-1] 新增 `test/media.test.ts` —— **完成 ✅**
  - 内容：9 种后缀逐个断言 MIME；`A.PNG` 大小写；11 类非图片（含 `.png` 点文件、`a.png.txt`、`index.html`、`dir.png/`、`trailing.`、空串）；Windows 分隔符；`MAX_IMAGE_BYTES` 恰为 20MB
  - 验证：`npm test` → `test/media.test.ts` **7 例全绿** ✅（其中整表 `deepEqual` 钉死：增删类型必须是显式改动）✅

- [x] T1.3 [REQ-4][REQ-5][REQ-6] 新增 `src/client/image-view.ts` —— **完成 ✅**
  - 内容：`rawUrl`（`URLSearchParams` 双向编码，服务端用 `URL.searchParams` 读回，两侧不可能不一致）、`viewModesFor`、`canEditFile`、`shouldLoadText`、`imageLoadErrorText`
  - 验证：`npm test` → `test/image-view.test.ts` **6 例全绿** ✅（含 `a b&c#d 中文.png` 往返、空 root 保留、视图矩阵、9 种图片 `canEditFile` 恒 false、三态 `shouldLoadText`、413/415/403/404/500 文案）✅

- [x] T1.4 [REQ-7] `src/client/markdown.ts` 增 `rewriteImageSrc` —— **完成 ✅**
  - 内容：只改相对 `src`；跳过 `http(s)://`、`data:`、`//`、已含 `/leanspec-viewer/raw`；按 `docPath` 目录解析 `./` 与 `../`；越出项目根时保留原值
  - 验证：`npm test` → `test/markdown-image.test.ts` **17 例全绿** ✅
    - 6 类 src（相对 / `./` / `../` / 绝对 http / `data:` / 协议相对）全绿，另加：多层 `../`、根相对 `/x.png`、已是端点路径、越界保留原值、单引号属性、`data-src`/`srcset` 不误伤、非 ASCII（`marked` 会先转义成 `%E4%B8%AD%E6%96%87`，改写前解码）、`?`/`#` 后缀、无 `img` 时原样返回
    - 断言方式：把改写结果交给 `new URL()` 解析后核对 `root` / `path` 两个查询参数，而不是字符串比对 —— 校验的正是 `src/http.ts` 会读回的东西

---

## Phase 2：服务端只读端点

- [x] T2.1 [REQ-2][REQ-3] `src/leanspec-fs.ts` 增 `readSpecBinary` —— **完成 ✅**
  - 内容：复用 `resolveExistingFile`；`statSync` 先判"是文件"与体积上限（**读取之前**）；超限抛 `LeanspecError('too-large')`；`LeanspecErrorCode` 增 `too-large` / `unsupported-media`
  - 验证：`npm test` → `test/leanspec-fs.test.ts` **26 例全绿**（新增 3 例）✅
    - 真实 1×1 PNG（运行时 base64 构造，**不提交二进制 fixture**）字节完全一致，并断言 PNG magic `89 50 4E 47…`
    - 超限：显式小额度 + `truncateSync` 到 20MB+1（稀疏文件，不真写 20MB）两路都抛 `too-large`
    - 目录：抛 `not-file`

- [x] T2.2 [REQ-2][REQ-3] `src/http.ts` 增 `/leanspec-viewer/raw` 路由 —— **完成 ✅**
  - 内容：白名单未命中 → 415；缺失 path → 400；`too-large` → 413；`not-found` → 404；越界 → 403；命中 → `binary`（固定 MIME + `cache-control: no-cache`）；`HEAD` 无响应体
  - 验证：`npm test` → `test/http.test.ts` **19 例全绿**（新增 10 例，超出计划的 7 例）✅
    - 200：字节数一致 + `image/png` + `no-cache` + `body === undefined`（无 JSON 外壳）
    - 400：无 `path` / 空串 / 全空格
    - 415：`.html`、`.md`、无后缀、`dir/`、`index.html/`；**响应体不含文件内容**（同时断言不含 `secret page`、`# Hello`、项目绝对路径）
    - 404：白名单内但文件不存在；413：20MB+1（读之前就被拒）；403：`../`、`../../`、`a/../../`、绝对路径、**目录（`dir.png`）**、**指向外部的符号链接**
    - HEAD：200 + 同样的头 + `bytes.length === 0`；超限文件的 HEAD 也是 413（失败原因可诊断，客户端 HEAD 探针依赖这一点）
  - 顺序说明：白名单判定在碰文件系统**之前**（`unsupported-media` 由路由抛出），所以 `../x.html` 这类是 415 而不是 403 —— 两者都是 4xx，且 415 更严格（文件根本没被打开）；目录的 403 由路由把 `not-file` 映射过来（design.md §2 把「非普通文件」记为 403，而 `/file` 保持历史的 404，映射只发生在 `/raw` 内）

- [x] T2.3 [REQ-2] `src/index.ts` 支持二进制响应 —— **完成 ✅**
  - 内容：`result.binary` 存在走字节分支，否则维持 JSON；两条分支都带 `x-content-type-options: nosniff`
  - 验证：`npm test` → 既有 JSON 路由断言全绿（不回归）+ `test/http.test.ts` 新增宿主桥断言（假 `req`/`res` 驱动 `ctx.webServer.register` 拿到的真实 handler）✅
    - JSON 分支：`application/json; charset=utf-8` + `nosniff`
    - binary 分支：`image/png` + `nosniff` + `cache-control: no-cache` + 原始字节一致；请求带 `Accept: text/html` 与 `?type=text/html` 时 `Content-Type` **仍是**白名单表里的 `image/png`（REQ-3 末条）
    - `HEAD` 经宿主桥后 `res.end` 的字节数为 0
  - 说明：**本 Spec 唯一的宿主 API 接触点**，使用的仍是插件已在用的 `ctx.webServer.register`

---

## Phase 3：客户端接入

- [x] T3.1 [REQ-6] `ViewMode` 增 `'source'` —— **完成 ✅**
  - 内容：`viewer-state.ts` 的类型与 reducer（`set-mode` 接受 `'source'`）；`select` 重置为 `'preview'`
  - 额外（数据丢失面，用户本轮追加强调）：`set-mode` 切 `'edit'` 时 **reducer 层直接拒绝图片**（`isImagePath` 判定，返回原 state 对象），键盘/程序化 dispatch 也绕不过去
  - 验证：`npm test` → `test/viewer-state.test.ts` **15 例全绿**（新增 3 例：切 source 再切回、重选后回落 `preview`、reducer 拒绝 `png`/`svg` 进 edit 且返回**同一个** state 对象）✅

- [x] T3.2 [REQ-4][REQ-5] `LeanspecViewer.ts` 图片分支 —— **完成 ✅**
  - 内容：文本加载条件改 `shouldLoadText(selected, mode)`；正文新增图片分支；chips 由 `viewModesFor` 生成；`编辑`/`保存` 用 `canEditFile` 禁用；失败态 `role="alert"` + 重试按钮（`key` 变更重载）
  - 分层：新增两个**无 hook 组件** —— `ViewerMain`（工具栏 + 正文）与 `ImageView`（图片 / 失败态），`LeanspecViewer` 只留 hook 与外壳 —— 与既有 `PanelSplitter` / `TreeNodes` 同一手法，所以渲染断言不需要 DOM / react-dom
  - 数据丢失防护的三道闸（用户强调的那条）：
    1. **渲染层**：图片选中时 `编辑` chip **保留可见但 `disabled`**（不是隐藏），`保存` 同样 `disabled`
    2. **reducer 层**：`set-mode → 'edit'` 对图片直接返回原 state（T3.1）
    3. **写盘层**：`save()` 守卫 `!canEditFile(state.selected) → return`，图片选中态下 `writeSpecFile` 不可达
  - 失败原因：`<img onError>` 不带状态码，所以由宿主组件对该 URL 发一次 `HEAD`，再用 `imageLoadErrorText(status)` 出人话（413 超 20MB / 415 白名单 / 其他「不是有效的图片」）；HEAD 探针打的是 `/raw`，**不是** `/file`
  - 验证：`npm test` → `test/viewer-render.test.ts` **23 例全绿**（新增 9 例）✅
    - 图片态：chips = `[preview, edit]`、`编辑` 文案为「编辑」且 `disabled === true`、`保存` `disabled === true`
    - 文档态不回归：`编辑` 可用、`保存` 未改动时禁用、改脏后可用
    - 图片正文：`<img>` 的 `src` 解析回 `root` / `path` 两项；正文**没有** `dsh-leanspec-source` / `dsh-leanspec-editor` / `dsh-leanspec-preview`（N-4：绝不把二进制当文本渲染）；外层 `<a target="_blank">` 指向同一 URL（点击开原图）
    - SVG：chips = `[preview, source, edit]`，默认渲染 `<img>`；`source` 模式切成只读 `<pre>` 且 XML 被转义（出现 `&lt;svg`、绝不出现 `<svg`），且无 `<img>`
    - 失败态：`role="alert"` + `[data-leanspec-image-retry]` 按钮，文案含「20MB」，点击触发 `onImageRetry`；无 `<img>`
    - 重试机制：`key` 为 `src#nonce`，nonce 变化即重挂载重新请求；`onError` 会上报
  - 契约对齐：chip 带 `data-leanspec-view-mode`（即需求清单里的 `[data-leanspec-view-mode="source"]` 选择器）

- [x] T3.3 [REQ-7] markdown 预览接入 `rewriteImageSrc` —— **完成 ✅**
  - 内容：预览 HTML 渲染前改写（`ViewerMain` 内，只在有 `img` 的 markdown 预览上执行）
  - 验证：`npm test` → `test/viewer-render.test.ts` 新增 1 例 ✅
    - `![](./assets/shot.png)` → `src` 指向 `/leanspec-viewer/raw`，`path=008-image/assets/shot.png`
    - `![](https://example.com/a.png)` → 原样不变

- [x] T3.4 [REQ-4][REQ-8] 图片样式（零硬编码色）—— **完成 ✅**
  - 内容：`.dsh-leanspec-image-wrap` / `.dsh-leanspec-image` / `.dsh-leanspec-image-error`（+ `.dsh-leanspec-image-link`，承载 `max-height` 所需的定高祖先）
  - 验证：`npm test` → `test/styles.test.ts` 的 `#hex` 断言保持绿 ✅；`test/styles-source.test.ts` 2 例绿（模板字面量恰好 2 个反引号、body 内无 `${`）✅
  - 说明：颜色只用 `--dsw-alias-state-warn-tertiary` / `--dsw-alias-state-warn-label`（与 `.dsh-leanspec-banner` 同一对 token）

---

## Phase 4：验证与交付

- [x] T4.1 [REQ-2][REQ-4] Playwright 复刻量测（替代 E2E）—— **完成 ✅（由我执行，不采信实现者自述）**
  - 内容：`.explore/verify-image-preview.ts` —— 复用**真** `handleLeanspecHttp` 与**真** `LEANSPEC_STYLES`，页面 markup 用 `ImageView` 同一套 class（`.dsh-leanspec-image-wrap` > `.dsh-leanspec-image-link` > `img.dsh-leanspec-image`），并镜像 `src/index.ts` 的两分支响应写入
  - **端点矩阵（Node 侧，先于浏览器）7/7 PASS** ✅：200 → `image/png` **487B** + `cache-control: no-cache` + `nosniff`；415（`.html`）✅ 413（21MB）✅ 404 ✅ 400（缺 `path`）✅ 403（`..` 越界）✅ —— 六条错误响应**零文件内容泄漏** ✅
  - **浏览器实测**（Playwright）：`complete=true`、**`naturalWidth 240` × `naturalHeight 140`**（与 fixture 真尺寸一致）、`currentSrc` = `rawUrl` 产出、渲染盒 **240×140**（不拉伸）、真实样式生效（img `max-width:100%` / `max-height:100%` / `object-fit:contain`，link `display:flex`，wrap `overflow:auto`）
  - **像素确证**（Pillow 扫 `.explore/t4-1-render.png`）：绿像素 **30,624** 个、包围盒 **232×132**、白边 **2,976** 个 ⇒ `240×140 − 232×132 = 2,976` **分毫不差** ⇒ 字节真的画出来了 ✅
  - 复现：`node --experimental-strip-types .explore/verify-image-preview.ts`（只需 `.explore/t4-1-proj/specs/008-demo/assets/dot.png` 这张 487B 真 PNG，其余 fixture 脚本自建）
  - **勘误（本轮实测发现）**：端点路径约定是**相对 `specs/`**（`resolveExistingFile` = `path.resolve(<root>/specs, relPath)`）；首轮 fixture 误用「相对项目根」⇒ 200/413 假 404，改对后 7/7。该约定与 `rawUrl`、markdown 改写、`/file`、目录树**完全一致**，已记入 README
  - 残余：弹窗/右栏两形态下的**观感**（窄高面板里 `max-height` 依赖 `link` 的定高祖先）仍属 T4.2 肉眼范围

- [ ] T4.2 [REQ-3] 手工清单（用户肉眼）—— **待你执行**
  - 1. 树里点 `*.png` → 正文出现图片，不是乱码
  - 2. 图片态下 `编辑`/`保存` 是灰的，点不动
  - 3. 点 `.svg` → 图片；点「源码」→ 只读 XML；点「预览」→ 回到图片
  - 4. markdown 里 `![](./x.png)` 能显示出来
  - 5. 用 20MB 以上图片试一次 → 看到"图片过大"提示而不是裂图
  - 验证：用户逐条反馈
  - 想先看端点侧效果（不装插件也行）：`node --experimental-strip-types .explore/verify-image-preview.ts` → 打开它打印的 URL
  - **首轮实测反馈（2026-10-08）**：点图片报「文件不存在或不在当前项目内」= HTTP **403/404**。已排查并**排除**：`/file` 与 `/raw` 基准同源（都用 `resolveExistingFile`）、`root=''` 与不传 root 等价（`requestRoot` 把 `''` 当缺省）、`ViewerMain.selected === state.selected`（与文本请求同一个值）、两份产物均含新代码（`lib/index.js` 有 `/raw` + binary 分支，`lib/client.js` 有 `image-wrap`）
  - **该轮暴露的自身缺陷（已修）**：旧文案把「已注册路由的 404（文件没了）」与「未注册路由的 404（宿主仍是旧产物）」**压成同一句**，把一次定位从 0 成本变成一轮往返。现改为携带 HTTP 状态 + 服务端 `code`：**无 `code` 的 404** 直接说「图片端点未就绪（路由不存在）—— 重启后再试」；探针由 HEAD 改 **GET**（HEAD 没有响应体，读不到 `code`，200 时取消 body）；`rawUrl` 改为**省略未知 root**（与 `withRoot` 一致，不再依赖 `requestRoot` 对 `''` 的宽容）
  - 验证：`npm test` → **186/186** ✅（新增「无 `code` 的 404 ≠ 有 `code` 的 404」一例）；`npm run typecheck` 干净 ✅；`npm run build` ✅（`lib/client.js` 111.4kb）

- [x] T4.3 文档回写 —— **完成 ✅（本轮范围内）**
  - 内容：README 冻结决策与实测数字、tasks 勾选、`specs/002` 若有联动一并记
  - 验证：`npm test` / `npm run typecheck` / `npm run build` 三绿 ✅
    - `npm run typecheck` → 干净（无输出）
    - `npm test` → tests **185** / pass **185** / fail **0**（基线 143 全绿，新增 42）
    - `npm run build` → `lib/index.js` **12,522 B**、`lib/client.js` **113,045 B**
  - 说明：回写的是 `specs/008-image-file-preview/README.md` 与 `tasks.md`；仓库根 `README.md` 的「功能章节 / 版本历史」未改（本轮范围未含），已记入交付报告待办；`specs/002` 无联动改动
