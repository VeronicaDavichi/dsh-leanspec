---
status: in-progress
priority: low
tags: [demo, status-badge]
created: 2026-10-08
---

# 状态标签演示：in-progress（临时文件）

> ⚠️ **这是临时验收夹具，不是真 Spec。**
> 目的是验证「frontmatter 优先于正文」这条规则在界面上真的成立（验收标准 A2）。
> 验收完成后请直接删除整个 `specs/004-status-demo-wip/` 目录。

本文档**故意让两处状态互相矛盾**：

- frontmatter：`status: in-progress`
- 正文：**状态**: draft

预期面板效果：琥珀色标签 `WIP`（frontmatter 赢）。
**如果显示的是水青色 `draft`，说明优先级实现错了**，请立刻告诉我。
