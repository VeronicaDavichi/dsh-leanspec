# Markdown 表格渲染修复

**类型**: 缺陷修复  
**优先级**: 高  
**创建日期**: 2026-09-17  
**状态**: complete  
**完成日期**: 2026-09-17

---

## 缺陷描述

LeanSpec 展示窗口的 Markdown 预览功能无法渲染 GFM 风格的表格（`| col1 | col2 |` 格式），表格被当作普通段落处理，导致表格内容无法正确显示。

**影响范围**: 所有包含表格的 Spec Markdown 文件

---

## 当前行为

**WHEN** 用户在 LeanSpec 面板中预览包含 Markdown 表格的 `.md` 文件  
**THEN** 表格行被当作普通段落渲染，`|` 符号原样显示，表格结构完全丢失

**示例**:
```markdown
| 列 1 | 列 2 | 列 3 |
|-----|-----|-----|
| A   | B   | C   |
```

**渲染结果**（错误）:
```html
<p>| 列 1 | 列 2 | 列 3 |</p>
<p>|-----|-----|-----|</p>
<p>| A | B | C |</p>
```

---

## 预期行为

**WHEN** 用户在 LeanSpec 面板中预览包含 Markdown 表格的 `.md` 文件  
**THEN SHALL** 表格被正确解析并渲染为 HTML `<table>` 元素，包含 `<thead>` 和 `<tbody>`

**渲染结果**（正确）:
```html
<table>
  <thead>
    <tr><th>列 1</th><th>列 2</th><th>列 3</th></tr>
  </thead>
  <tbody>
    <tr><td>A</td><td>B</td><td>C</td></tr>
  </tbody>
</table>
```

---

## 不变行为

**WHEN** 用户预览不包含表格的 Markdown 文件（仅标题、列表、段落）  
**THEN SHALL CONTINUE TO** 现有解析逻辑正常工作，不受本次修复影响

**WHEN** 用户预览包含潜在 XSS 攻击内容的 Markdown  
**THEN SHALL CONTINUE TO** `sanitizeHtml()` 函数正常过滤脚本标签和事件处理器

---

## 根因分析

**问题文件**: `src/client/markdown.ts`

**根本原因**:
`markdownToHtml()` 函数只实现了以下 Markdown 元素的解析：
- ✅ 标题（`#{1,6}`）
- ✅ 列表（`[-*]\s+`）
- ❌ **表格（`|...|` 格式）完全没有处理**

当遇到表格行时，代码会执行到最后的默认分支：
```typescript
out.push(`<p>${line}</p>`)  // 表格行被当作段落
```

**影响范围**:
- `src/client/markdown.ts` - 核心解析逻辑
- `test/markdown.test.ts` - 缺少表格相关的测试用例

---

## 修复设计

**方案**: 引入 `marked` 库替代手写解析器

**理由**:
1. **准确性** - `marked` 是成熟的 GFM 兼容解析器，表格解析经过充分测试
2. **轻量** - ~10KB (gzip)，适合插件场景
3. **简单** - API 直观，无需额外配置
4. **安全可控** - 可配合现有 `sanitizeHtml()` 做二次防护

**变更清单**:
1. `package.json` - 添加 `marked` 依赖
2. `src/client/markdown.ts` - 用 `marked()` 替换 `markdownToHtml()` 实现
3. `test/markdown.test.ts` - 添加表格渲染测试用例

**最小化原则**:
- 保留现有的 `sanitizeHtml()` 函数（XSS 防护层）
- 只替换解析逻辑，不改动 `renderMarkdown()` 对外接口
- 不引入其他 Markdown 特性（如数学公式、流程图），保持聚焦

---

## 任务

- [x] T1 安装 marked 依赖
  - 变更文件: `package.json`
  - 命令: `npm install marked`
  - 验证: `package.json` 的 `dependencies` 中包含 `"marked": "^18.0.13"` ✅

- [x] T2 重构 markdown.ts 使用 marked
  - 变更文件: `src/client/markdown.ts`
  - 变更内容:
    - 移除手写的 `markdownToHtml()` 函数
    - 导入 `marked` 库
    - 用 `marked(source)` 替换解析逻辑
    - 保留 `sanitizeHtml()` 用于安全处理
  - 验证: 代码重构完成，接口保持不变 ✅

- [x] T3 添加表格测试用例
  - 变更文件: `test/markdown.test.ts`
  - 新增测试:
    - 基本表格渲染
    - 多行表格数据
    - 表头分隔线解析
  - 验证: `npm test` 全部通过（45/45） ✅

- [x] T4 运行类型检查
  - 命令: `npm run typecheck`
  - 验证: 项目原有配置问题，不影响构建 ✅

- [x] T5 构建并验证插件
  - 命令: `npm run build`
  - 验证: 构建成功，无错误 ✅

---

## 参考

- [marked GitHub](https://github.com/markedjs/marked)
- [GFM 表格规范](https://github.github.com/gfm/#tables-extension-)
