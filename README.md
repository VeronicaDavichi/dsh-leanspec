# dsh-leanspec

DeepSeek Harness Web UI 插件：在会话标题栏打开当前项目的 `specs/` 目录，浏览、预览、编辑并保存 LeanSpec 格式的 Spec 文件。

---

## 🙏 致谢

**本项目基于 [dsh-openspec](https://github.com/wx971025/dsh-openspec) 改造而来。**

特别感谢原作者 `wx971025` 提供的优秀基础实现！原项目的 `dsh-openspec` 为 OpenSpec 格式的 Spec 文件浏览提供了完整的解决方案，本鱼在此基础上进行了以下改进：

- ✅ **从 OpenSpec 迁移到 LeanSpec**：目录逻辑从 `specs/` 改为 LeanSpec 标准格式
- ✅ **修复 Markdown 表格渲染问题**：引入 `marked` 库，支持 GFM 表格、代码块、引用等完整 Markdown 特性
- ✅ **代码精简优化**：Markdown 解析器从 64 行手写代码精简到 22 行（使用成熟的 `marked` 库）

没有原作者的优秀基础，本鱼不可能这么快完成这些改进！再次感谢！💙🐳

---

## 它做什么

安装后，Web UI 会话标题栏 **Session log** 旁会出现 **LeanSpec** 按钮。点击弹出面板：

- 跟随当前会话的工作区（或会话目录），**不用再配置项目路径**
- 项目里有 `specs/`：列出所有 LeanSpec Spec 目录（`NNN-name` 格式，如 `001-user-authentication/`）
- 没有 `specs/`：提示「当前项目没有 LeanSpec (specs/ 目录不存在)」
- `.md` 依赖 [`marked`](https://github.com/markedjs/marked) 模块的渲染功能（支持标题、列表、表格、代码块、引用等 GFM 特性），其他文本按源码预览，都可以编辑保存
- **双形态面板**：视口宽裕（≥1088 × ≥712）时是 1040×640 弹窗；局促时**直接开在宿主右栏标签页**（与 Preview / Review 同类）；弹窗里可点目录栏标题行的「右栏 ⧉」手动切过去，标签已开着时按钮只**聚焦**它
- **目录 / 正文之间的分隔条可拖**（180–420px，正文始终 ≥360px），比例按项目记在 `localStorage`
- **图片文件直接渲染**（png / jpg / gif / webp / bmp / avif / ico / svg），Markdown 里的相对路径图片也能显示；图片不给编辑（编辑按钮置灰）
- Spec 文件开头的 **YAML frontmatter 不进入预览**：`marked` 不认识它，会把两条 `---` 渲染成横线、把 `status: draft` 渲染成二级标题；预览前先剥离，编辑区仍显示原文件
- 保存成功以 Host 写盘确认为准
- 不创建、删除或重命名 Spec 目录，不调用 `lean-spec` CLI

配色跟随 Harness Web UI 主题（含明暗切换）。

针对 DeepSeek Harness **0.1.7-rc.2** 的 Web profile。其他版本请自行核对扩展点是否仍可用。

---

## 🪟 双形态面板 + 可拖拽分栏

同一个面板、**同一份状态**（选中文件、预览/编辑模式、未保存草稿、分栏比例、目录展开层级），两个外壳：

| | 弹窗 | 右栏标签 |
|---|---|---|
| 何时出现 | 视口宽裕（≥1088 且 ≥712）| 视口局促，或用户在弹窗里点「右栏 ⧉」|
| 尺寸 | `1040 × 640`（另有 `min()` 视口上限，**绝不越界**）| 填满宿主给的分栏 |
| 切换入口 | 目录栏标题行的「右栏 ⧉」（**单向**）| **无**（关闭交给宿主 **×**）|
| 关闭 | 再点页眉按钮 / `Esc` / 点外面 | 宿主标签的 **×** |

- **判定是实时的**：`resize` 经 150ms 节流后重新判定，结论**变化**才切形态；**拖分隔条期间推迟**到拖动结束；手动切过一次会**钉住**，直到面板关闭 / 重开
- **单向**：只有「弹窗 → 标签」有手动入口；插件**从不主动关闭**宿主标签 —— 那等于替你关东西
- **切换入口就长在目录栏标题行上**：与「LeanSpec」同排、贴着目录栏右边缘（而不是顶在面板上方的整条工具栏）；按钮文案精简为 **「右栏 ⧉」**，整句留在悬浮提示与无障碍名（`aria-label`）里，且**最窄 180px 也不换行** —— 标题先让位，按钮不缩
- **为什么是 1088 / 712**：`1040 + 2×24` 与 `640 + 48 + 24`。这两个数是**舒适阈值不是安全属性**：CSS 自带 `min(1040px, calc(100vw - 48px))` 与 `min(640px, calc(100vh - var(--anchor, 48px) - 24px))` 上限，所以锚点再高也只是矮几像素、不会越界。推导与量测见 [`specs/007-dual-surface-and-draggable-split/`](specs/007-dual-surface-and-draggable-split/README.md)
- **右栏标签是宿主提供的座位**（`sidebar.right.pane.tab` + `ctx.sidebarRight.openTab`）：宿主版本不给时自动**退回纯弹窗**，按钮置灰并写明原因，**绝不会白屏**；那行「原因 / 失败」提示**只在有事时出现**，平时不占一条空位
- **拖拽**：目录 180–420px、正文始终 ≥360px；双击分隔条复位 280px；键盘 `←`/`→` 每次 16px（`role="separator"` 可达）
- **切形态不丢东西**：选中文件 / 草稿 / 分栏比例 / **目录展开层级**都住在共享 store；`/tree` 重拉是后台刷新，不清屏

---

## 🏷️ Spec 状态标签

树里每个 Spec 目录行会在名称前显示一个彩色小标签，一眼看出进度：

| 标签 | 对应状态 | 颜色 |
|------|----------|------|
| `draft` | `draft` | 水青色 |
| `plan.` | `planned` | 蓝色 |
| `WIP` | `in-progress` | 琥珀色 |
| `done` | `complete` | 绿色 |
| `arch.` | `archived` | 灰色 |
| `-` | 读不出状态（缺字段 / 空值 / 不认识的值） | 淡灰色文字 + **同色描边**，无底色 |

**状态从哪里读**（按优先级）：

1. README 的 YAML frontmatter：`status: in-progress`
2. 没有可用 frontmatter 时，回落到正文的 `**状态**: complete` 行（兼容早期写法，全角 `：` 与半角 `:` 都认）

写法很宽松：大小写不限、值可用引号包起来、前后空格无所谓；`wip` → `in-progress`、`done` → `complete`、`arch` / `archive` → `archived` 这些简写也认。**读不出或不认识的状态会显示一个淡灰色、没有底色的 `-` 占位标签**，绝不把原始文本渲染出来。

**几点说明**：

- **只读**，不改动任何文件；标签不能点击切换状态（点标签等于点整行，用于展开/折叠）
- 只有 `NNN-name` 形式的顶层 Spec 目录有标签，`docs/` 这类子目录没有
- 六个标签（含 `-`）**等宽 42px**，宽度固定，所以各 Spec 的名称在竖向上是对齐的
- 状态只读 README 的**头部 2KB**，所以状态字段请放在文件靠前的位置
- 在面板里编辑并保存某个 Spec 的 README 后，标签**立即更新**，不需要刷新页面
- 五个状态标签的底色取自 Harness 静态色板、文字固定深色，明暗两种主题下对比度均 ≥4.5:1
- `-` 没有底色（第六种实心色会与上面五色撞车），靠一圈**与文字同色的描边**勾勒形状，所以它看起来仍是个完整的小标签，而不是一根孤零零的短横
- `-` 的文字用跟随明暗主题的三级文字色：亮色 3.71:1、暗色 8.54:1 —— 亮色下刻意压淡，因为一条短横表示"这里没有状态"（描边本身满足 WCAG 对界面边界的 3:1）

---

## 📦 安装到自己的 DeepSeek Harness Web UI

需要本机已能运行 `dsh`，并且使用 **web** profile（`dsh web` 或 `dsh --profile web`）。

### 源码安装

先把仓库克隆到本地：

```sh
git clone https://github.com/VeronicaDavichi/dsh-leanspec.git
cd dsh-leanspec
```

再用本仓库的绝对路径装进 web profile：

```sh
dsh plugin --profile web add /absolute/path/to/dsh-leanspec
```

这是本地 `link:` 安装：profile 会指向这个目录，**目录要一直留着**，删掉或挪走后插件会加载失败。

### Git 安装

不克隆到本地，直接让 profile 从 GitHub 拉取：

```sh
dsh plugin --profile web add github:VeronicaDavichi/dsh-leanspec#v0.2.0
```

等价写法：

```sh
dsh plugin --profile web add git+https://github.com/VeronicaDavichi/dsh-leanspec.git#v0.2.0
```

pnpm 10 可能要求允许该包的构建脚本。若安装时提示 blocked，按终端说明把对应 key 写入 profile 的 `pnpm-workspace.yaml` 的 `allowBuilds`，再执行一次上面的 `dsh plugin add`。

### 启动

```sh
dsh web
```

浏览器打开 Harness Web（默认 `http://127.0.0.1:3080`）。打开一个**已经绑定了项目目录**的会话，点标题栏 **LeanSpec**。

该项目根目录下有 `specs/` 就会列出 Spec 目录（`NNN-name` 格式）；没有则提示没有 LeanSpec。

确认是否装上：

```sh
dsh --profile web --dump-config
```

输出里应能看到 `dsh-leanspec`。

---

## 🗑️ 卸载

```sh
dsh plugin --profile web remove dsh-leanspec
```

卸载后按钮和 `/leanspec-viewer` 接口会消失。磁盘上的 `specs/` 文件不会被删。

---

## 📝 版本历史

### v0.2.0 (2026-10-08)

> 版本号与 DeepSeek Harness **同步**；此前的 `0.2.1` / `0.2.0` / `0.1.0` 记录已并入本条，不再单列。

**面板与形态**

- ✅ **双形态面板**：窄窗口自动开在宿主**右栏标签页**，宽裕时用 1040×640 弹窗；二者共享状态、实时跟随、手动可钉住（[specs/007](specs/007-dual-surface-and-draggable-split/README.md)）
- ✅ **可拖拽分栏**：目录 / 正文分隔条 180–420px，比例按项目记忆，键盘可达
- ✅ **切形态不丢会话状态**：目录展开层级进共享 store；重挂载不再重拉 `/file` 覆盖未保存草稿
- ✅ **验收后微调（2026-10-08）**：切换入口搬到**目录栏标题行右侧**、与「LeanSpec」同排，文案精简为「右栏 ⧉」（全句留在悬浮提示与无障碍名），**最窄 180px 也不换行**；「原因 / 失败」提示行改为**按需出现**，不再常驻一条空条

**文件预览**

- ✅ **图片预览**：图片文件直接渲染，Markdown 相对路径图片也能显示（新增 `/leanspec-viewer/raw`：白名单 + 固定 MIME + 20MB 上限 + `nosniff`，SVG 只经 `<img>` 渲染；[specs/008](specs/008-image-file-preview/README.md)）
- ✅ 修复 Markdown 表格渲染问题（引入 [`marked`](https://github.com/markedjs/marked) 库）
- ✅ 代码优化：Markdown 解析器从 64 行精简到 22 行

**基础**

- ✅ 从 OpenSpec 迁移到 LeanSpec 目录逻辑
- ✅ 适配 DeepSeek Harness **0.1.7-rc.2**
- 🎉 初始版本，基于 [`dsh-openspec`](https://github.com/wx971025/dsh-openspec) 改造

---

## 📄 许可证

MIT License
