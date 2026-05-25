param(
    [string]$Version,
    [string]$TagName,
    [string]$ReleaseName,
    [switch]$PushTag
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$packageJsonPath = Join-Path $repoRoot "package.json"

if (-not (Test-Path -LiteralPath $packageJsonPath -PathType Leaf)) {
    throw "package.json not found: $packageJsonPath"
}

$pkg = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
$resolvedVersion = if ($Version) { $Version } else { $pkg.version }

if (-not $resolvedVersion) {
    throw "Could not resolve a version. Pass -Version or ensure package.json has a version field."
}

$resolvedTag = if ($TagName) { $TagName } else { "v$resolvedVersion" }
$resolvedReleaseName = if ($ReleaseName) { $ReleaseName } else { "hap-mongodb-slowlog-analysis v$resolvedVersion" }

$localTagExists = (git -C $repoRoot tag --list $resolvedTag) -contains $resolvedTag
if ($localTagExists) {
    throw "Tag already exists locally: $resolvedTag"
}

$hasOrigin = (git -C $repoRoot remote) -contains "origin"
if (-not $hasOrigin) {
    throw "No origin remote is configured."
}

$status = git -C $repoRoot status --short
if ($status) {
    throw "Working tree is not clean. Commit or stash changes before publishing a release tag."
}

git -C $repoRoot tag -a $resolvedTag -m $resolvedReleaseName
Write-Host "Created local tag: $resolvedTag"

if ($PushTag) {
    git -C $repoRoot push origin $resolvedTag
    Write-Host "Pushed tag to origin: $resolvedTag"
    Write-Host "This will trigger the Release Skill workflow on GitHub."
} else {
    Write-Host "Skipped pushing tag. Use -PushTag to trigger the GitHub Release workflow."
}
