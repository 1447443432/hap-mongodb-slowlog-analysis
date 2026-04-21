---
name: hap-mongodb-slowlog-analysis
description: Analyze MongoDB 4.4.x slow logs from pasted slow-log text, uploaded log files, or mongodb.log content and produce practical query optimization advice, index recommendations, evidence-backed reasoning, and ready-to-run Mongo shell index commands. The skill is AI-first and should analyze logs directly in conversation without relying on local scripts or PowerShell. It should group repeated entries by namespace (ns), deduplicate repeated query shapes, and summarize repeated patterns before giving advice. Prefer Chinese output by default, but support English when requested. Treat ctime as already indexed and never recommend a new index on it. Treat status as a low-cardinality field with only 1 and 9, where 1 means active/in-use, and do not include status in recommended index definitions. IMPORTANT: Never use local scripts or PowerShell commands. Always analyze directly with AI. Only use fields that actually exist in the logs.
---

# MongoDB Slowlog Analysis

## 核心原则（必须遵守）

### 🚫 禁止使用本地脚本

**本 skill 绝对不允许使用本地脚本（包括 PowerShell、Python 脚本等）作为分析入口。**

- ❌ 禁止运行 `extract-slowlog-signals.ps1`
- ❌ 禁止运行 `generate-slowlog-report.ps1`
- ❌ 禁止使用 `execute_command` 解析日志
- ❌ 禁止使用 Python/Shell 脚本做统计分析

- ✅ 直接用 AI 读取和解析日志内容
- ✅ 直接用 AI 生成分析结论
- ✅ 直接用 AI 生成 Markdown/HTML 报告
- ✅ 仅在用户明确要求落地文件时，才由 AI 生成内容后写入文件

### ✅ 分类去重规则

**批量日志分析时，必须按以下规则处理：**

1. **按库表（ns）分组**
   - 格式：`{数据库名}.{集合名}`
   - 例如：`mdwsrows.ws64c7525be67c752002c28e76`
   - 同一集合的所有慢查询必须归入同一分组

2. **按查询形态去重**
   - 忽略具体常量值，提取字段结构和操作符结构
   - 同一分组的查询，如果 filter 字段结构相同，则视为同一查询形态
   - 每组统计：出现次数、最慢耗时、平均耗时

3. **排序规则**
   - **排序维度选项**：
     - `max_duration`：最慢耗时降序（**默认值**）
     - `count`：出现次数降序
     - `avg_duration`：平均耗时降序
   - 用户未指定时，默认按 **最慢耗时降序** 排列
   - 输出的分组顺序 = 慢查询严重程度顺序
   - **库表标题使用 h3 标签**（比文档标题 h2 低一级）

### ✅ 字段真实性规则

**只使用日志中实际存在的字段，绝对不虚构字段。**

- 索引建议中的字段必须出现在日志的 filter、sort、pipeline 中
- 不要建议使用"假设的"、"可能的"、"常见的"字段
- 如果某字段在日志中没有出现，不允许出现在索引建议中
- projection 中的字段可以用于分析，但不纳入索引建议

**排除字段（明确禁止用于索引建议）：**
- `ctime` - 已存在索引
- `status` - 低基数字段

### ✅ 输出文件命名规则

**HTML 报告文件命名必须严格遵循以下格式：**

```
{日志文件名全称}-slowlog-report-{YYYYMMDDHHmmss}.html
```

示例：
- 源文件：`mongodb.log` → `mongodb.log-slowlog-report-20260410143000.html`
- 源文件：`slowquery-2026-03-30.log` → `slowquery-2026-03-30.log-slowlog-report-20260410143000.html`

**规则说明：**
- 精度到秒（YYYYMMDDHHmmss）
- 使用下划线连接日志名和报告标识
- 文件保存在与日志相同的目录，或用户指定的工作目录

## Workflow

### 输入处理

接受三类输入：
1. 用户直接粘贴的慢日志文本（JSONL 格式）
2. 用户上传的 `mongodb.log`、`.log`、`.txt`、`.jsonl` 等文件
3. 日志文件路径

**处理流程：**

1. **解析日志**（纯 AI 完成）
   - 逐条解析 JSONL 行
   - 提取关键字段：ns、durationMillis、planSummary、keysExamined、docsExamined、nreturned、command、aggregate pipeline

2. **分组去重**（纯 AI 完成）
   - 按 ns（库.集合）分组
   - 每组内按查询形态去重
   - 计算统计数据

3. **排序输出**（纯 AI 完成）
   - 按最慢耗时降序排列各分组
   - 每个分组内按耗时降序排列各查询形态

