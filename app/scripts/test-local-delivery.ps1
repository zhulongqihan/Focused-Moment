$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

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
  $appRoot = Join-Path $Root "app"
  New-Item -ItemType Directory -Path (Join-Path $appRoot "src-tauri\target\release") -Force | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $appRoot "src-tauri\target\debug") -Force | Out-Null
  Set-Content -LiteralPath (Join-Path $appRoot "src-tauri\target\release\focused-moment.exe") -Value "new-release-candidate" -NoNewline
  Set-Content -LiteralPath (Join-Path $appRoot "src-tauri\target\debug\focused-moment.exe") -Value "debug-candidate" -NoNewline
  Set-Content -LiteralPath (Join-Path $appRoot "package.json") -Value '{"version":"2.11.10"}' -NoNewline
  if ($WithExistingRoot) {
    Set-Content -LiteralPath (Join-Path $Root "Focused Moment.exe") -Value "old-delivered-entry" -NoNewline
  }
}

function Get-TextHash {
  param([string]$Path)
  return Get-LocalDeliveryFileHash -Path $Path
}

$nativeSmokeSource = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot "windows-native-smoke.ps1")
Assert-Condition -Condition ($nativeSmokeSource -match 'Get-Process\s+-Name\s+@\("Focused Moment",\s*"focused-moment"\)') -Message "Windows smoke refuses to launch beside either executable process name"

$fixtureVersionReader = {
  param($path)
  [pscustomobject]@{ FileVersion = "2.11.10"; ProductVersion = "2.11.10" }
}
$mismatchedProductVersionReader = {
  param($path)
  [pscustomobject]@{ FileVersion = "2.11.10.0"; ProductVersion = "2.11.9" }
}
$rootProcessNotRunning = { $false }
$rootProcessRunning = { $true }

