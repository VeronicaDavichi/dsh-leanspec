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
- 保存成功以 Host 写盘确认为准
- 不创建、删除或重命名 Spec 目录，不调用 `lean-spec` CLI

配色跟随 Harness Web UI 主题（含明暗切换）。

针对 DeepSeek Harness **0.1.0-rc.5** 的 Web profile。其他版本请自行核对扩展点是否仍可用。

---

## 📦 安装到自己的 DeepSeek Harness Web UI

需要本机已能运行 `dsh`，并且使用 **web** profile（`dsh web` 或 `dsh --profile web`）。

### 源码安装

先把仓库克隆到本地：

```sh
git clone https://github.com/wx971025/dsh-leanspec.git
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
dsh plugin --profile web add github:wx971025/dsh-leanspec#v0.2.0
```

等价写法：

```sh
dsh plugin --profile web add git+https://github.com/wx971025/dsh-leanspec.git#v0.2.0
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

### v0.2.0 (2026-09-17)

- ✅ 从 OpenSpec 迁移到 LeanSpec 目录逻辑
- ✅ 修复 Markdown 表格渲染问题（引入 `marked` 库）
- ✅ 代码优化：Markdown 解析器从 64 行精简到 22 行

### v0.1.0 (基于 dsh-openspec)

- 🎉 初始版本，基于 `dsh-openspec` 改造

---

## 📄 许可证

MIT License
