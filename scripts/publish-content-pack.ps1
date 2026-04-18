param(
  [string]$Tag = "content-cn-stable",
  [string]$Title = "Focused Moment 国服内容快照",
  [string]$Notes,
  [switch]$Latest
)

$ErrorActionPreference = "Stop"

function Clear-BrokenProxyEnv {
  $proxyVars = @("ALL_PROXY", "HTTP_PROXY", "HTTPS_PROXY", "GIT_HTTP_PROXY", "GIT_HTTPS_PROXY")
  foreach ($name in $proxyVars) {
    $value = [Environment]::GetEnvironmentVariable($name)
    if ($value -and $value -match "127\.0\.0\.1:9") {
      [Environment]::SetEnvironmentVariable($name, "", "Process")
    }
  }
}

function Resolve-GhPath {
  $candidates = @(
    "C:\Program Files\GitHub CLI\gh.exe",
    "C:\Users\yang\AppData\Local\Programs\GitHub CLI\gh.exe"
  )

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }

  throw "GitHub CLI (gh) was not found. Please install gh first."
}

function Invoke-Gh {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  & $script:ghPath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "gh command failed: $($Arguments -join ' ')"
  }
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$contentDir = Join-Path $projectRoot ".release\content"
$manifestPath = Join-Path $contentDir "focused-moment-content-cn-manifest.json"
$packPath = Join-Path $contentDir "focused-moment-content-cn-pack.json"

if (-not (Test-Path -LiteralPath $manifestPath)) {
  throw "Manifest not found: $manifestPath. Please run pnpm content:build first."
}

if (-not (Test-Path -LiteralPath $packPath)) {
  throw "Pack file not found: $packPath. Please run pnpm content:build first."
}

$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json

if (-not $Notes) {
  $Notes = @"
Focused Moment 国服内容快照

- 内容版本：$($manifest.packVersion)
- 干员数量：$($manifest.operatorCount)
- 卡池数量：$($manifest.bannerCount)
- 资源文件：
  - focused-moment-content-cn-manifest.json
  - focused-moment-content-cn-pack.json
"@
}

Clear-BrokenProxyEnv
$script:ghPath = Resolve-GhPath

$releaseExists = $true
try {
  Invoke-Gh -Arguments @("release", "view", $Tag)
} catch {
  $releaseExists = $false
}

$assets = @($manifestPath, $packPath)

if ($releaseExists) {
  $editArgs = @("release", "edit", $Tag, "--title", $Title, "--notes", $Notes)
  if ($Latest) {
    $editArgs += "--latest"
  }
  Invoke-Gh -Arguments $editArgs
  Invoke-Gh -Arguments (@("release", "upload", $Tag, "--clobber") + $assets)
  Write-Host ("Updated content release: {0}" -f $Tag)
} else {
  $createArgs = @("release", "create", $Tag) + $assets + @("--title", $Title, "--notes", $Notes)
  if ($Latest) {
    $createArgs += "--latest"
  }
  Invoke-Gh -Arguments $createArgs
  Write-Host ("Created content release: {0}" -f $Tag)
}

foreach ($asset in $assets) {
  Write-Host (" - {0}" -f $asset)
}
