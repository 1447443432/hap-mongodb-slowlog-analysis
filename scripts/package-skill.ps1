param(
    [string]$OutputRoot = ".\dist"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$skillName = "hap-mongodb-slowlog-analysis"
$skillSource = Join-Path $repoRoot "skills\$skillName"
$distRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $OutputRoot))
$exportRoot = Join-Path $distRoot "skill-upload"
$skillExport = Join-Path $exportRoot $skillName
$zipPath = Join-Path $distRoot "$skillName-skill-upload.zip"

function Assert-FileExists {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Missing required file: $Path"
    }
}

Assert-FileExists (Join-Path $skillSource "SKILL.md")
Assert-FileExists (Join-Path $skillSource "_meta.json")
Assert-FileExists (Join-Path $skillSource "_skillhub_meta.json")
Assert-FileExists (Join-Path $skillSource "agents\openai.yaml")

New-Item -ItemType Directory -Force $distRoot | Out-Null
if (Test-Path -LiteralPath $exportRoot) {
    Remove-Item -LiteralPath $exportRoot -Recurse -Force
}
if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

New-Item -ItemType Directory -Force $exportRoot | Out-Null
Copy-Item -LiteralPath $skillSource -Destination $skillExport -Recurse -Force

Compress-Archive -LiteralPath $skillExport -DestinationPath $zipPath -Force

Write-Host "Packaged skill folder: $skillExport"
Write-Host "Packaged zip: $zipPath"
