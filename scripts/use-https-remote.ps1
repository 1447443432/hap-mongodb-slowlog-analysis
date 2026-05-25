$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$httpsRemote = "https://github.com/1447443432/hap-mongodb-slowlog-analysis.git"

$hasOrigin = (git -C $repoRoot remote) -contains "origin"
if (-not $hasOrigin) {
    throw "No origin remote is configured."
}

git -C $repoRoot remote set-url origin $httpsRemote
Write-Host "Updated origin to HTTPS:"
Write-Host "  $httpsRemote"
