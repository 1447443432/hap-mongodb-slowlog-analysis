$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$skillRoot = Join-Path $repoRoot "skills\hap-mongodb-slowlog-analysis"
$skillFile = Join-Path $skillRoot "SKILL.md"
$referenceFile = Join-Path $skillRoot "references\mongodb-4.4-slowlog-guidelines.md"
$agentFile = Join-Path $repoRoot "agents\openai.yaml"
$pluginFile = Join-Path $repoRoot ".codex-plugin\plugin.json"

function Assert-FileExists {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Missing required file: $Path"
    }
}

function Assert-Contains {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Content,
        [Parameter(Mandatory = $true)]
        [string]$Pattern,
        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    if ($Content -notmatch $Pattern) {
        throw $Message
    }
}

Assert-FileExists $skillFile
Assert-FileExists $referenceFile
Assert-FileExists $agentFile
Assert-FileExists $pluginFile
Assert-FileExists (Join-Path $skillRoot "_meta.json")
Assert-FileExists (Join-Path $skillRoot "_skillhub_meta.json")
Assert-FileExists (Join-Path $skillRoot "agents\openai.yaml")

$skill = Get-Content -LiteralPath $skillFile -Raw -Encoding UTF8
$reference = Get-Content -LiteralPath $referenceFile -Raw -Encoding UTF8
$agent = Get-Content -LiteralPath $agentFile -Raw -Encoding UTF8
$plugin = Get-Content -LiteralPath $pluginFile -Raw -Encoding UTF8

Assert-Contains $skill '^---\s*[\r\n]+name:\s*hap-mongodb-slowlog-analysis' "SKILL.md frontmatter name is missing or invalid."
Assert-Contains $skill 'For HAP worksheet collections whose names start with ws' "SKILL.md description must mention ws* default indexes."
Assert-Contains $skill '"_id": 1.*"utime": 1.*"rowid": 1.*"ctime": 1' "SKILL.md must list ws* default single-field indexes."
Assert-Contains $skill '__EMPTY__' "SKILL.md must include canonical default-value rewrite guidance."
Assert-Contains $skill 'createIndex' "SKILL.md must preserve createIndex guidance."

Assert-Contains $reference 'default single-field indexes' "Reference file must describe ws* default indexes."
Assert-Contains $reference 'Normalize writes so empty or missing business values are stored as one canonical default value' "Reference file must require canonical default-value rewrites."
Assert-Contains $reference 'Never recommend creating a single-field `_id` index' "Reference file must forbid single-field _id recommendations."

Assert-Contains $agent 'default-value exact-match rewrites' "agents/openai.yaml must mention default-value exact-match rewrites."
Assert-Contains $plugin 'default-value rewrites' "plugin.json description should mention default-value rewrites."

Write-Host "Skill validation passed:"
Write-Host "  $skillFile"
