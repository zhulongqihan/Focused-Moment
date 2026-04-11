$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$debugExe = Join-Path $projectRoot "src-tauri\target\debug\focused-moment.exe"
$setupDir = Join-Path $projectRoot "src-tauri\target\debug\bundle\nsis"
$packageJson = Join-Path $projectRoot "package.json"

if (-not (Test-Path -LiteralPath $debugExe)) {
  throw "Debug exe not found: $debugExe. Run 'pnpm tauri build --debug' first."
}

$package = Get-Content -Raw $packageJson | ConvertFrom-Json
$version = $package.version
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

$rootExe = Join-Path $projectRoot "Focused Moment.exe"
$versionedExe = Join-Path $projectRoot ("Focused Moment v{0}.exe" -f $version)
$timestampedExe = Join-Path $projectRoot ("Focused Moment v{0}-{1}.exe" -f $version, $timestamp)

try {
  Copy-Item -LiteralPath $debugExe -Destination $versionedExe -Force
} catch {
  Copy-Item -LiteralPath $debugExe -Destination $timestampedExe -Force
  Write-Warning "Unable to overwrite $versionedExe. It may be open. Exported $timestampedExe instead."
}

try {
  Copy-Item -LiteralPath $debugExe -Destination $rootExe -Force
} catch {
  Write-Warning "Unable to overwrite $rootExe. It may be open."
}

$latestSetup = Get-ChildItem -LiteralPath $setupDir -Filter "*.exe" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if ($null -ne $latestSetup) {
  $rootSetup = Join-Path $projectRoot "Focused Moment Setup.exe"
  $versionedSetup = Join-Path $projectRoot ("Focused Moment Setup v{0}.exe" -f $version)
  $timestampedSetup = Join-Path $projectRoot ("Focused Moment Setup v{0}-{1}.exe" -f $version, $timestamp)

  try {
    Copy-Item -LiteralPath $latestSetup.FullName -Destination $versionedSetup -Force
  } catch {
    Copy-Item -LiteralPath $latestSetup.FullName -Destination $timestampedSetup -Force
    Write-Warning "Unable to overwrite $versionedSetup. It may be open. Exported $timestampedSetup instead."
  }

  try {
    Copy-Item -LiteralPath $latestSetup.FullName -Destination $rootSetup -Force
  } catch {
    Write-Warning "Unable to overwrite $rootSetup. It may be open."
  }
}

Write-Host "Exported artifacts:"
Write-Host " - $rootExe"
Write-Host " - $versionedExe"
if (Test-Path -LiteralPath $timestampedExe) {
  Write-Host " - $timestampedExe"
}
if ($null -ne $latestSetup) {
  Write-Host " - $rootSetup"
  Write-Host " - $versionedSetup"
  if (Test-Path -LiteralPath $timestampedSetup) {
    Write-Host " - $timestampedSetup"
  }
}
