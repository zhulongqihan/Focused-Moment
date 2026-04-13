$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$packageJson = Join-Path $projectRoot "package.json"
$package = Get-Content -Raw $packageJson | ConvertFrom-Json
$currentVersion = $package.version
$releaseDir = Join-Path $projectRoot ".release"

$keepFiles = @(
  "Focused Moment.exe",
  ("Focused Moment v{0}.exe" -f $currentVersion),
  "Focused Moment Setup.exe",
  ("Focused Moment Setup v{0}.exe" -f $currentVersion)
)

$manifestFiles = @(
  (Join-Path $releaseDir "artifacts.debug.json"),
  (Join-Path $releaseDir "artifacts.release.json")
)

foreach ($manifestFile in $manifestFiles) {
  if (-not (Test-Path -LiteralPath $manifestFile)) {
    continue
  }

  try {
    $manifest = Get-Content -Raw -LiteralPath $manifestFile | ConvertFrom-Json
    $paths = @($manifest.appAssetPath, $manifest.setupAssetPath)
    foreach ($path in $paths) {
      if ($path) {
        $keepFiles += [System.IO.Path]::GetFileName($path)
      }
    }
  } catch {
    Write-Warning "Unable to read build artifact manifest: $manifestFile"
  }
}

$patterns = @(
  "Focused Moment v*.exe",
  "Focused Moment Setup v*.exe"
)

$removed = New-Object System.Collections.Generic.List[string]
$skipped = New-Object System.Collections.Generic.List[string]

foreach ($pattern in $patterns) {
  Get-ChildItem -LiteralPath $projectRoot -Filter $pattern -File -ErrorAction SilentlyContinue |
    Where-Object { $keepFiles -notcontains $_.Name } |
    ForEach-Object {
      $artifact = $_
      try {
        Remove-Item -LiteralPath $artifact.FullName -Force
        $removed.Add($artifact.Name) | Out-Null
      } catch {
        $skipped.Add($artifact.Name) | Out-Null
      }
    }
}

Write-Host ("Current version kept: v{0}" -f $currentVersion)

if ($removed.Count -gt 0) {
  Write-Host "Removed old artifacts:"
  $removed | ForEach-Object { Write-Host (" - {0}" -f $_) }
} else {
  Write-Host "Removed old artifacts: none"
}

if ($skipped.Count -gt 0) {
  Write-Warning "Some old artifacts are still in use and were skipped:"
  $skipped | ForEach-Object { Write-Host (" - {0}" -f $_) }
}
