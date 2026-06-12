# Jednorázový setup Gravity UI pro větev GravityUI
# Spusť z kořene repa: .\scripts\setup-gravity-ui.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Set-Location $Root

Write-Host ">> Instalace npm závislostí (včetně @gravity-ui/uikit)..."
$env:NODE_OPTIONS = "--use-system-ca"
npm install

Write-Host ">> Klon MCP serveru (pokud chybí)..."
if (-not (Test-Path "tools/gravityui-reference-mcp")) {
    git clone --depth 1 https://github.com/antonskiter/gravityui-reference-mcp.git tools/gravityui-reference-mcp
}

Write-Host ">> Instalace závislostí MCP..."
Set-Location "tools/gravityui-reference-mcp"
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    pnpm install
} else {
    npm install
}

Set-Location $Root
Write-Host ">> Sync oficiální AI docs..."
& (Join-Path $PSScriptRoot "sync-gravity-official-docs.ps1")

Write-Host ""
Write-Host "Hotovo. Další kroky:"
Write-Host "  1. Zkontroluj absolutní cestu v .cursor/mcp.json (gravityui-docs)"
Write-Host "  2. Restartuj Cursor (MCP server gravityui-docs)"
Write-Host "  3. npm run dev -> http://localhost:3000/gravity-preview"
Write-Host "  4. Přečti docs/gravity-ui/README.md"
