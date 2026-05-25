import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

const REFERENCE_URL =
  "https://docs-pd.mingdao.com/deployment/components/mongodb/slowQueryOptimization";

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

function normalizeSingleEvent(parsed) {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  if (parsed.attr && parsed.attr.command) {
    return parsed;
  }

  if (parsed.aggregate || parsed.find || parsed.pipeline || parsed.filter) {
    return {
      t: parsed.t,
      attr: {
        ns:
          parsed.ns ||
          `${parsed.$db || "unknown"}.${parsed.aggregate || parsed.find || "unknown"}`,
        command: parsed
      }
    };
  }

  return null;
}

function parseInput(rawInput) {
  if (!rawInput || typeof rawInput !== "string") {
    return [];
  }

  const trimmed = rawInput.trim();
  if (!trimmed) {
    return [];
  }

  const whole = safeJsonParse(trimmed);
  if (whole) {
    const single = normalizeSingleEvent(whole);
    return single ? [single] : [];
  }

  return trimmed
    .split(/\r?\n/)
    .map((line) => safeJsonParse(line.trim()))
    .map(normalizeSingleEvent)
    .filter(Boolean);
}

function getOperation(command) {
  if (command.aggregate) {
    return "aggregate";
  }
  if (command.find) {
    return "find";
  }
  return "unknown";
}

function extractQueryShape(command) {
  if (command.aggregate) {
    return {
      operation: "aggregate",
      pipeline: command.pipeline || []
    };
  }

  return {
    operation: getOperation(command),
    filter: command.filter || {},
    sort: command.sort || {},
    projection: command.projection || {},
    limit: command.limit
  };
}

function walk(value, visitor, path = []) {
  visitor(value, path);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visitor, [...path, index]));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, child]) => walk(child, visitor, [...path, key]));
  }
}

function collectSignals(command) {
  const payload = {
    filter: command.filter || {},
    pipeline: command.pipeline || []
  };
  const json = JSON.stringify(payload);
  const emptyCheckFields = new Set();
  const equalityFields = new Set();
  const rangeFields = new Set();
  const operatorFields = new Map();

  walk(payload, (node, path) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) {
      return;
    }

    for (const [field, condition] of Object.entries(node)) {
      if (field.startsWith("$")) {
        continue;
      }

      if (condition === null || condition === "") {
        emptyCheckFields.add(field);
      } else if (condition && typeof condition === "object" && !Array.isArray(condition)) {
        const ops = Object.keys(condition).filter((key) => key.startsWith("$"));
        if (ops.length) {
          operatorFields.set(field, [...new Set([...(operatorFields.get(field) || []), ...ops])]);
        }
        if (ops.includes("$size")) {
          emptyCheckFields.add(field);
        }
        if (ops.includes("$lt") || ops.includes("$lte") || ops.includes("$gt") || ops.includes("$gte")) {
          rangeFields.add(field);
        }
      } else {
        equalityFields.add(field);
      }
    }
  });

  return {
    hasRegex: json.includes("$regex"),
    hasNe: json.includes("$ne"),
    hasNin: json.includes("$nin"),
    hasNot: json.includes("$not"),
    hasSize: json.includes("$size"),
    hasOr: json.includes("$or"),
    hasGroup: json.includes("$group"),
    hasEmptyChecks: emptyCheckFields.size > 0,
    emptyCheckFields: [...emptyCheckFields],
    equalityFields: [...equalityFields].filter((field) => field !== "status"),
    rangeFields: [...rangeFields],
    operatorFields
  };
}

function namespaceParts(ns) {
  const [db = "unknown", ...collectionParts] = String(ns || "unknown.unknown").split(".");
  return {
    db,
    collection: collectionParts.join(".") || "unknown"
  };
}

function buildIndexCommand(ns, spec) {
  const { db, collection } = namespaceParts(ns);
  return (
    `use ${db}\n` +
    `db.getCollection("${collection}").createIndex(\n` +
    `  ${pretty(spec).replace(/\n/g, "\n  ")},\n` +
    `  { background: true }\n` +
    `)`
  );
}

