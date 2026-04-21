# hap-mongodb-slowlog-analysis-plugin

This repository packages the local `hap-mongodb-slowlog-analysis` skill as a standard Codex plugin-style project so it can be versioned, shared, and reinstalled reliably.

## 中文安装文档

### 一、仓库位置

当前本地仓库默认位于：

`D:\projects\python\hap-mongodb-slowlog-analysis-plugin`

### 二、安装到 Codex

在仓库根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-local.ps1
```

这个脚本会把 skill 安装到：

```text
%USERPROFILE%\.codex\skills\hap-mongodb-slowlog-analysis
```

在你当前机器上，通常对应：

`C:\Users\admin\.codex\skills\hap-mongodb-slowlog-analysis`

### 三、安装后如何使用

安装完成后，不需要依赖“个人技能”面板，也可以直接在 Codex 对话里调用：

```text
用 hap-mongodb-slowlog-analysis 分析这段慢日志 ...
```

或者：

```text
Use $hap-mongodb-slowlog-analysis to analyze this MongoDB slow log.
```

### 四、修改 skill 后如何同步

如果你修改了下面这些文件：

- `skills/hap-mongodb-slowlog-analysis/SKILL.md`
- `skills/hap-mongodb-slowlog-analysis/agents/openai.yaml`
- `skills/hap-mongodb-slowlog-analysis/references/mongodb-4.4-slowlog-guidelines.md`

请执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-local.ps1
```

这个命令会把仓库里的最新版本重新同步到本机 Codex skill 目录。

### 五、尝试同步到当前 Codex 插件目录

如果你希望额外尝试把它同步到当前 Codex 使用中的本地插件 catalog，可执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-local.ps1 -IncludePluginCatalog
```

注意：

- 这是 best-effort 行为
- 它不能保证 skill 一定显示在“个人技能”里
- 当前证据表明，Codex 的 UI 列表还有额外过滤逻辑

### 六、为什么已经安装了，个人技能里还是没有

当前排查结论是：

- 安装到 `%USERPROFILE%\.codex\skills` 只能保证“本地可用”
- 不能保证“个人技能 UI 可见”
- “个人技能”面板大概率不是直接扫描 skill 目录
- 它更像是基于官方插件 catalog、插件元数据、UI 资源或产品侧规则来展示

因此请把这个仓库视为“稳定安装源”，而不是把“个人技能面板是否显示”作为唯一成功标准。

## Structure

- `.codex-plugin/plugin.json`: plugin manifest
- `skills/hap-mongodb-slowlog-analysis/`: the actual skill
- `scripts/install-local.ps1`: reinstalls the skill into `%USERPROFILE%\.codex\skills`
- `scripts/sync-local.ps1`: syncs the skill locally, with optional best-effort plugin catalog refresh
- `scripts/publish-github.ps1`: initializes git, stages changes, commits, and optionally pushes

## Quick start

If you only want to use the skill locally, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-local.ps1
```

Then use it directly in prompts, for example:

```text
用 hap-mongodb-slowlog-analysis 分析这段慢日志 ...
```

Or:

```text
Use $hap-mongodb-slowlog-analysis to analyze this MongoDB slow log.
```

## Local install

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-local.ps1
```

For a fuller local refresh:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-local.ps1
```

Try a best-effort sync into the current Codex plugin catalog clone:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-local.ps1 -IncludePluginCatalog
```

### What these scripts do

- `install-local.ps1`
  - Copies the skill into `%USERPROFILE%\.codex\skills\hap-mongodb-slowlog-analysis`
  - This is the safest option if you mainly want the skill available for local use

- `sync-local.ps1`
  - Re-syncs the repository version into `%USERPROFILE%\.codex\skills`
  - Use this after you edit `SKILL.md`, `references/`, or `agents/openai.yaml`

- `sync-local.ps1 -IncludePluginCatalog`
  - In addition to syncing the skill, it tries to update the current Codex local plugin catalog clone
  - This is only a best-effort helper
  - The Codex UI may still choose not to show the skill in "Personal skills"

## Daily workflow

### 1. Edit the skill

Common files to update:

- `skills/hap-mongodb-slowlog-analysis/SKILL.md`
- `skills/hap-mongodb-slowlog-analysis/agents/openai.yaml`
- `skills/hap-mongodb-slowlog-analysis/references/mongodb-4.4-slowlog-guidelines.md`

### 2. Sync locally

After editing, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-local.ps1
```

### 3. Test in Codex

Try a prompt such as:

```text
用 hap-mongodb-slowlog-analysis 分析下面这段 MongoDB 慢日志
```

### 4. Commit and publish

Use the publish script described below, or run git commands manually.

## GitHub publish

Initialize git, commit current changes, and set a remote:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\publish-github.ps1 -RemoteUrl <your-repo-url>
```

Push in the same step:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\publish-github.ps1 -RemoteUrl <your-repo-url> -Push
```

### Recommended first-time publish flow

1. Create an empty GitHub repository first.
2. Copy its clone URL.
3. Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\publish-github.ps1 -RemoteUrl <your-repo-url> -Push
```

### What `publish-github.ps1` does

- Initializes git if needed
- Renames the branch to `main`
- Configures or updates the `origin` remote when `-RemoteUrl` is provided
- Stages all files
- Creates a commit when there are changes
- Pushes only if you add `-Push`

## Manual git commands

If you prefer not to use the script:

```powershell
git init
git branch -M main
git add .
git commit -m "chore: initial plugin import"
git remote add origin <your-repo-url>
git push -u origin main
```

## Troubleshooting

### The skill works, but does not appear in "Personal skills"

This repository does not assume the Codex UI will display the skill. Current evidence suggests the UI uses extra product-side filtering beyond simply scanning `%USERPROFILE%\.codex\skills`.

That means:

- the skill can exist locally
- the agent can still use it
- the UI may still not list it

So treat this repository as the source of truth, and use prompt-based invocation when needed.

### I changed the skill, but Codex still seems to use old behavior

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-local.ps1
```

Then restart Codex if needed.

### I want to reinstall from this repository onto a new machine

1. Clone the repository.
2. Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-local.ps1
```

## Official App / MCP route

If your goal is to move closer to the officially supported Codex app path instead of relying on local skill discovery, this repository now includes a minimal MCP plugin skeleton.

### Files added for MCP

- `.mcp.json`
- `package.json`
- `scripts/mcp-server.js`

### Install dependencies

Run in the repository root:

```powershell
npm install
```

### Local MCP smoke check

Check server syntax:

```powershell
npm run check
```

Start the server manually:

```powershell
npm run mcp
```

### What this MCP server exposes

- Tool name: `analyze_mongodb_slowlog`
- Input:
  - `slowlog`: MongoDB slowlog JSON string
  - `format`: `text` or `html`
- Output:
  - concise analysis text
  - or basic HTML string

### How to use this for the official app path

The practical direction is:

1. Keep the skill for local prompt usage.
2. Use `.mcp.json` + MCP server as the official-facing integration unit.
3. In Codex / ChatGPT Developer mode, prefer the `Create app` / `Import MCP` route rather than relying on local skill UI indexing.

This does not guarantee appearance in the Personal Skills panel, but it moves the project toward the officially supported app/plugin path instead of undocumented local discovery behavior.

## Notes

- The skill can be used by prompt even if the current Codex UI does not list it in "Personal skills".
- The UI list appears to have extra product-side filtering, so this repository is the stable source of truth rather than the panel.
