$ErrorActionPreference = "Stop"

$appRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $appRoot
$packageJson = Join-Path $appRoot "package.json"
$package = Get-Content -Raw $packageJson | ConvertFrom-Json
$currentVersion = $package.version
$releaseDir = Join-Path $workspaceRoot "artifacts\builds\exports"

$keepFiles = @(
  ("Focused Moment v{0}.exe" -f $currentVersion),
  ("Focused Moment Setup v{0}.exe" -f $currentVersion)
)

$manifestFiles = @(Get-ChildItem -LiteralPath $releaseDir -Filter "artifacts.*.json" -File -Recurse -ErrorAction SilentlyContinue)

foreach ($manifestFile in $manifestFiles) {
  try {
    $manifest = Get-Content -Raw -LiteralPath $manifestFile.FullName | ConvertFrom-Json
    $paths = @($manifest.appAssetPath, $manifest.setupAssetPath)
    foreach ($path in $paths) {
      if ($path) {
        $keepFiles += [System.IO.Path]::GetFullPath($path)
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
  Get-ChildItem -LiteralPath $releaseDir -Filter $pattern -File -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $keepFiles -notcontains $_.Name -and $keepFiles -notcontains $_.FullName } |
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