function summarizeEvent(event) {
  const attr = event.attr || {};
  const command = attr.command || {};
  const ns = attr.ns || "unknown";
  const operation = getOperation(command);
  const queryShape = extractQueryShape(command);
  const signals = collectSignals(command);
  const sort = command.sort || {};
  const sortField = Object.keys(sort)[0];
  const planSummary = attr.planSummary || "未知";
  const docsExamined = attr.docsExamined;
  const nreturned = attr.nreturned;
  const bytesRead = attr.storage?.data?.bytesRead;

  const findings = [];
  const indexAdvice = [];
  const indexCommands = [];
  const rewriteAdvice = [];
  const validationAdvice = [
    '执行 explain("executionStats")，重点看 planSummary、keysExamined、docsExamined、nReturned。',
    "确认优化后是否命中目标索引，并对比 docsExamined 和 durationMillis。"
  ];

  if (planSummary === "COLLSCAN") {
    findings.push("执行计划是 COLLSCAN，说明当前过滤条件没有命中有效索引。");
  }

  if (typeof docsExamined === "number" && typeof nreturned === "number") {
    const ratio = nreturned === 0 ? docsExamined : Math.round(docsExamined / Math.max(nreturned, 1));
    if (docsExamined > 1000 && ratio > 50) {
      findings.push(`扫描返回比偏高，docsExamined=${docsExamined}，nreturned=${nreturned}。`);
    }
  }

  if (signals.hasEmptyChecks) {
    findings.push(
      `存在空值混合判断：${signals.emptyCheckFields.join(", ")}。null、空字符串、空数组 $size:0 组合通常不适合直接靠普通索引优化。`
    );
    rewriteAdvice.push(
      "优先在写入侧给原字段写入统一默认值，替代 null、空字符串、空数组和字段不存在等多种状态。"
    );
    rewriteAdvice.push(
      '把查询改成精确等值，例如 { "原字段": "__EMPTY__" } 或业务认可的枚举默认值。'
    );
    rewriteAdvice.push(
      "保持同一字段类型一致，并先把历史数据归一化后再评估索引。不要默认建议新增辅助字段。"
    );
  }

  if (signals.hasNe || signals.hasNin || signals.hasNot) {
    findings.push("$ne/$nin/$not 这类负向条件通常不适合作为普通索引设计核心。");
    rewriteAdvice.push("把负向条件改成正向状态值或默认值等值查询，例如把 not locked 统一写成明确枚举后按等值过滤。");
  }

  if (signals.hasRegex) {
    findings.push("存在普通 regex/包含搜索，常规 B-tree 索引收益通常有限。");
    rewriteAdvice.push("若业务需要搜索，优先改成可精确匹配的枚举、前缀型字段或专门检索方案，再评估索引。");
  }

  if (signals.hasOr) {
    findings.push("存在 $or 分支；如果分支里混有空值、$size 或负向条件，应先改写查询形态，再谈索引。");
  }

  if (sortField === "_id") {
    findings.push(
      "_id 默认已有索引；如果执行计划走 IXSCAN { _id: 1 }，它主要是在服务排序，不代表业务过滤也被高效命中。"
    );
  }

  if (typeof bytesRead === "number" && bytesRead > 1024 * 1024 * 512) {
    findings.push(`读盘量较大，约 ${(bytesRead / (1024 * 1024 * 1024)).toFixed(2)} GB。`);
  }

  const strongEqualityFields = signals.equalityFields.filter(
    (field) =>
      !signals.emptyCheckFields.includes(field) &&
      !(signals.operatorFields.get(field) || []).some((op) =>
        ["$size", "$ne", "$nin", "$not", "$regex"].includes(op)
      )
  );

  if (signals.hasEmptyChecks || signals.hasNe || signals.hasNin || signals.hasNot || signals.hasRegex) {
    indexAdvice.push("当前不建议直接执行 createIndex，请先把不走索引或索引收益差的条件改成精确等值查询。");
    if (strongEqualityFields.length) {
      const spec = Object.fromEntries(strongEqualityFields.slice(0, 2).map((field) => [field, 1]));
      if (sortField) {
        spec[sortField] = sort[sortField];
      }
      indexAdvice.push(`改写后可优先测试候选索引：${pretty(spec)}。`);
    }
  } else if (operation === "find" && strongEqualityFields.length) {
    const spec = Object.fromEntries(strongEqualityFields.slice(0, 2).map((field) => [field, 1]));
    if (sortField) {
      spec[sortField] = sort[sortField];
    } else if (signals.rangeFields.length) {
      spec[signals.rangeFields[0]] = 1;
    }
    indexAdvice.push(`可以直接测试复合索引：${pretty(spec)}。`);
    indexCommands.push(buildIndexCommand(ns, spec));
  } else {
    indexAdvice.push("当前可索引信号不足，建议先补完整 slowlog 或 explain，再决定索引。");
  }

  if (!rewriteAdvice.length) {
    rewriteAdvice.push("优先确认过滤字段、排序字段和 limit 是否与业务目标一致，再设计索引。");
  }

  const summaryParts = [`${operation} 查询`];
  if (planSummary !== "未知") {
    summaryParts.push(`执行计划 ${planSummary}`);
  }
  if (typeof docsExamined === "number") {
    summaryParts.push(`扫描 ${docsExamined.toLocaleString()} 条文档`);
  }
  if (typeof attr.durationMillis === "number") {
    summaryParts.push(`耗时 ${attr.durationMillis} ms`);
  }

  return {
    ns,
    attr,
    queryShape,
    summary: `${ns}：${summaryParts.join("，")}。`,
    findings,
    indexAdvice: [...new Set(indexAdvice)],
    indexCommands: [...new Set(indexCommands)],
    rewriteAdvice: [...new Set(rewriteAdvice)],
    validationAdvice
  };
}

