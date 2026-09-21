# Installs Vencord from source plus Bash's plugins on Windows.
# Usage (PowerShell):  irm https://raw.githubusercontent.com/watchthelight/bash-plugins/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

$VencordDir = Join-Path $HOME "Vencord"
$PluginsRepo = "https://github.com/watchthelight/bash-plugins"
$RepoDir = Join-Path $VencordDir "src\userplugins\.bash-plugins"

function Have($name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }
function RefreshPath {
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
}

Write-Host ""
Write-Host "== Tools ==" -ForegroundColor Cyan
if (-not (Have git)) {
    Write-Host "Installing Git..."
    winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements | Out-Null
    RefreshPath
}
if (-not (Have node)) {
    Write-Host "Installing Node.js LTS..."
    winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements | Out-Null
    RefreshPath
}
$nodeMajor = [int]((& node --version).TrimStart("v").Split(".")[0])
if ($nodeMajor -lt 22) {
    throw "Node $nodeMajor is too old, Vencord needs 22 or newer. Upgrade with: winget upgrade OpenJS.NodeJS.LTS"
}
if (-not (Have pnpm)) {
    Write-Host "Installing pnpm..."
    & npm.cmd install -g pnpm | Out-Null
    RefreshPath
}
Write-Host ("git " + (& git --version).Split(" ")[2] + ", node " + (& node --version) + ", pnpm " + (& pnpm.cmd --version))

Write-Host ""
Write-Host "== Vencord ==" -ForegroundColor Cyan
if (-not (Test-Path (Join-Path $VencordDir "package.json"))) {
    Write-Host "Cloning Vencord to $VencordDir"
    & git clone --quiet https://github.com/Vendicated/Vencord $VencordDir
} else {
    Write-Host "Vencord already at $VencordDir"
}
Set-Location $VencordDir
Write-Host "Installing dependencies (a newer pnpm may download itself, that's expected)"
& pnpm.cmd install --frozen-lockfile

Write-Host ""
Write-Host "== Bash's plugins ==" -ForegroundColor Cyan
if (-not (Test-Path (Join-Path $RepoDir ".git"))) {
    & git clone --quiet $PluginsRepo $RepoDir
} else {
    & git -C $RepoDir pull --ff-only --quiet
}
$linked = @()
Get-ChildItem $RepoDir -Directory | Where-Object { $_.Name -notmatch '^[._]' -and ((Test-Path (Join-Path $_.FullName "index.tsx")) -or (Test-Path (Join-Path $_.FullName "index.ts"))) } | ForEach-Object {
    $link = Join-Path $VencordDir ("src\userplugins\" + $_.Name)
    if (-not (Test-Path $link)) {
        New-Item -ItemType Junction -Path $link -Target $_.FullName | Out-Null
        $linked += $_.Name
    }
}
Write-Host ("Plugins: " + ((Get-ChildItem $RepoDir -Directory | Where-Object { $_.Name -notmatch '^[._]' }).Name -join ", "))
if ($linked.Count) { Write-Host ("Linked: " + ($linked -join ", ")) }

Write-Host ""
Write-Host "== Build ==" -ForegroundColor Cyan
& pnpm.cmd build

Write-Host ""
Write-Host "Done. Discord must be fully closed before injecting (tray icon, Quit Discord)." -ForegroundColor Green
$answer = Read-Host "Inject into Discord now? (y/n)"
if ($answer -match '^[Yy]') {
    & pnpm.cmd inject
    Write-Host ""
    Write-Host "Open Discord, then User Settings > Vencord > Plugins and turn on the ones you want. Press Ctrl+R once." -ForegroundColor Green
} else {
    Write-Host "Later: close Discord, then run 'pnpm inject' in $VencordDir"
}
