param(
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
$modulePath = Join-Path $PSScriptRoot "local-delivery.psm1"
Import-Module -Name $modulePath -Force

$package = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "package.json") | ConvertFrom-Json
$version = [string]$package.version
$buildId = "local-{0}-{1}" -f (Get-Date -Format "yyyyMMdd-HHmmss"), ([guid]::NewGuid().ToString("N").Substring(0, 10))
$localDirectory = Join-Path $projectRoot ".release\local\$buildId"
$buildStartedAt = (Get-Date).ToUniversalTime()

New-Item -ItemType Directory -Path $localDirectory -Force | Out-Null
$before = Get-LocalDeliveryInputFingerprint -ProjectRoot $projectRoot
Write-LocalDeliveryJson -Path (Join-Path $localDirectory "build-inputs.before.json") -Value $before

if (-not $SkipBuild) {
  Push-Location -LiteralPath $projectRoot
  try {
    Write-Host "==> Building the release executable without installers"
    & pnpm.cmd tauri build --no-bundle
    if ($LASTEXITCODE -ne 0) {
      throw "Tauri release build failed with exit code $LASTEXITCODE."
    }
  } finally {
    Pop-Location
  }
}

$after = Get-LocalDeliveryInputFingerprint -ProjectRoot $projectRoot
Write-LocalDeliveryJson -Path (Join-Path $localDirectory "build-inputs.after.json") -Value $after
Assert-LocalDeliveryInputFingerprintUnchanged -Before $before -After $after

$candidatePath = Join-Path $projectRoot "src-tauri\target\release\focused-moment.exe"
if (-not (Test-Path -LiteralPath $candidatePath -PathType Leaf)) {
  throw "The release build did not produce the expected candidate: $candidatePath"
}
$candidateTimestamp = (Get-Item -LiteralPath $candidatePath).LastWriteTimeUtc
if (-not $SkipBuild -and $candidateTimestamp -lt $buildStartedAt) {
  throw "The release candidate predates this build invocation: $candidatePath"
}

$publishParameters = @{
  ProjectRoot = $projectRoot
  CandidatePath = $candidatePath
  ExpectedVersion = $version
  BuildId = $buildId
  InputFingerprint = $after
  LocalRecordDirectory = $localDirectory
}
$result = Publish-LocalExecutable @publishParameters

Write-Host "Local executable delivery succeeded."
Write-Host (" - build ID: {0}" -f $result.buildId)
Write-Host (" - root executable: {0}" -f $result.rootExecutablePath)
Write-Host (" - SHA-256: {0}" -f $result.sha256)
Write-Host (" - manifest: {0}" -f $result.manifestPath)
Write-Host (" - journal: {0}" -f $result.journalPath)
