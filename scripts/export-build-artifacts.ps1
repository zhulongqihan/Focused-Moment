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
$releaseDir = Join-Path $projectRoot ".release"

if (-not (Test-Path -LiteralPath $appExe)) {
  throw "Application exe not found: $appExe. Run the matching Tauri build first."
}

$package = Get-Content -Raw $packageJson | ConvertFrom-Json
$version = $package.version
$tag = "v{0}" -f $version
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

New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null

$appAssetPath = $versionedExe
try {
  Copy-Item -LiteralPath $appExe -Destination $versionedExe -Force
} catch {
  Copy-Item -LiteralPath $appExe -Destination $timestampedExe -Force
  $appAssetPath = $timestampedExe
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

$setupAssetPath = $null
if ($null -ne $latestSetup) {
  $setupAssetPath = $versionedSetup
  try {
    Copy-Item -LiteralPath $latestSetup.FullName -Destination $versionedSetup -Force
  } catch {
    Copy-Item -LiteralPath $latestSetup.FullName -Destination $timestampedSetup -Force
    $setupAssetPath = $timestampedSetup
    Write-Warning "Unable to overwrite $versionedSetup. It may be open. Exported $timestampedSetup instead."
  }

  try {
    Copy-Item -LiteralPath $latestSetup.FullName -Destination $rootSetup -Force
  } catch {
    Write-Warning "Unable to overwrite $rootSetup. It may be open."
  }
}

$assetManifest = [ordered]@{
  version = $version
  tag = $tag
  profile = $Profile
  exportedAt = (Get-Date).ToString("o")
  appAssetPath = $appAssetPath
  setupAssetPath = $setupAssetPath
  rootAppPath = $rootExe
  rootSetupPath = $rootSetup
}

$manifestPath = Join-Path $releaseDir ("artifacts.{0}.json" -f $Profile)
$assetManifest | ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding utf8

Write-Host ("Exported artifacts for profile: {0}" -f $Profile)
Write-Host " - $rootExe"
Write-Host " - $appAssetPath"
if ($null -ne $latestSetup) {
  Write-Host " - $rootSetup"
  Write-Host " - $setupAssetPath"
}
Write-Host " - $manifestPath"