4. **生成报告**（纯 AI 完成）
   - 摘要
   - 归类与去重摘要（按库表）
   - 各库表详情（按耗时排序）
   - 索引建议
   - 参考文档
   - **免责声明（文档最后）**

### Aggregate 管道分析规则

**必须从日志中直接提取完整 pipeline 信息：**

1. **提取位置**：`attr.command.aggregate` 字段
2. **分析要点**：
   - 首段是否为 `$match`，过滤效果如何
   - 后续各阶段的用途
   - 是否存在可优化的阶段

**对于 aggregate 查询的索引建议规则：**

- 如果 pipeline 首段是 `$match` 且过滤效果好 → 可建议创建索引
- 如果 pipeline 首段不是 `$match` → 建议业务侧优化 pipeline 结构，而非直接建索引
- **绝对不要说"需要先分析业务需求"，应直接分析日志中已有的 pipeline 结构**

**示例输出：**

```markdown
### 管道结构分析

| 阶段 | 操作 | 说明 |
:|------|------|------|
| $match | { "task_id": "xxx", "action": "xxx" } | 无过滤效果，匹配全表 |
| $group | { _id: "$user_id", count: { $sum: 1 } } | 统计计数 |
| $sort | { count: -1 } | 排序 |

**优化建议：**
- 建议在 pipeline 首段增加时间范围过滤，减少扫描量
- 当前 scan ratio = 930000/36，建议增加 $match 条件
```

### 查询形态去重标准

去重时忽略具体值，识别以下结构特征：
- `operation`：`find` 或 `aggregate`
- `filter` 字段名集合
- `filter` 操作符结构（如 `$or`、`$gt`、`$ne` 等）
- `sort` 字段
- `projection` 字段（用于分析，不参与去重）
- `limit` 值
- `pipeline` 阶段结构（aggregate 专用）
- `planSummary` 索引使用情况

## Output Structure

### 摘要 / Summary

```markdown
## 📊 统计摘要

| 指标 | 数值 |
:|------|------|
| 慢查询总数 | X 条 |
| 涉及库表数 | X 个 |
| 涉及集合数 | X 个 |
| 平均执行时间 | Xms |
| 最长执行时间 | Xms |
```

### 归类与去重摘要 / Grouping Summary

**按库表分组，每表统计：**
- 集合名称
- 出现次数
- 最慢耗时
- 平均耗时
- 查询形态数量

**表格按用户指定维度降序排列（默认：最慢耗时）。**

### 库表详情 / Collection Details

每个库表分组下包含：

#### 1. 分组概览
```markdown
### {数据库名}.{集合名}

| 项目 | 值 |
|------|-----|
| 出现次数 | X |
| 最慢耗时 | Xms |
| 平均耗时 | Xms |
| 查询形态数 | X |
| 风险等级 | 严重/警告/普通 |
```

**注意：库表标题使用 h3（如 `### {数据库名}.{集合名}`），比文档 h2 标题低一级。**

#### 2. 查询形态详情（按耗时降序）

每个查询形态包含：

**形态特征：**
```markdown
#### 形态 {N}：{特征描述}

- **出现次数：** X
- **最慢耗时：** Xms
- **平均耗时：** Xms
- **执行计划：** IXSCAN { xxx }
- **风险等级：** ⚠️严重 / ⚡警告 / ✅普通
```

**代表性样本 / Representative Sample：**
```json
{
  "filter": { /* 实际字段 */ },
  "sort": { /* 实际字段 */ },
  "projection": { /* 实际字段 */ },
  "limit": X
}
```

**证据 / Evidence：**
```markdown
- keysExamined: X
- docsExamined: X
- nreturned: X
- durationMillis: X
```

**为什么慢 / Why It Is Slow：**
- 基于实际日志内容分析
- 指出具体的索引使用情况和问题

**索引建议 / Index Advice：**
- **仅使用日志中实际出现的字段**
- 字段顺序：等值过滤 > 范围过滤 > 排序

**索引创建命令 / Index Commands：**

模板1（可直接执行）：
```javascript
use {数据库名}
db.getCollection("{集合名}").createIndex(
    {字段结构},
    {background: true}
)
```

模板2（暂不建议执行）：
```markdown
当前不建议直接执行 createIndex，原因：
- ...
```

**Aggregate 管道分析（如适用）：**
```markdown
### 管道结构分析

| 阶段 | 操作 | 说明 |
:|------|------|------|
| $match | { ... } | 过滤条件分析 |
| $group | { ... } | 聚合操作 |
| $sort | { ... } | 排序 |

**优化建议：**
- 基于实际 pipeline 结构的优化建议
```

