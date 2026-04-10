$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$pluginName = "hap-mongodb-slowlog-analysis"
$skillSource = Join-Path $repoRoot "skills\hap-mongodb-slowlog-analysis"
$codexHome = Join-Path $env:USERPROFILE ".codex"
$skillsRoot = Join-Path $codexHome "skills"
$skillTarget = Join-Path $skillsRoot $pluginName

New-Item -ItemType Directory -Force $skillsRoot | Out-Null
if (Test-Path -LiteralPath $skillTarget) {
    Remove-Item -LiteralPath $skillTarget -Recurse -Force
}
Copy-Item -LiteralPath $skillSource -Destination $skillTarget -Recurse -Force

Write-Host "Installed skill to: $skillTarget"
Write-Host "If the Codex UI still does not show it, use it by name in prompts:"
Write-Host "  Use `$hap-mongodb-slowlog-analysis ..."
