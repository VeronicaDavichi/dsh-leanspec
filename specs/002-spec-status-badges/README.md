---
status: draft
priority: medium
tags: [viewer, ui, status]
created: 2026-10-08
---

# Spec 列表状态标签

**类型**: 设计驱动（design-first）
**状态**: draft
**优先级**: medium
**创建日期**: 2026-10-08

---

## 概述

LeanSpec 预览面板左侧的文件树里，spec 目录行目前只有折叠箭头和目录名 —— **状态完全不可见**，必须点开 README 读正文才知道某个 spec 是在写、在做、还是已归档。

本 Spec 在 spec 目录行的折叠箭头之后加一个**实心小标签**，用五种可区分的颜色显示状态简称，让"哪些在进行、哪些已完成、哪些已归档"扫一眼就能看出来。

```
折叠   ▸ [done]  001-markdown-table-rendering-fix
展开   ▾ [WIP]   002-spec-status-badges
         └─ 箭头保留（最弱色；2026-10-08 按反馈把小三角换成大三角字形并定档 8px，墨迹 4×3 → 8×8，行高 28px 不变；同批修左对齐：树内边距 8→6px + 三角左对齐，标题/三角/顶层文件名统一到 x=14）；2026-10-08 再修标签列错位：名字缺 flex/min-width，长名字不肯收缩，flex 把亏空摊到唯一可缩的三角上（14→10.1px），标签整列左移最多 3px；改为三角 flex 0 0 14px 锁死 + 名字 flex 1 1 0 / min-width 0 由省略号承担收缩，回归测试见 test/styles.test.ts），标签成为视觉锚点
```

---

## 文档导航

| 文档 | 内容 |
|------|------|
| [design.md](./design.md) | 技术设计：数据链路、解析规则、配色系统、渲染与测试策略 |
| [requirements.md](./requirements.md) | 从设计反推的功能需求（REQ-1..6）与 EARS 验收标准 |
| [tasks.md](./tasks.md) | 按层拆分的实现任务与验证方法 |
| [assets/design-references/](./assets/design-references/) | 配色决策过程稿（成稿色板 / 档位梯 / 候选对比） |

---

## 冻结决策速览

| 决策点 | 结论 | 理由摘要 |
|--------|------|----------|
| 标签位置 | 折叠箭头**之后**，箭头保留 | 箭头是唯一的展开态信号，删掉则展开/折叠不可见 |
| 标签形态 | 五个**实心同形** | 用户明确要求，靠色相 + 标签文字区分 |
| 标签文案 | `draft` / `plan.` / `WIP` / `done` / `arch.` | 面板最窄 220px，缩写省宽度；文字是色彩失效时的兜底线索 |
| 状态取源 | frontmatter `status:` 优先，正文 `**状态**:` 兜底 | 兼容规范写法与仓库现状（001 只有正文行） |
| 取源位置 | **服务端**（`/tree` 时读 README 头部） | 一次请求、单一解析逻辑、可单测；避免 N+1 请求与客户端重复解析 |
| 配色实现 | 只用 `--dsw-*` token + `color-mix()`，**零 hex** | 仓库样式测试禁止硬编码 hex；token 保证主题一致 |
| 交互 | 标签是 `<span>`，点击等同点整行 | 切换状态需写 frontmatter，工作量与风险翻倍，另开 Spec |
| 无状态行 | 显示**无底色**的 `-` 占位 | 用户 2026-10-08 目视后要求，避免该行看起来"缺一块"；第六种实心色必与五色撞车，故不加底色 |
| 标签宽度 | 六个标签**等宽 42px**（含 `-`） | 用户 2026-10-08 追加要求；实测宿主字体下最宽文案是 `done` = 25.47px（不是 `draft`），42px 留出 30px 内容区，各 Spec 名称因此在竖向对齐 |

配色表（详见 design.md 第 5 节）：

| 状态 | 标签 | 色源 | 灰度 | 对比度 |
|------|------|------|------|--------|
| draft | `draft` | `color-mix(blue-400 44%, green-400 56%)` | 157.9 | 8.48 |
| planned | `plan.` | `color-mix(deepseek-500 60%, blue-500 40%)` | 117.9 | 4.73 |
| in-progress | `WIP` | `--dsw-static-amber-400` | 181.0 | 9.88 |
| complete | `done` | `--dsw-static-green-500` | 136.5 | 8.29 |
| archived | `arch.` | `--dsw-static-neutral-bluish-300` | 210.1 | 12.55 |

> 五色灰度两两间距 ≥15 级（实测最小 **18.58**），对比度全部 ≥4.5:1（WCAG AA，实测最低 **4.73**）。
>
> planned 初稿用的是 `--dsw-static-blue-500`（灰度 122，与 complete 只差 **14.53**，未达标），实现阶段被测试抓出后改为 60/40 混色 —— 详见 design.md §5.1 勘误。
>
> **无状态行的 `-` 不占色板**：无底色 + **1px 同色描边**，文字用 `--dsw-alias-label-tertiary`（亮 `#81858c` 3.71:1 / 暗 `#adb2b8` 8.54:1）。因为它没有底色，压在面板背景上，所以**必须**用会随主题翻转的 alias token；描边用 `currentColor`（等于文字色），并靠 `padding: 0 5px` 补偿边框，保证行高不变 —— 详见 design.md §5.5。

---

## 前置发现的仓库问题（不在本 Spec 范围，但阻塞工具链）

1. ~~**`specs/001-.../README.md` 缺 frontmatter** → `leanspec list` 抛 `Parse error: No frontmatter found`~~ → **2026-10-08 已修复**（补 4 行 frontmatter，正文未动）。修复后 CLI 报出的下一个阻塞是 `specs/006-status-demo-none/README.md: Missing required field: status` —— 该夹具为验证 `-` 占位而**故意**不带 status，用户裁定暂不处理，故 CLI / MCP 仍返回 0 个 spec。
2. **`.lean-spec/templates/` 缺 `spec-template.md`** → `leanspec create` 报 `Failed to load template`，只能用 `mkdir` 手工建目录。

两项均为探索阶段的额外发现，**已记录、未擅自修复**，详见 design.md「已知阻塞」。

---

## 硬规则偏离说明

本 Spec 由 `leanspec-propose` 流程生成。其中若干硬规则因仓库现状无法原样满足，**显式记录而非静默跳过**：

| 硬规则 | 状态 | 说明 |
|--------|------|------|
| 读取 `.lean-spec/templates/design-first-*.md` 模板 | ❌ 模板不存在 | 文档结构改按 propose 技能文档正文生成（模板库仅有 `bugfix-template.md`） |
| `docs/` 全量扫描并提炼摘要 | ⚠️ N/A | 本仓库无 `docs/` 目录；requirements.md 第 0 节已显式标注「（空）」 |
| UI 需求必须配 E2E | ⚠️ 用户裁定豁免 | 2026-10-08 用户指示「测试的问题我来，肉眼看」→ 自动化 E2E **豁免**，替代为组件级渲染断言（T3.3）+ 人工目视清单（T-E1 / T4.3）。依 propose 硬规则，`leanspec-apply` 可能因此拒绝开工，豁免依据见 tasks.md Phase 0 |
| 原型资产归档 | ✅ 部分适用 | 用户未提供原型；已将探索阶段生成的 3 张色板图归档到 `assets/design-references/` |
| 复核制两阶段提交 | ⚠️ N/A | 本 Spec 无审批/复核语义 |
| 原型字段级还原 / 交互控件登记 | ⚠️ 缩尺度适用 | 无表格页面；交互控件清单已按本 Spec 实际控件（箭头、标签）登记 |