try {
  New-Fixture -Root $fixtureRoot
  $fixtureAppRoot = Join-Path $fixtureRoot "app"
  $candidate = Join-Path $fixtureAppRoot "src-tauri\target\release\focused-moment.exe"
  $rootEntry = Join-Path $fixtureRoot "Focused Moment.exe"
  $oldHash = Get-TextHash -Path $rootEntry
  $candidateHash = Get-TextHash -Path $candidate

  $success = Publish-LocalExecutable -AppRoot $fixtureAppRoot -WorkspaceRoot $fixtureRoot -CandidatePath $candidate -ExpectedVersion "2.11.10" -BuildId "fixture-success" -VersionReader $fixtureVersionReader -RootProcessProbe $rootProcessNotRunning
  Assert-Condition -Condition ((Get-Content -Raw -LiteralPath $rootEntry) -eq "new-release-candidate") -Message "successful delivery replaces the root entry"
  Assert-Condition -Condition ((Get-TextHash -Path $rootEntry) -eq $candidateHash) -Message "successful delivery preserves the candidate hash"
  Assert-Condition -Condition ((Get-TextHash -Path $success.archivePath) -eq $oldHash) -Message "successful delivery keeps a verified previous-entry backup"
  $successManifest = Get-Content -Raw -LiteralPath $success.manifestPath | ConvertFrom-Json
  Assert-Condition -Condition ($successManifest.rootExecutable.sha256 -eq $candidateHash) -Message "manifest records the root hash"
  Assert-Condition -Condition ($successManifest.candidate.versionInfo.fileVersion -eq "2.11.10" -and $successManifest.candidate.versionInfo.productVersion -eq "2.11.10") -Message "manifest records both executable version resources"

  New-Fixture -Root $fixtureRoot
  $oldHash = Get-TextHash -Path $rootEntry
  $candidateHash = Get-TextHash -Path $candidate
  $preserved = Publish-LocalExecutable -AppRoot $fixtureAppRoot -WorkspaceRoot $fixtureRoot -CandidatePath $candidate -ExpectedVersion "2.11.10" -BuildId "fixture-root-in-use" -RootProcessProbe $rootProcessRunning -VersionReader $fixtureVersionReader
  Assert-Condition -Condition ((Get-Content -Raw -LiteralPath $rootEntry) -eq "old-delivered-entry") -Message "candidate-only delivery leaves an in-use root entry unchanged"
  Assert-Condition -Condition ((Get-TextHash -Path $preserved.stagedCandidatePath) -eq $candidateHash) -Message "candidate-only delivery preserves the verified Release candidate"
  Assert-Condition -Condition ($null -eq $preserved.archivePath) -Message "candidate-only delivery does not claim a backup it cannot safely copy"
  Assert-Condition -Condition (-not $preserved.rootUpdated -and $preserved.phase -eq "candidate-only-root-in-use") -Message "candidate-only delivery reports root replacement as deferred"
  $preservedManifest = Get-Content -Raw -LiteralPath $preserved.manifestPath | ConvertFrom-Json
  Assert-Condition -Condition ($preservedManifest.candidate.sha256 -eq $candidateHash -and $preservedManifest.rootExecutable.sha256 -eq $oldHash) -Message "candidate-only manifest distinguishes candidate and unchanged root hashes"
  Assert-Condition -Condition ($preservedManifest.delivery.status -eq "candidate-only-root-in-use" -and -not $preservedManifest.delivery.rootReplacementCompleted -and $preservedManifest.delivery.reason -eq "focused-moment-process-running") -Message "candidate-only manifest records the deferred root replacement"
  Assert-Condition -Condition ($null -eq $preservedManifest.previousRoot.backupPath -and -not $preservedManifest.recovery.rollbackSupported -and $preservedManifest.recovery.rootEntryPreserved) -Message "candidate-only manifest records the unchanged in-use root without claiming a rollback copy"
  $preservedJournal = Get-Content -Raw -LiteralPath $preserved.journalPath | ConvertFrom-Json
  Assert-Condition -Condition ($preservedJournal.phase -eq "delivered" -and $preservedJournal.rootReplacementDeferred) -Message "candidate-only journal records completion without root replacement"

  New-Fixture -Root $fixtureRoot
  Assert-Throws -Name "executable version mismatch" -Action {
    Publish-LocalExecutable -AppRoot $fixtureAppRoot -WorkspaceRoot $fixtureRoot -CandidatePath $candidate -ExpectedVersion "2.11.10" -BuildId "fixture-version-mismatch" -VersionReader $mismatchedProductVersionReader -RootProcessProbe $rootProcessNotRunning | Out-Null
  }
  Assert-Condition -Condition ((Get-Content -Raw -LiteralPath $rootEntry) -eq "old-delivered-entry") -Message "version mismatch leaves the previous root entry untouched"
  Assert-Condition -Condition (-not (Test-Path -LiteralPath (Join-Path $fixtureRoot "artifacts\builds\local\fixture-version-mismatch"))) -Message "version mismatch is rejected before delivery records are created"

  New-Fixture -Root $fixtureRoot
  $copyFailure = {
    param($sourcePath, $destinationPath)
    if ([System.IO.Path]::GetFileName($destinationPath) -eq "Focused Moment.exe") {
      throw "fixture copy failure"
    }
    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
  }
  Assert-Throws -Name "root copy failure" -Action {
    Publish-LocalExecutable -AppRoot $fixtureAppRoot -WorkspaceRoot $fixtureRoot -CandidatePath $candidate -ExpectedVersion "2.11.10" -BuildId "fixture-copy-failure" -CopyAction $copyFailure -VersionReader $fixtureVersionReader -RootProcessProbe $rootProcessNotRunning | Out-Null
  }
  Assert-Condition -Condition ((Get-Content -Raw -LiteralPath $rootEntry) -eq "old-delivered-entry") -Message "copy failure leaves the previous root entry untouched"
  Assert-Condition -Condition (-not (Test-Path -LiteralPath (Join-Path $fixtureRoot "archive\executables\local\fixture-copy-failure\Focused Moment.exe"))) -Message "copy failure does not claim an unverified backup"

  New-Fixture -Root $fixtureRoot
  Remove-Item -LiteralPath $candidate -Force
  Assert-Throws -Name "missing release candidate" -Action {
    Publish-LocalExecutable -AppRoot $fixtureAppRoot -WorkspaceRoot $fixtureRoot -CandidatePath $candidate -ExpectedVersion "2.11.10" -BuildId "fixture-missing" -VersionReader $fixtureVersionReader -RootProcessProbe $rootProcessNotRunning | Out-Null
  }
  Assert-Condition -Condition ((Get-Content -Raw -LiteralPath $rootEntry) -eq "old-delivered-entry") -Message "missing candidate leaves the previous root entry untouched"

  New-Fixture -Root $fixtureRoot
  $debugCandidate = Join-Path $fixtureAppRoot "src-tauri\target\debug\focused-moment.exe"
  Assert-Throws -Name "debug artifact isolation" -Action {
    Publish-LocalExecutable -AppRoot $fixtureAppRoot -WorkspaceRoot $fixtureRoot -CandidatePath $debugCandidate -ExpectedVersion "2.11.10" -BuildId "fixture-debug" -VersionReader $fixtureVersionReader -RootProcessProbe $rootProcessNotRunning | Out-Null
  }
  Assert-Condition -Condition ((Get-Content -Raw -LiteralPath $rootEntry) -eq "old-delivered-entry") -Message "debug artifact cannot replace the root entry"

  New-Fixture -Root $fixtureRoot
  $manifestFailure = {
    param($manifestPath, $manifestValue)
    throw "fixture manifest failure"
  }
  Assert-Throws -Name "manifest failure" -Action {
    Publish-LocalExecutable -AppRoot $fixtureAppRoot -WorkspaceRoot $fixtureRoot -CandidatePath $candidate -ExpectedVersion "2.11.10" -BuildId "fixture-manifest-failure" -ManifestWriter $manifestFailure -VersionReader $fixtureVersionReader -RootProcessProbe $rootProcessNotRunning | Out-Null
  }
  Assert-Condition -Condition ((Get-Content -Raw -LiteralPath $rootEntry) -eq "old-delivered-entry") -Message "manifest failure restores the previous root entry"
  Assert-Condition -Condition ((Get-TextHash -Path (Join-Path $fixtureRoot "archive\executables\local\fixture-manifest-failure\Focused Moment.exe")) -eq $oldHash) -Message "manifest failure retains the recovery backup"

  New-Fixture -Root $fixtureRoot
  $fingerprintBefore = Get-LocalDeliveryInputFingerprint -AppRoot $fixtureAppRoot
  Set-Content -LiteralPath (Join-Path $fixtureAppRoot "package.json") -Value '{"version":"changed"}' -NoNewline
  $fingerprintAfter = Get-LocalDeliveryInputFingerprint -AppRoot $fixtureAppRoot
  Assert-Throws -Name "build input mismatch" -Action {
    Assert-LocalDeliveryInputFingerprintUnchanged -Before $fingerprintBefore -After $fingerprintAfter
  }

  New-Fixture -Root $fixtureRoot -WithExistingRoot $false
  $noPreviousEntry = Publish-LocalExecutable -AppRoot $fixtureAppRoot -WorkspaceRoot $fixtureRoot -CandidatePath $candidate -ExpectedVersion "2.11.10" -BuildId "fixture-no-previous-entry" -VersionReader $fixtureVersionReader -RootProcessProbe $rootProcessNotRunning
  Assert-Condition -Condition ((Get-Content -Raw -LiteralPath $rootEntry) -eq "new-release-candidate") -Message "delivery can create the root entry when none existed"
  Assert-Condition -Condition ($null -eq $noPreviousEntry.archivePath) -Message "delivery reports no backup when no previous root entry existed"

  Write-Output (ConvertTo-Json ([ordered]@{
    success = $true
    cases = @(
      "success",
      "root-process-probe-candidate-only",
      "windows-smoke-process-guard",
      "executable-version-mismatch",
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