**改写后候选索引 / Post-Rewrite Candidate Indexes：**
（如适用，在"暂不建议"的情况下给出）

## Index Recommendation Rules

### 字段选择规则

**必须使用的字段（实际存在于日志中）：**
- filter 中的等值字段（精确匹配）
- filter 中的范围字段（$gt、$gte、$lt、$lte）
- sort 中的排序字段
- pipeline 首段 $match 中的字段（aggregate）

**禁止使用的字段：**
- `ctime` - 已存在索引
- `status` - 低基数字段，不纳入索引定义
- 日志中未出现的字段 - 绝对禁止虚构

### 字段顺序规则

复合索引字段顺序：
1. **等值/精确匹配字段** → 最前
2. **范围字段（$gt、$gte 等）** → 中间
3. **排序字段** → 最后

### 场景判断规则

**可直接建索引的场景：**
- 等值过滤 + 排序
- 范围过滤 + 排序
- 多字段等值过滤 + 排序

**暂不建议直接建索引的场景：**
- `$ne`、`$nin`、`$not`、`$size` 等负向条件主导
- `$regex` 模糊匹配
- `$or` 不同分支使用不同字段
- aggregate 首段 $match 不存在或过滤效果差

## HTML Report Rules

如果用户要求生成 HTML 报告：

### 必需元素

1. **目录导航**
   - 桌面端：左侧固定目录
   - 移动端：顶部可折叠目录
   - 支持点击跳转

2. **库表分类展示**
   - 按库表分组
   - 每组内按耗时降序
   - 可折叠/展开

3. **代码块复制功能**
   - 索引命令代码块带复制按钮

4. **查询详情可展开**（重要！）
   - Top N 最慢查询支持点击展开
   - 展开内容必须包含：
     - 完整查询命令 JSON（带语法高亮）
     - 查询条件字段标签
     - 排序条件
     - 限制数量（如有）
     - 聚合管道阶段（如有 aggregate）
     - 扫描统计（keysExamined, docsExamined, nreturned）
     - **查询效率指标**（可视化进度条）

5. **查询效率分析**
   - 计算公式：`效率 = nreturned / docsExamined * 100%`
   - 分类展示：
     - 🟢 良好 (>50%): 绿色
     - 🟡 中等 (10-50%): 黄色
     - 🔴 差 (<10% 或零结果): 红色

### 详细查询结构规范

```html
<!-- 单个查询详情 - 可折叠 -->
<div class="query-detail">
    <div class="detail-header" onclick="toggleDetail('detail-{id}')">
        <div class="detail-title">
            #{序号} <span class="duration {high|medium|low}">{duration} ms</span>
            <span class="badge">{namespace}</span>
            <span class="badge">{operation}</span>
            <!-- 问题标签 -->
            <span class="tag danger">COLLSCAN</span>
            <span class="tag warning">$regex</span>
        </div>
        <button class="expand-btn">查看详情 ▼</button>
    </div>
    <div class="detail-content" id="detail-{id}">
        <!-- 执行时间、命名空间、执行计划 -->
        <div class="detail-row">
            <div class="detail-label">执行计划</div>
            <div class="detail-value"><span class="plan {collscan}">{planSummary}</span></div>
        </div>
        
        <!-- 查询条件字段（标签形式） -->
        <div class="detail-row">
            <div class="detail-label">查询字段</div>
            <div class="detail-value">
                <div class="filter-tags">
                    <span class="filter-tag">{field1}</span>
                    <span class="filter-tag">{field2}</span>
                </div>
            </div>
        </div>
        
        <!-- 扫描统计 + 效率条 -->
        <div class="detail-row">
            <div class="detail-label">查询效率</div>
            <div class="detail-value">
                {efficiency}%
                <div class="efficiency-bar">
                    <div class="efficiency-fill {good|medium|bad}" style="width: {efficiency}%;"></div>
                </div>
            </div>
        </div>
        
        <!-- 完整命令 JSON（代码块） -->
        <div class="detail-row">
            <div class="detail-label">完整命令</div>
            <div class="detail-value">
                <div class="code-block"><pre>{command_json}</pre></div>
            </div>
        </div>
    </div>
</div>
```

### 结构要求

