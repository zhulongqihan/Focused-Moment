param(
  [ValidateSet("debug", "release")]
  [string]$Profile = "debug"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetDir = Join-Path $projectRoot ("src-tauri\target\{0}" -f $Profile)
$appExe = Join-Path $targetDir "focused-moment.exe"
$setupDir = Join-Path $targetDir "bundle\nsis"
$packageJson = Join-Path $projectRoot "package.json"

if (-not (Test-Path -LiteralPath $appExe)) {
  throw "Application exe not found: $appExe. Run the matching Tauri build first."
}

$package = Get-Content -Raw $packageJson | ConvertFrom-Json
$version = $package.version
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

$rootExe = Join-Path $projectRoot "Focused Moment.exe"
$versionedExe = Join-Path $projectRoot ("Focused Moment v{0}.exe" -f $version)
$timestampedExe = Join-Path $projectRoot ("Focused Moment v{0}-{1}.exe" -f $version, $timestamp)
$rootSetup = Join-Path $projectRoot "Focused Moment Setup.exe"
$versionedSetup = Join-Path $projectRoot ("Focused Moment Setup v{0}.exe" -f $version)
$timestampedSetup = Join-Path $projectRoot ("Focused Moment Setup v{0}-{1}.exe" -f $version, $timestamp)

$cleanupPatterns = @(
  "Focused Moment v*.exe",
  "Focused Moment Setup v*.exe"
)

foreach ($pattern in $cleanupPatterns) {
  Get-ChildItem -LiteralPath $projectRoot -Filter $pattern -File -ErrorAction SilentlyContinue |
    Where-Object {
      $_.FullName -ne $versionedExe -and
      $_.FullName -ne $versionedSetup
    } |
    ForEach-Object {
      $artifact = $_
      try {
        Remove-Item -LiteralPath $artifact.FullName -Force
      } catch {
        Write-Warning "Unable to remove old artifact $($artifact.FullName). It may be open."
      }
    }
}

try {
  Copy-Item -LiteralPath $appExe -Destination $versionedExe -Force
} catch {
  Copy-Item -LiteralPath $appExe -Destination $timestampedExe -Force
  Write-Warning "Unable to overwrite $versionedExe. It may be open. Exported $timestampedExe instead."
}

try {
  Copy-Item -LiteralPath $appExe -Destination $rootExe -Force
} catch {
  Write-Warning "Unable to overwrite $rootExe. It may be open."
}

$latestSetup = Get-ChildItem -LiteralPath $setupDir -Filter "*.exe" -File -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if ($null -ne $latestSetup) {
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

Write-Host ("Exported artifacts for profile: {0}" -f $Profile)
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
