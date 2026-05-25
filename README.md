# hap-mongodb-slowlog-analysis

Codex skill/plugin for HAP MongoDB slow-log analysis.

It analyzes pasted MongoDB slow logs or raw query JSON, explains why a query is slow, and gives practical rewrite/index advice. The current rule set is tuned for HAP dynamic worksheet collections and MongoDB 4.4.

## What this skill enforces

- For HAP worksheet collections whose names start with `ws`, treat `_id`, `utime`, `rowid`, and `ctime` single-field indexes as existing defaults.
- Do not recommend recreating single-field `_id`, `utime`, `rowid`, or `ctime` indexes for `ws*` collections.
- Treat `status` as low-cardinality and do not include it in recommended index definitions.
- For `$ne`, `$nin`, `$not`, mixed empty checks, and ordinary regex contains search, prefer query rewrite before ordinary indexes.
- For `null` / `""` / missing / empty-array checks, prefer normalizing writes to one canonical default value on the original field, then query by exact equality.
- Keep existing dynamic field keys stable. Do not recommend renaming fields. Do not default to helper fields.

Example rewrite:

```javascript
// Before
{
  $or: [
    { field: null },
    { field: "" },
    { field: { $size: 0 } }
  ]
}

// After
{
  field: "__EMPTY__"
}
```

## Local install into Codex

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-local.ps1
```

This installs the skill to:

```text
%USERPROFILE%\.codex\skills\hap-mongodb-slowlog-analysis
```

If another Codex instance uses a custom home directory:

```powershell
$env:CODEX_HOME="D:\path\to\.codex"
powershell -ExecutionPolicy Bypass -File .\scripts\install-local.ps1
```

After edits, sync again:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-local.ps1
```

## Validation

Validate the rule set and package metadata:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\validate-skill.ps1
```

Verify that the repository can install into a fresh Codex home:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test-install.ps1
```

Check the MCP server syntax:

```powershell
npm run check
```

## Package for upload

Build a clean export folder and zip:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-skill.ps1
```

That produces:

- `dist\skill-upload\hap-mongodb-slowlog-analysis\`
- `dist\hap-mongodb-slowlog-analysis-skill-upload.zip`

The folder export is the safest option for any future "upload a skill from your computer" flow. The zip is a convenience artifact for sharing or archiving.

## Download from GitHub

There are now two GitHub download paths.

### 1. Actions artifacts

Workflow:

```text
.github/workflows/package-skill.yml
```

After you push to `main` or manually run the workflow, download the packaged zip or upload-ready folder from the workflow run's **Artifacts** section.

### 2. Releases page

Workflow:

```text
.github/workflows/release-skill.yml
```

This is the path for the "click from repository homepage and download zip" experience.

You can use it in either mode:

1. Push a tag like `v1.1.1`
2. Or manually run the workflow in GitHub Actions and provide:
   - `tag_name`
   - `release_name`

When it finishes, GitHub creates a Release and attaches:

- `hap-mongodb-slowlog-analysis-skill-upload.zip`

That file can then be downloaded directly from the repository's **Releases** page.

## Use in Codex

Use it directly by name:

```text
用 hap-mongodb-slowlog-analysis 分析这段 MongoDB 慢日志 ...
```

or:

```text
Use $hap-mongodb-slowlog-analysis to analyze this MongoDB slow log.
```

The skill can work even if the Codex UI does not list it in "Personal skills".

## Official publish route

As of the current public OpenAI documentation, the practical official route is through the ChatGPT Skills experience, not a public global "skill website" marketplace.

What that means in practice:

1. Open ChatGPT and go to the Skills page for your account or workspace.
2. Create a new skill or use the "upload from your computer" flow if that option is available in your plan/workspace.
3. Use the export created by `package-skill.ps1`, or download the packaged zip from GitHub Releases.
4. If you are on a managed workspace, publish/share it to the workspace skills library according to your admin permissions.

Important notes:

- Public docs describe a workspace/library style flow; I have not found a public official marketplace where an individual skill is globally listed like an app store entry.
- Skills are supported in Codex, but they do not automatically sync across every surface.
- So the reliable Codex install path today is still local installation into `$CODEX_HOME/skills`, which this repository already supports.

## MCP / App route

This repository also includes a minimal MCP server so the project can move toward the official App / MCP path:

- `.mcp.json`
- `scripts/mcp-server.js`
- tool: `analyze_mongodb_slowlog`

Install dependencies:

```powershell
npm install
```

Start it manually:

```powershell
npm run mcp
```

## Repository layout

- `.codex-plugin/plugin.json`: plugin manifest
- `.mcp.json`: MCP server config
- `skills/hap-mongodb-slowlog-analysis/`: skill files
- `skills/hap-mongodb-slowlog-analysis/SKILL.md`: main skill instructions
- `skills/hap-mongodb-slowlog-analysis/references/`: detailed rules
- `scripts/install-local.ps1`: install to local Codex skills directory
- `scripts/sync-local.ps1`: sync local changes after edits
- `scripts/test-install.ps1`: install into a temporary Codex home and verify required files
- `scripts/validate-skill.ps1`: validate that the skill/package still follows the enforced rule set
- `scripts/package-skill.ps1`: build an upload-ready folder and zip
- `scripts/mcp-server.js`: MCP tool implementation
- `scripts/publish-github.ps1`: commit/publish helper

## Publish repository changes

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\publish-github.ps1 -CommitMessage "your message" -Push
```

Current GitHub remote:

```text
git@github.com:1447443432/hap-mongodb-slowlog-analysis.git
```

## Reference

- [MongoDB 慢查询优化](https://docs-pd.mingdao.com/deployment/components/mongodb/slowQueryOptimization)