function buildTextReport(analyses) {
  const lines = [];
  lines.push("摘要");
  lines.push("");
  lines.push(`共识别 ${analyses.length} 条查询。`);
  analyses.forEach((analysis) => lines.push(`- ${analysis.summary}`));

  analyses.forEach((analysis, index) => {
    lines.push("");
    lines.push(`分组 ${index + 1}: ${analysis.ns}`);
    lines.push("");
    lines.push("证据");
    lines.push("");
    if (analysis.attr.planSummary) lines.push(`- planSummary: ${analysis.attr.planSummary}`);
    if (analysis.attr.keysExamined !== undefined) lines.push(`- keysExamined: ${analysis.attr.keysExamined}`);
    if (analysis.attr.docsExamined !== undefined) lines.push(`- docsExamined: ${analysis.attr.docsExamined}`);
    if (analysis.attr.nreturned !== undefined) lines.push(`- nreturned: ${analysis.attr.nreturned}`);
    if (analysis.attr.durationMillis !== undefined) lines.push(`- durationMillis: ${analysis.attr.durationMillis}`);
    lines.push("");
    lines.push("查询条件 / Query Shape");
    lines.push("");
    lines.push("```json");
    lines.push(pretty(analysis.queryShape));
    lines.push("```");
    lines.push("");
    lines.push("为什么慢");
    lines.push("");
    analysis.findings.forEach((item) => lines.push(`- ${item}`));
    lines.push("");
    lines.push("索引建议");
    lines.push("");
    analysis.indexAdvice.forEach((item) => lines.push(`- ${item}`));
    if (analysis.indexCommands.length) {
      lines.push("");
      lines.push("索引创建命令");
      lines.push("");
      analysis.indexCommands.forEach((command) => {
        lines.push("```javascript");
        lines.push(command);
        lines.push("```");
      });
    }
    lines.push("");
    lines.push("查询优化建议");
    lines.push("");
    analysis.rewriteAdvice.forEach((item) => lines.push(`- ${item}`));
    lines.push("");
    lines.push("验证建议");
    lines.push("");
    analysis.validationAdvice.forEach((item) => lines.push(`- ${item}`));
  });

  lines.push("");
  lines.push("参考文档");
  lines.push("");
  lines.push(`- MongoDB 慢查询优化: ${REFERENCE_URL}`);
  return lines.join("\n");
}

