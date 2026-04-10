param(
    [string]$RemoteUrl,
    [string]$Branch = "main",
    [string]$CommitMessage = "chore: update hap-mongodb-slowlog-analysis plugin",
    [switch]$Push
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot

if (-not (Test-Path -LiteralPath (Join-Path $repoRoot ".git"))) {
    git -C $repoRoot init | Out-Null
}

$currentBranch = (git -C $repoRoot branch --show-current).Trim()
if (-not $currentBranch) {
    git -C $repoRoot checkout -b $Branch | Out-Null
} elseif ($currentBranch -ne $Branch) {
    git -C $repoRoot branch -M $Branch | Out-Null
}

if ($RemoteUrl) {
    $hasOrigin = (git -C $repoRoot remote) -contains "origin"
    if ($hasOrigin) {
        git -C $repoRoot remote set-url origin $RemoteUrl | Out-Null
    } else {
        git -C $repoRoot remote add origin $RemoteUrl | Out-Null
    }
}

git -C $repoRoot add . | Out-Null

$status = git -C $repoRoot status --short
if ($status) {
    git -C $repoRoot commit -m $CommitMessage | Out-Null
    Write-Host "Created commit with message: $CommitMessage"
} else {
    Write-Host "No changes to commit."
}

if ($Push) {
    $hasOrigin = (git -C $repoRoot remote) -contains "origin"
    if (-not $hasOrigin) {
        throw "Cannot push because no origin remote is configured. Pass -RemoteUrl first."
    }
    git -C $repoRoot push -u origin $Branch
} else {
    Write-Host "Skipped push. Use -Push to publish."
}
