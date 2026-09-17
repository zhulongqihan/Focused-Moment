$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
Import-Module -Name (Join-Path $PSScriptRoot "local-delivery.psm1") -Force

$fixtureRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("focused-moment-local-delivery-" + [guid]::NewGuid().ToString("N"))

function Assert-Condition {
  param(
    [Parameter(Mandatory = $true)]
    [bool]$Condition,
    [Parameter(Mandatory = $true)]
    [string]$Message
  )

  if (-not $Condition) {
    throw "Assertion failed: $Message"
  }
}

function Assert-Throws {
  param(
    [Parameter(Mandatory = $true)]
    [scriptblock]$Action,
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  $threw = $false
  try {
    & $Action
  } catch {
    $threw = $true
  }
  Assert-Condition -Condition $threw -Message "$Name must fail"
}

function New-Fixture {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Root,
    [bool]$WithExistingRoot = $true
  )

  if (Test-Path -LiteralPath $Root) {
    Remove-Item -LiteralPath $Root -Recurse -Force
  }
  New-Item -ItemType Directory -Path (Join-Path $Root "src-tauri\target\release") -Force | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $Root "src-tauri\target\debug") -Force | Out-Null
  Set-Content -LiteralPath (Join-Path $Root "src-tauri\target\release\focused-moment.exe") -Value "new-release-candidate" -NoNewline
  Set-Content -LiteralPath (Join-Path $Root "src-tauri\target\debug\focused-moment.exe") -Value "debug-candidate" -NoNewline
  Set-Content -LiteralPath (Join-Path $Root "package.json") -Value '{"version":"2.11.10"}' -NoNewline
  if ($WithExistingRoot) {
    Set-Content -LiteralPath (Join-Path $Root "Focused Moment.exe") -Value "old-delivered-entry" -NoNewline
  }
}

function Get-TextHash {
  param([string]$Path)
  return Get-LocalDeliveryFileHash -Path $Path
}

