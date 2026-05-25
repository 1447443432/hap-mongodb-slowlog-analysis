$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("codex-skill-install-test-" + [System.Guid]::NewGuid().ToString("N"))

try {
    New-Item -ItemType Directory -Force $tempRoot | Out-Null
    $env:CODEX_HOME = $tempRoot

    & (Join-Path $repoRoot "scripts\install-local.ps1")

    $skillTarget = Join-Path $tempRoot "skills\hap-mongodb-slowlog-analysis"
    $requiredFiles = @(
        "SKILL.md",
        "_meta.json",
        "_skillhub_meta.json",
        "agents\openai.yaml",
        "references\mongodb-4.4-slowlog-guidelines.md"
    )

    foreach ($file in $requiredFiles) {
        $path = Join-Path $skillTarget $file
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
            throw "Install verification failed. Missing: $path"
        }
    }

    $skill = Get-Content -LiteralPath (Join-Path $skillTarget "SKILL.md") -Raw
    if ($skill -notmatch "name:\s*hap-mongodb-slowlog-analysis") {
        throw "Install verification failed. SKILL.md frontmatter name is missing or invalid."
    }

    Write-Host "Install verification passed: $skillTarget"
} finally {
    Remove-Item Env:\CODEX_HOME -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
}
