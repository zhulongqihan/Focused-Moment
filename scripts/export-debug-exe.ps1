$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$debugExe = Join-Path $projectRoot "src-tauri\target\debug\focused-moment.exe"
$setupDir = Join-Path $projectRoot "src-tauri\target\debug\bundle\nsis"

if (-not (Test-Path -LiteralPath $debugExe)) {
  throw "Debug exe not found: $debugExe. Run 'pnpm tauri build --debug' first."
}

$rootExe = Join-Path $projectRoot "Focused Moment.exe"
Copy-Item -LiteralPath $debugExe -Destination $rootExe -Force

$latestSetup = Get-ChildItem -LiteralPath $setupDir -Filter "*.exe" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if ($null -ne $latestSetup) {
  $rootSetup = Join-Path $projectRoot "Focused Moment Setup.exe"
  Copy-Item -LiteralPath $latestSetup.FullName -Destination $rootSetup -Force
}

Write-Host "Exported artifacts:"
Write-Host " - $rootExe"
if ($null -ne $latestSetup) {
  Write-Host " - $rootSetup"
}
