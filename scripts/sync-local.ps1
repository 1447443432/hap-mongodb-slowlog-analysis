param(
    [switch]$IncludePluginCatalog
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$pluginName = "hap-mongodb-slowlog-analysis"
$skillSource = Join-Path $repoRoot "skills\hap-mongodb-slowlog-analysis"
$skillHubMetaSource = Join-Path $skillSource "_skillhub_meta.json"
$pluginManifestSource = Join-Path $repoRoot ".codex-plugin\plugin.json"
$pluginAgentsSource = Join-Path $repoRoot "agents"
$pluginAssetsSource = Join-Path $repoRoot "assets"
$codexHome = Join-Path $env:USERPROFILE ".codex"
$skillsRoot = Join-Path $codexHome "skills"
$skillTarget = Join-Path $skillsRoot $pluginName

New-Item -ItemType Directory -Force $skillsRoot | Out-Null
if (Test-Path -LiteralPath $skillTarget) {
    Remove-Item -LiteralPath $skillTarget -Recurse -Force
}
Copy-Item -LiteralPath $skillSource -Destination $skillTarget -Recurse -Force
if ((Test-Path -LiteralPath $skillHubMetaSource) -and -not (Test-Path -LiteralPath (Join-Path $skillTarget "_skillhub_meta.json"))) {
    Copy-Item -LiteralPath $skillHubMetaSource -Destination (Join-Path $skillTarget "_skillhub_meta.json") -Force
}
Write-Host "Synced skill to: $skillTarget"

if ($IncludePluginCatalog) {
    $catalogRoot = Join-Path $codexHome ".tmp\plugins"
    $catalogPluginRoot = Join-Path $catalogRoot "plugins\$pluginName"
    $catalogSkillTarget = Join-Path $catalogPluginRoot "skills\hap-mongodb-slowlog-analysis"
    $catalogManifestTarget = Join-Path $catalogPluginRoot ".codex-plugin\plugin.json"
    $catalogAgentsTarget = Join-Path $catalogPluginRoot "agents"
    $catalogAssetsTarget = Join-Path $catalogPluginRoot "assets"
    $catalogMarketPath = Join-Path $catalogRoot ".agents\plugins\marketplace.json"

    if (Test-Path -LiteralPath $catalogRoot) {
        New-Item -ItemType Directory -Force (Split-Path -Parent $catalogManifestTarget) | Out-Null
        if (Test-Path -LiteralPath $catalogSkillTarget) {
            Remove-Item -LiteralPath $catalogSkillTarget -Recurse -Force
        }
        Copy-Item -LiteralPath $skillSource -Destination $catalogSkillTarget -Recurse -Force
        Copy-Item -LiteralPath $pluginManifestSource -Destination $catalogManifestTarget -Force
        if (Test-Path -LiteralPath $pluginAgentsSource) {
            if (Test-Path -LiteralPath $catalogAgentsTarget) {
                Remove-Item -LiteralPath $catalogAgentsTarget -Recurse -Force
            }
            Copy-Item -LiteralPath $pluginAgentsSource -Destination $catalogAgentsTarget -Recurse -Force
        }
        if (Test-Path -LiteralPath $pluginAssetsSource) {
            if (Test-Path -LiteralPath $catalogAssetsTarget) {
                Remove-Item -LiteralPath $catalogAssetsTarget -Recurse -Force
            }
            Copy-Item -LiteralPath $pluginAssetsSource -Destination $catalogAssetsTarget -Recurse -Force
        }
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
