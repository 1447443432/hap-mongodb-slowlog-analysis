param(
    [switch]$IncludePluginCatalog
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$pluginName = "hap-mongodb-slowlog-analysis"
$skillSource = Join-Path $repoRoot "skills\hap-mongodb-slowlog-analysis"
$pluginManifestSource = Join-Path $repoRoot ".codex-plugin\plugin.json"
$codexHome = Join-Path $env:USERPROFILE ".codex"
$skillsRoot = Join-Path $codexHome "skills"
$skillTarget = Join-Path $skillsRoot $pluginName

New-Item -ItemType Directory -Force $skillsRoot | Out-Null
if (Test-Path -LiteralPath $skillTarget) {
    Remove-Item -LiteralPath $skillTarget -Recurse -Force
}
Copy-Item -LiteralPath $skillSource -Destination $skillTarget -Recurse -Force
Write-Host "Synced skill to: $skillTarget"

if ($IncludePluginCatalog) {
    $catalogRoot = Join-Path $codexHome ".tmp\plugins"
    $catalogPluginRoot = Join-Path $catalogRoot "plugins\$pluginName"
    $catalogSkillTarget = Join-Path $catalogPluginRoot "skills\hap-mongodb-slowlog-analysis"
    $catalogManifestTarget = Join-Path $catalogPluginRoot ".codex-plugin\plugin.json"
    $catalogMarketPath = Join-Path $catalogRoot ".agents\plugins\marketplace.json"

    if (Test-Path -LiteralPath $catalogRoot) {
        New-Item -ItemType Directory -Force (Split-Path -Parent $catalogManifestTarget) | Out-Null
        if (Test-Path -LiteralPath $catalogSkillTarget) {
            Remove-Item -LiteralPath $catalogSkillTarget -Recurse -Force
        }
        Copy-Item -LiteralPath $skillSource -Destination $catalogSkillTarget -Recurse -Force
        Copy-Item -LiteralPath $pluginManifestSource -Destination $catalogManifestTarget -Force
        Write-Host "Best-effort synced plugin files into: $catalogPluginRoot"

        if (Test-Path -LiteralPath $catalogMarketPath) {
            $market = Get-Content -LiteralPath $catalogMarketPath -Raw | ConvertFrom-Json
            $plugins = @($market.plugins | Where-Object { $_.name -ne $pluginName })
            $plugins += [pscustomobject]@{
                name = $pluginName
                source = [pscustomobject]@{
                    source = "local"
                    path = "./plugins/$pluginName"
                }
                policy = [pscustomobject]@{
                    installation = "AVAILABLE"
                    authentication = "ON_INSTALL"
                }
                category = "Coding"
            }
            $market.plugins = $plugins
            $market | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $catalogMarketPath -Encoding UTF8
            Write-Host "Updated current Codex plugin catalog entry."
        } else {
            Write-Host "Skipped catalog registration because marketplace.json was not found."
        }
    } else {
        Write-Host "Skipped plugin catalog sync because current Codex catalog clone was not found."
    }
}

Write-Host "Done."
