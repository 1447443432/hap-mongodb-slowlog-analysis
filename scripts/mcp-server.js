import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractEvent(input) {
  if (!input) return null;

  const parsed = typeof input === "string" ? safeJsonParse(input) : input;
  if (!parsed) return null;

  if (parsed.attr && parsed.attr.command) {
    return parsed;
  }

  if (parsed.aggregate || parsed.find || parsed.pipeline || parsed.filter) {
    return {
      attr: {
        ns: parsed.ns || `${parsed.$db || "unknown"}.${parsed.aggregate || parsed.find || "unknown"}`,
        command: parsed
      }
    };
  }

  return null;
}

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

function buildHeuristicAnalysis(rawInput) {
  const event = extractEvent(rawInput);
  if (!event) {
    return {
      text: "无法解析输入。请传入完整 slowlog JSON，或至少包含 find/aggregate、filter/pipeline 等字段的 JSON 对象。",
      html: "<p>无法解析输入。请传入完整 slowlog JSON，或至少包含 find/aggregate、filter/pipeline 等字段的 JSON 对象。</p>"
    };
  }

  const attr = event.attr || {};
  const command = attr.command || {};
  const ns = attr.ns || "unknown";
  const planSummary = attr.planSummary || "未知";
  const docsExamined = attr.docsExamined ?? "未知";
  const keysExamined = attr.keysExamined ?? "未知";
  const durationMillis = attr.durationMillis ?? "未知";
  const nreturned = attr.nreturned ?? "未知";
  const operation = command.aggregate ? "aggregate" : command.find ? "find" : "unknown";

  const warnings = [];
  if (planSummary === "COLLSCAN") warnings.push("出现 COLLSCAN，优先怀疑缺少可用索引。");
  if (typeof docsExamined === "number" && typeof nreturned === "number" && docsExamined > 1000 && nreturned >= 0) {
    warnings.push(`扫描/返回比偏高：docsExamined=${docsExamined}, nreturned=${nreturned}。`);
  }
  if (command.pipeline) warnings.push("存在 aggregate pipeline，优先关注首段 $match 是否足够收敛。");
  if (command.filter && JSON.stringify(command.filter).includes("$regex")) warnings.push("存在 regex 查询，普通索引收益可能有限。");
  if (command.filter && JSON.stringify(command.filter).includes("$nin")) warnings.push("存在 $nin 负向条件，通常不适合先靠普通索引硬顶。");

  const queryShape = operation === "aggregate"
    ? { operation, pipeline: command.pipeline || [] }
    : {
        operation,
        filter: command.filter || {},
        sort: command.sort || {},
        projection: command.projection || {},
        limit: command.limit
      };

  const text = [
    `命名空间: ${ns}`,
    `操作类型: ${operation}`,
    `执行计划: ${planSummary}`,
    `耗时: ${durationMillis}`,
    `keysExamined: ${keysExamined}`,
    `docsExamined: ${docsExamined}`,
    `nreturned: ${nreturned}`,
    "",
    "初步判断:",
    ...(warnings.length ? warnings.map((item) => `- ${item}`) : ["- 当前日志证据有限，建议补 explain(\"executionStats\") 或完整 slowlog。"]),
    "",
    "查询结构:",
    pretty(queryShape)
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MongoDB Slowlog Analysis</title>
  <style>
    body { font-family: "Segoe UI", "PingFang SC", sans-serif; margin: 24px; color: #1f2937; background: #f8fafc; }
    .card { max-width: 980px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 18px; padding: 24px; }
    h1 { margin-top: 0; }
    .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 20px 0; }
    .meta div { background: #f3f4f6; border-radius: 12px; padding: 12px 14px; }
    pre { background: #111827; color: #f9fafb; padding: 16px; border-radius: 12px; overflow: auto; }
    li { line-height: 1.8; }
  </style>
</head>
<body>
  <div class="card">
    <h1>MongoDB 慢日志分析</h1>
    <div class="meta">
      <div><strong>命名空间</strong><br>${ns}</div>
      <div><strong>操作类型</strong><br>${operation}</div>
      <div><strong>执行计划</strong><br>${planSummary}</div>
      <div><strong>耗时</strong><br>${durationMillis}</div>
    </div>
    <h2>初步判断</h2>
    <ul>
      ${(warnings.length ? warnings : ["当前日志证据有限，建议补 explain(\"executionStats\") 或完整 slowlog。"]).map((item) => `<li>${item}</li>`).join("")}
    </ul>
    <h2>查询结构</h2>
    <pre>${pretty(queryShape)}</pre>
  </div>
</body>
</html>`;

  return { text, html };
}

const server = new Server(
  {
    name: "hap-mongodb-slowlog-analysis",
    version: "1.0.0"
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
      description: "Analyze a MongoDB slowlog JSON payload or query JSON and return a concise diagnosis plus optional HTML.",
      inputSchema: {
        type: "object",
        properties: {
          slowlog: {
            type: "string",
            description: "A full MongoDB slowlog JSON string or a query JSON string."
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

  const format = args?.format === "html" ? "html" : "text";
  const result = buildHeuristicAnalysis(args?.slowlog);

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
