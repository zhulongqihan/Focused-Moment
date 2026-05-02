param(
  [string]$Tag,
  [string]$Title,
  [string]$Notes,
  [string]$NotesFile,
  [ValidateSet("debug", "release")]
  [string]$Profile = "release",
  [switch]$Latest
)

$ErrorActionPreference = "Stop"

function Initialize-Utf8Console {
  try {
    [Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
  } catch {
    Write-Warning "Unable to switch console encoding to UTF-8."
  }

  try {
    $global:OutputEncoding = [System.Text.UTF8Encoding]::new($false)
  } catch {
    Write-Warning "Unable to update PowerShell output encoding."
  }
}

function Write-Utf8File {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string]$Content
  )

  $parent = Split-Path -Parent $Path
  if ($parent) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }

  $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

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
$packageJson = Join-Path $projectRoot "package.json"
$releaseDir = Join-Path $projectRoot ".release"
$notesTempPath = $null
$package = Get-Content -Raw $packageJson | ConvertFrom-Json
$currentVersion = $package.version

Initialize-Utf8Console

if (-not $Tag) {
  $Tag = "v{0}" -f $currentVersion
}

if (-not $Title) {
  $Title = "Focused Moment {0}" -f $Tag
}

if (-not $NotesFile -and -not $Notes) {
  $defaultNotesFile = Join-Path $projectRoot ("docs\{0}\RELEASE_NOTES.md" -f $Tag)
  if (Test-Path -LiteralPath $defaultNotesFile) {
    $NotesFile = $defaultNotesFile
  }
}

if ($NotesFile) {
  if (-not (Test-Path -LiteralPath $NotesFile)) {
    throw "Notes file not found: $NotesFile"
  }
} elseif ($Notes) {
  $notesTempPath = Join-Path $releaseDir ("release-notes-{0}.md" -f $currentVersion)
  Write-Utf8File -Path $notesTempPath -Content $Notes
  $NotesFile = $notesTempPath
} else {
  $notesTempPath = Join-Path $releaseDir ("release-notes-{0}.md" -f $currentVersion)
  $defaultNotes = @"
Focused Moment $Tag

- Windows executable files for this version are attached
- See the repository README and commit history for details
"@
  Write-Utf8File -Path $notesTempPath -Content $defaultNotes
  $NotesFile = $notesTempPath
}

$manifestPath = Join-Path $releaseDir ("artifacts.{0}.json" -f $Profile)

$assets = @()
if (Test-Path -LiteralPath $manifestPath) {
  try {
    $manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
    if ($manifest.tag -eq $Tag) {
      if ($manifest.appAssetPath -and (Test-Path -LiteralPath $manifest.appAssetPath)) {
        $assets += $manifest.appAssetPath
      }
      if ($manifest.setupAssetPath -and (Test-Path -LiteralPath $manifest.setupAssetPath)) {
        $assets += $manifest.setupAssetPath
      }
    }
  } catch {
    Write-Warning "Unable to read build artifact manifest: $manifestPath"
  }
}

if ($assets.Count -eq 0) {
  $versionedExe = Join-Path $projectRoot ("Focused Moment {0}.exe" -f $Tag)
  $versionedSetup = Join-Path $projectRoot ("Focused Moment Setup {0}.exe" -f $Tag)

  if (Test-Path -LiteralPath $versionedExe) {
    $assets += $versionedExe
  }
  if (Test-Path -LiteralPath $versionedSetup) {
    $assets += $versionedSetup
  }
}

if ($assets.Count -eq 0) {
  throw "No release assets were found for $Tag. Export the root artifacts first."
}

Clear-BrokenProxyEnv
$script:ghPath = Resolve-GhPath

$releaseExists = $true
try {
  Invoke-Gh -Arguments @("release", "view", $Tag)
} catch {
  $releaseExists = $false
}

if ($releaseExists) {
  $editArgs = @("release", "edit", $Tag, "--title", $Title)
  if ($NotesFile) {
    $editArgs += @("--notes-file", $NotesFile)
  }
  if ($Latest) {
    $editArgs += "--latest"
  }
  Invoke-Gh -Arguments $editArgs
  Invoke-Gh -Arguments (@("release", "upload", $Tag, "--clobber") + $assets)
  Write-Host ("Updated GitHub Release: {0}" -f $Tag)
} else {
  $createArgs = @("release", "create", $Tag) + $assets + @("--title", $Title)
  if ($NotesFile) {
    $createArgs += @("--notes-file", $NotesFile)
  }
  if ($Latest) {
    $createArgs += "--latest"
  }
  Invoke-Gh -Arguments $createArgs
  Write-Host ("Created GitHub Release: {0}" -f $Tag)
}

foreach ($asset in $assets) {
  Write-Host (" - {0}" -f $asset)
}
