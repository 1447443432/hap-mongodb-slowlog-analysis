# hap-mongodb-slowlog-analysis-plugin

This repository packages the local `hap-mongodb-slowlog-analysis` skill as a standard Codex plugin-style project so it can be versioned, shared, and reinstalled reliably.

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

## Notes

- The skill can be used by prompt even if the current Codex UI does not list it in "Personal skills".
- The UI list appears to have extra product-side filtering, so this repository is the stable source of truth rather than the panel.
