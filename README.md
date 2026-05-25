# hap-mongodb-slowlog-analysis

Codex skill/plugin for HAP MongoDB slow-log analysis.

It analyzes pasted MongoDB slow logs or query command JSON, explains why a query is slow, and gives practical rewrite/index advice. The current rule set is tuned for HAP dynamic worksheet collections and MongoDB 4.4.

## Key Rules

- For HAP worksheet collections whose names start with `ws`, treat `_id`, `utime`, `rowid`, and `ctime` single-field indexes as existing defaults.
- Do not recommend recreating single-field `_id`, `utime`, `rowid`, or `ctime` indexes for `ws*` collections.
- Treat `status` as low-cardinality and do not include it in recommended index definitions.
- Treat `ctime` as already indexed and do not recommend a new index on it.
- For `$ne`, `$nin`, `$not`, "not contains", "does not start with", regex contains search, and mixed empty checks, prefer query rewrite before ordinary indexes.
- For `null` / `""` / empty array / `$size: 0` / missing-field checks, prefer normalizing writes to a single default value on the original field, then query by exact equality.
- Keep existing dynamic field keys stable. Do not recommend renaming fields.

Example rewrite:

```javascript
// Before: hard to index well
{
  $or: [
    { field: null },
    { field: "" },
    { field: { $size: 0 } }
  ]
}

// After: normalize writes, then use exact equality
{
  field: "__EMPTY__"
}
```

## Local Install

Clone this repository, then run from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-local.ps1
```

This installs the skill to:

```text
%USERPROFILE%\.codex\skills\hap-mongodb-slowlog-analysis
```

After editing the skill, sync it again:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-local.ps1
```

To verify that the repository is installable on a fresh Codex home, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test-install.ps1
```

The installer supports `CODEX_HOME`. If another Codex instance uses a custom home directory:

```powershell
$env:CODEX_HOME="D:\path\to\.codex"
powershell -ExecutionPolicy Bypass -File .\scripts\install-local.ps1
```

The install script verifies these required files after copying:

- `SKILL.md`
- `_meta.json`
- `_skillhub_meta.json`
- `agents/openai.yaml`
- `references/mongodb-4.4-slowlog-guidelines.md`

## Use In Codex

Use it directly by name:

```text
用 hap-mongodb-slowlog-analysis 分析这段 MongoDB 慢日志 ...
```

or:

```text
Use $hap-mongodb-slowlog-analysis to analyze this MongoDB slow log.
```

The skill can work even if the Codex UI does not show it in "Personal skills".

## MCP App Route

This repository also includes a minimal MCP server so the analysis can move toward the official App / MCP path.

Install dependencies:

```powershell
npm install
```

Check the MCP server:

```powershell
npm run check
```

Start it manually:

```powershell
npm run mcp
```

MCP config:

```text
.mcp.json
```

Tool:

```text
analyze_mongodb_slowlog
```

Inputs:

- `slowlog`: full slow-log JSON, JSONL slow-log text, or raw MongoDB query command JSON
- `format`: `text` or `html`

## Repository Layout

- `.codex-plugin/plugin.json`: plugin manifest
- `.mcp.json`: MCP server config
- `skills/hap-mongodb-slowlog-analysis/`: skill files
- `skills/hap-mongodb-slowlog-analysis/SKILL.md`: main skill instructions
- `skills/hap-mongodb-slowlog-analysis/references/`: detailed analysis rules
- `scripts/install-local.ps1`: install to local Codex skills directory
- `scripts/sync-local.ps1`: sync local changes after edits
- `scripts/mcp-server.js`: MCP tool implementation
- `scripts/publish-github.ps1`: commit/publish helper

## Publish Changes

Commit and push with:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\publish-github.ps1 -CommitMessage "your message" -Push
```

Current GitHub remote:

```text
git@github.com:1447443432/hap-mongodb-slowlog-analysis.git
```

## Reference

- [MongoDB 慢查询优化](https://docs-pd.mingdao.com/deployment/components/mongodb/slowQueryOptimization)