```html
<!-- 目录 -->
<nav class="toc">
  <a href="#summary">统计摘要</a>
  <a href="#grouping">库表分类</a>
  <a href="#collection-{id}">{库.集合}</a>
  ...
</nav>

<!-- 统计摘要 -->
<section id="summary">...</section>

<!-- 库表分类（按用户指定维度排序） -->
<section id="grouping">
  <h2>库表分类（按{维度}降序）</h2>
  <div class="collection-card" id="collection-{id}">
    <h3>{数据库名}.{集合名}</h3>
    <!-- 查询形态详情 -->
  </div>
</section>
```

**注意：**
- 库表分类标题使用 `<h2>`，如 `<h2>库表分类（按耗时降序）</h2>`
- 每个库表项使用 `<h3>`，如 `<h3>{数据库名}.{集合名}</h3>`
- 排序维度根据用户指定变化（最慢耗时/次数/平均耗时）

### 样式规范

```css
/* 效率条 */
.efficiency-bar { 
    height: 8px; 
    background: #e0e0e0; 
    border-radius: 4px; 
    overflow: hidden; 
    margin-top: 5px; 
}
.efficiency-fill { height: 100%; border-radius: 4px; }
.efficiency-fill.good { background: #28a745; }
.efficiency-fill.medium { background: #ffc107; }
.efficiency-fill.bad { background: #dc3545; }

/* 查询字段标签 */
.filter-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.filter-tag { 
    background: #e3f2fd; 
    color: #1565c0; 
    padding: 2px 8px; 
    border-radius: 4px; 
    font-size: 11px; 
}

/* 代码块 */
.code-block { 
    background: #2d2d2d; 
    color: #f8f8f2; 
    padding: 15px; 
    border-radius: 6px; 
    overflow-x: auto; 
    font-size: 12px; 
}
.code-block pre { 
    white-space: pre-wrap; 
    word-wrap: break-word; 
    margin: 0; 
}
```

<!-- 文档末尾：免责声明 -->
<footer class="disclaimer">
  ⚠️ 声明：内容由 AI 生成。尽管已努力确保信息的合理性，但 AI 模型仍可能产生不准确、过时或存在偏差的内容。请在执行关键操作前，务必对照 <a href="https://docs-pd.mingdao.com/deployment/components/mongodb/slowQueryOptimization">官方文档</a> 进行核实校验。
</footer>
```

### 文件命名要求

HTML 报告文件名必须遵循：
```
{日志文件名全称}-slowlog-report-{YYYYMMDDHHmmss}.html
```

例如：`mongodb.log-slowlog-report-20260410143000.html`

## Disclaimer (免责声明)

**文档末尾必须包含以下免责声明：**

```markdown
---

## ⚠️ 免责声明

声明：内容由 AI 生成。尽管已努力确保信息的合理性，但 AI 模型仍可能产生不准确、过时或存在偏差的内容。请在执行关键操作前，务必对照 [官方文档](https://docs-pd.mingdao.com/deployment/components/mongodb/slowQueryOptimization) 进行核实校验。
```

HTML 报告中以 `<footer class="disclaimer">` 包裹。

## Examples

### 对话分析示例

```
用户：分析这个 mongodb.log，按库表分类，默认排序
助手：# MongoDB 慢查询分析报告

## 📊 统计摘要
...

## 📋 库表分类（按最慢耗时降序）

### mddatapipeline.task_usage_202603
...

### mdwsrows.ws68762c2f064bec21c8abc801
...
```

```
用户：分析这个 mongodb.log，按次数排序
助手：# MongoDB 慢查询分析报告

## 📋 库表分类（按出现次数降序）

### mdwsrows.ws64c7525be67c752002c28e76
...

### mddatapipeline.task_usage_202603
...
```

### HTML 生成示例

```
用户：生成 HTML 报告
助手：[生成完整 HTML 内容，文件名：mongodb.log-slowlog-report-20260410143000.html]
```

### 排序参数说明

| 参数 | 说明 | 默认值 |
:|------|------|--------|
| `max_duration` | 最慢耗时降序 | ✅ 是 |
| `count` | 出现次数降序 | 否 |
| `avg_duration` | 平均耗时降序 | 否 |

用户可通过以下方式指定：
- "按次数排序"
- "按平均耗时排序"
- "按最慢耗时排序"（默认）

## References

每次报告必须包含参考文档链接：

- [MongoDB 慢查询优化](https://docs-pd.mingdao.com/deployment/components/mongodb/slowQueryOptimization)
- [MongoDB Query Optimization](https://docs.mongodb.com/manual/core/query-optimization/)
- [Compound Indexes](https://docs.mongodb.com/manual/core/index-compound/)