function buildHtmlReport(analyses) {
  const sections = analyses
    .map(
      (analysis, index) => `
      <section class="section" id="g${index + 1}">
        <h2>分组 ${index + 1}: ${escapeHtml(analysis.ns)}</h2>
        <h3>查询条件</h3>
        <pre>${escapeHtml(pretty(analysis.queryShape))}</pre>
        <h3>为什么慢</h3>
        <ul>${analysis.findings.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        <h3>索引建议</h3>
        <ul>${analysis.indexAdvice.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        ${
          analysis.indexCommands.length
            ? `<h3>索引创建命令</h3>${analysis.indexCommands
                .map((item) => `<pre>${escapeHtml(item)}</pre>`)
                .join("")}`
            : ""
        }
        <h3>查询优化建议</h3>
        <ul>${analysis.rewriteAdvice.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MongoDB Slowlog Analysis</title>
  <style>
    html { scroll-behavior: smooth; scroll-padding-top: 20px; }
    body { margin: 0; font-family: "Segoe UI", "Microsoft YaHei", sans-serif; background: #f5f7fb; color: #1f2937; }
    .page { max-width: 1080px; margin: 0 auto; padding: 28px 20px 48px; }
    .hero, .section { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 22px; margin-bottom: 18px; }
    .section[id] { scroll-margin-top: 20px; }
    pre { background: #111827; color: #f9fafb; padding: 14px; border-radius: 8px; overflow: auto; white-space: pre-wrap; }
    li { line-height: 1.8; }
    a { color: #0f766e; }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <h1>MongoDB 慢日志分析报告</h1>
      <p>共识别 ${analyses.length} 条查询。</p>
      <ul>${analyses.map((item) => `<li>${escapeHtml(item.summary)}</li>`).join("")}</ul>
    </section>
    ${sections}
    <p>参考文档：<a href="${REFERENCE_URL}">${REFERENCE_URL}</a></p>
  </main>
</body>
</html>`;
}

function buildReport(events) {
  if (!events.length) {
    const text =
      "无法解析输入。请传入完整 slowlog JSON、JSONL 慢日志，或至少包含 find/aggregate/filter/pipeline 的查询 JSON。";
    return {
      text,
      html: `<!DOCTYPE html><html lang="zh-CN"><meta charset="UTF-8"><body><p>${escapeHtml(text)}</p></body></html>`
    };
  }

  const analyses = events.map(summarizeEvent);
  return {
    text: buildTextReport(analyses),
    html: buildHtmlReport(analyses)
  };
}

const server = new Server(
  {
    name: "hap-mongodb-slowlog-analysis",
    version: "1.2.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "analyze_mongodb_slowlog",
      description:
        "Analyze MongoDB slowlog or query JSON and recommend query/index rewrites, especially default-value rewrites for non-index-friendly predicates.",
      inputSchema: {
        type: "object",
        properties: {
          slowlog: {
            type: "string",
            description: "A full MongoDB slowlog JSON string, JSONL slowlog lines, or a raw query JSON string."
          },
          format: {
            type: "string",
            enum: ["text", "html"],
            description: "Response format. Defaults to text."
          }
        },
        required: ["slowlog"]
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (name !== "analyze_mongodb_slowlog") {
    throw new Error(`Unknown tool: ${name}`);
  }

  const events = parseInput(args?.slowlog);
  const result = buildReport(events);
  const format = args?.format === "html" ? "html" : "text";

  return {
    content: [
      {
        type: "text",
        text: format === "html" ? result.html : result.text
      }
    ]
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