try {
  New-Fixture -Root $fixtureRoot
  $candidate = Join-Path $fixtureRoot "src-tauri\target\release\focused-moment.exe"
  $rootEntry = Join-Path $fixtureRoot "Focused Moment.exe"
  $oldHash = Get-TextHash -Path $rootEntry
  $candidateHash = Get-TextHash -Path $candidate

  $success = Publish-LocalExecutable -ProjectRoot $fixtureRoot -CandidatePath $candidate -ExpectedVersion "2.11.10" -BuildId "fixture-success"
  Assert-Condition -Condition ((Get-Content -Raw -LiteralPath $rootEntry) -eq "new-release-candidate") -Message "successful delivery replaces the root entry"
  Assert-Condition -Condition ((Get-TextHash -Path $rootEntry) -eq $candidateHash) -Message "successful delivery preserves the candidate hash"
  Assert-Condition -Condition ((Get-TextHash -Path $success.archivePath) -eq $oldHash) -Message "successful delivery keeps a verified previous-entry backup"
  $successManifest = Get-Content -Raw -LiteralPath $success.manifestPath | ConvertFrom-Json
  Assert-Condition -Condition ($successManifest.rootExecutable.sha256 -eq $candidateHash) -Message "manifest records the root hash"

  New-Fixture -Root $fixtureRoot
  $copyFailure = {
    param($sourcePath, $destinationPath)
    if ([System.IO.Path]::GetFileName($destinationPath) -eq "Focused Moment.exe") {
      throw "fixture copy failure"
    }
    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
  }
  Assert-Throws -Name "root copy failure" -Action {
    Publish-LocalExecutable -ProjectRoot $fixtureRoot -CandidatePath $candidate -ExpectedVersion "2.11.10" -BuildId "fixture-copy-failure" -CopyAction $copyFailure | Out-Null
  }
  Assert-Condition -Condition ((Get-Content -Raw -LiteralPath $rootEntry) -eq "old-delivered-entry") -Message "copy failure leaves the previous root entry untouched"
  Assert-Condition -Condition (-not (Test-Path -LiteralPath (Join-Path $fixtureRoot ".release\archive\fixture-copy-failure\Focused Moment.exe"))) -Message "copy failure does not claim an unverified backup"

  New-Fixture -Root $fixtureRoot
  Remove-Item -LiteralPath $candidate -Force
  Assert-Throws -Name "missing release candidate" -Action {
    Publish-LocalExecutable -ProjectRoot $fixtureRoot -CandidatePath $candidate -ExpectedVersion "2.11.10" -BuildId "fixture-missing" | Out-Null
  }
  Assert-Condition -Condition ((Get-Content -Raw -LiteralPath $rootEntry) -eq "old-delivered-entry") -Message "missing candidate leaves the previous root entry untouched"

  New-Fixture -Root $fixtureRoot
  $debugCandidate = Join-Path $fixtureRoot "src-tauri\target\debug\focused-moment.exe"
  Assert-Throws -Name "debug artifact isolation" -Action {
    Publish-LocalExecutable -ProjectRoot $fixtureRoot -CandidatePath $debugCandidate -ExpectedVersion "2.11.10" -BuildId "fixture-debug" | Out-Null
  }
  Assert-Condition -Condition ((Get-Content -Raw -LiteralPath $rootEntry) -eq "old-delivered-entry") -Message "debug artifact cannot replace the root entry"

  New-Fixture -Root $fixtureRoot
  $manifestFailure = {
    param($manifestPath, $manifestValue)
    throw "fixture manifest failure"
  }
  Assert-Throws -Name "manifest failure" -Action {
    Publish-LocalExecutable -ProjectRoot $fixtureRoot -CandidatePath $candidate -ExpectedVersion "2.11.10" -BuildId "fixture-manifest-failure" -ManifestWriter $manifestFailure | Out-Null
  }
  Assert-Condition -Condition ((Get-Content -Raw -LiteralPath $rootEntry) -eq "old-delivered-entry") -Message "manifest failure restores the previous root entry"
  Assert-Condition -Condition ((Get-TextHash -Path (Join-Path $fixtureRoot ".release\archive\fixture-manifest-failure\Focused Moment.exe")) -eq $oldHash) -Message "manifest failure retains the recovery backup"

  New-Fixture -Root $fixtureRoot
  $fingerprintBefore = Get-LocalDeliveryInputFingerprint -ProjectRoot $fixtureRoot
  Set-Content -LiteralPath (Join-Path $fixtureRoot "package.json") -Value '{"version":"changed"}' -NoNewline
  $fingerprintAfter = Get-LocalDeliveryInputFingerprint -ProjectRoot $fixtureRoot
  Assert-Throws -Name "build input mismatch" -Action {
    Assert-LocalDeliveryInputFingerprintUnchanged -Before $fingerprintBefore -After $fingerprintAfter
  }

  New-Fixture -Root $fixtureRoot -WithExistingRoot $false
  $noPreviousEntry = Publish-LocalExecutable -ProjectRoot $fixtureRoot -CandidatePath $candidate -ExpectedVersion "2.11.10" -BuildId "fixture-no-previous-entry"
  Assert-Condition -Condition ((Get-Content -Raw -LiteralPath $rootEntry) -eq "new-release-candidate") -Message "delivery can create the root entry when none existed"
  Assert-Condition -Condition ($null -eq $noPreviousEntry.archivePath) -Message "delivery reports no backup when no previous root entry existed"

  Write-Output (ConvertTo-Json ([ordered]@{
    success = $true
    cases = @(
      "success",
      "copy-failure",
      "missing-candidate",
      "debug-isolation",
      "manifest-failure-and-restore",
      "build-input-mismatch",
      "no-previous-entry"
    )
  }) -Depth 5)
} finally {
  if (Test-Path -LiteralPath $fixtureRoot) {
    Remove-Item -LiteralPath $fixtureRoot -Recurse -Force
  }
}
