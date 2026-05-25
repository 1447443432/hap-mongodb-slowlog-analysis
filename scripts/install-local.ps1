$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$pluginName = "hap-mongodb-slowlog-analysis"
$skillSource = Join-Path $repoRoot "skills\hap-mongodb-slowlog-analysis"
$skillHubMetaSource = Join-Path $skillSource "_skillhub_meta.json"
$codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE ".codex" }
$skillsRoot = Join-Path $codexHome "skills"
$skillTarget = Join-Path $skillsRoot $pluginName

function Assert-FileExists {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Required file missing after install: $Path"
    }
}

Assert-FileExists (Join-Path $skillSource "SKILL.md")
Assert-FileExists (Join-Path $skillSource "_meta.json")
Assert-FileExists (Join-Path $skillSource "_skillhub_meta.json")
Assert-FileExists (Join-Path $skillSource "agents\openai.yaml")

New-Item -ItemType Directory -Force $skillsRoot | Out-Null
if (Test-Path -LiteralPath $skillTarget) {
    Remove-Item -LiteralPath $skillTarget -Recurse -Force
}
Copy-Item -LiteralPath $skillSource -Destination $skillTarget -Recurse -Force
if ((Test-Path -LiteralPath $skillHubMetaSource) -and -not (Test-Path -LiteralPath (Join-Path $skillTarget "_skillhub_meta.json"))) {
    Copy-Item -LiteralPath $skillHubMetaSource -Destination (Join-Path $skillTarget "_skillhub_meta.json") -Force
}

Assert-FileExists (Join-Path $skillTarget "SKILL.md")
Assert-FileExists (Join-Path $skillTarget "_meta.json")
Assert-FileExists (Join-Path $skillTarget "_skillhub_meta.json")
Assert-FileExists (Join-Path $skillTarget "agents\openai.yaml")

Write-Host "Installed skill to: $skillTarget"
Write-Host "Codex home: $codexHome"
Write-Host "If the Codex UI still does not show it, use it by name in prompts:"
Write-Host "  Use `$hap-mongodb-slowlog-analysis ..."
