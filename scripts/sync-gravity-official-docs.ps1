# Stáhne oficiální AI dokumentaci Gravity UI do docs/gravity-ui/official/
# Spusť: .\scripts\sync-gravity-official-docs.ps1

$ErrorActionPreference = "Stop"
$Out = Join-Path (Split-Path $PSScriptRoot -Parent) "docs\gravity-ui\official"
New-Item -ItemType Directory -Force -Path $Out | Out-Null

$files = @{
    "uikit-AGENTS.md"     = "https://raw.githubusercontent.com/gravity-ui/uikit/main/AGENTS.md"
    "navigation-agents.md" = "https://raw.githubusercontent.com/gravity-ui/navigation/main/agents.md"
    "aikit-AI_AGENTS.md"  = "https://raw.githubusercontent.com/gravity-ui/aikit/main/docs/AI_AGENTS.md"
    "aikit-llms.txt"      = "https://raw.githubusercontent.com/gravity-ui/aikit/main/llms.txt"
}

foreach ($name in $files.Keys) {
    $url = $files[$name]
    $dest = Join-Path $Out $name
    Write-Host ">> $name"
    Invoke-WebRequest -Uri $url -OutFile $dest
}

Write-Host "Hotovo: $Out"
