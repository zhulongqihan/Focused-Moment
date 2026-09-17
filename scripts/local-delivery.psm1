Set-StrictMode -Version Latest

$ErrorActionPreference = "Stop"

function Get-LocalDeliveryAbsolutePath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  return [System.IO.Path]::GetFullPath($Path)
}

function Test-LocalDeliveryPathInside {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string]$Parent
  )

  $absolutePath = Get-LocalDeliveryAbsolutePath -Path $Path
  $absoluteParent = (Get-LocalDeliveryAbsolutePath -Path $Parent).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
  return $absolutePath.StartsWith($absoluteParent, [System.StringComparison]::OrdinalIgnoreCase)
}

function ConvertTo-LocalDeliveryRelativePath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string]$Root
  )

  $absolutePath = Get-LocalDeliveryAbsolutePath -Path $Path
  $absoluteRoot = (Get-LocalDeliveryAbsolutePath -Path $Root).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
  if (-not $absolutePath.StartsWith($absoluteRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Path is outside the project root: $absolutePath"
  }

  return $absolutePath.Substring($absoluteRoot.Length).Replace([System.IO.Path]::DirectorySeparatorChar, "/")
}

function Get-LocalDeliveryFileHash {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "File not found for hashing: $Path"
  }

  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  $stream = [System.IO.File]::OpenRead($Path)
  try {
    return ([System.BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace("-", "").ToUpperInvariant()
  } finally {
    $stream.Dispose()
    $algorithm.Dispose()
  }
}

function Get-LocalDeliveryInputFiles {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot
  )

  $root = Get-LocalDeliveryAbsolutePath -Path $ProjectRoot
  $fileMap = @{}

  $sourceDirectories = @(
    (Join-Path $root "src"),
    (Join-Path $root "src-tauri"),
    (Join-Path $root "public"),
    (Join-Path $root "scripts")
  )

  foreach ($directory in $sourceDirectories) {
    if (-not (Test-Path -LiteralPath $directory -PathType Container)) {
      continue
    }

    Get-ChildItem -LiteralPath $directory -File -Recurse -Force | Where-Object {
      $_.FullName -notmatch "[\\/]target[\\/]" -and
      $_.FullName -notmatch "[\\/]node_modules[\\/]" -and
      $_.FullName -notmatch "[\\/]dist[\\/]" -and
      $_.FullName -notmatch "[\\/]output[\\/]" -and
      $_.FullName -notmatch "[\\/]\.release[\\/]"
    } | ForEach-Object {
      $fileMap[(Get-LocalDeliveryAbsolutePath -Path $_.FullName).ToLowerInvariant()] = $_.FullName
    }
  }

  $rootInputNames = @(
    "index.html",
    "package.json",
    "pnpm-lock.yaml",
    "tsconfig.json",
    "tsconfig.node.json",
    "vite.config.mjs",
    "vite.config.ts",
    "vite.config.js"
  )

  foreach ($name in $rootInputNames) {
    $path = Join-Path $root $name
    if (Test-Path -LiteralPath $path -PathType Leaf) {
      $fileMap[(Get-LocalDeliveryAbsolutePath -Path $path).ToLowerInvariant()] = $path
    }
  }

  return @(
    $fileMap.Values |
      Sort-Object { ConvertTo-LocalDeliveryRelativePath -Path $_ -Root $root }
  )
}

function Get-LocalDeliveryInputFingerprint {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot
  )

  $root = Get-LocalDeliveryAbsolutePath -Path $ProjectRoot
  $entries = @(
    Get-LocalDeliveryInputFiles -ProjectRoot $root | ForEach-Object {
      [ordered]@{
        path = ConvertTo-LocalDeliveryRelativePath -Path $_ -Root $root
        sha256 = Get-LocalDeliveryFileHash -Path $_
        length = (Get-Item -LiteralPath $_).Length
      }
    }
  )

  $canonicalLines = @($entries | ForEach-Object { "{0}`t{1}`t{2}" -f $_.path, $_.sha256, $_.length })
  $canonicalContent = $canonicalLines -join "`n"
  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try {
    $digest = ([System.BitConverter]::ToString($sha256.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($canonicalContent)))).Replace("-", "").ToUpperInvariant()
  } finally {
    $sha256.Dispose()
  }

  return [ordered]@{
    algorithm = "SHA-256"
    digest = $digest
    fileCount = $entries.Count
    files = $entries
    capturedAt = (Get-Date).ToUniversalTime().ToString("o")
  }
}

function Assert-LocalDeliveryInputFingerprintUnchanged {
  param(
    [Parameter(Mandatory = $true)]
    [object]$Before,
    [Parameter(Mandatory = $true)]
    [object]$After
  )

  if ($Before.digest -ne $After.digest -or $Before.fileCount -ne $After.fileCount) {
    throw "Build input fingerprint changed during the build. Delivery was not attempted. Before: $($Before.digest); after: $($After.digest)."
  }
}

function Invoke-LocalDeliveryGit {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  Push-Location -LiteralPath $ProjectRoot
  try {
    $result = & git @Arguments 2>$null
    if ($LASTEXITCODE -ne 0) {
      return $null
    }
    return (($result | ForEach-Object { [string]$_ }) -join [Environment]::NewLine).TrimEnd()
  } finally {
    Pop-Location
  }
}

function Get-LocalDeliveryRepositoryState {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,
    [Parameter(Mandatory = $true)]
    [object]$InputFingerprint
  )

  $head = Invoke-LocalDeliveryGit -ProjectRoot $ProjectRoot -Arguments @("rev-parse", "HEAD")
  $branch = Invoke-LocalDeliveryGit -ProjectRoot $ProjectRoot -Arguments @("branch", "--show-current")
  $status = Invoke-LocalDeliveryGit -ProjectRoot $ProjectRoot -Arguments @("status", "--short", "--untracked-files=all")
  $dirtyPaths = @(
    $status -split "`r?`n" | Where-Object { $_.Trim().Length -gt 0 } | ForEach-Object {
      if ($_.Length -gt 3) { $_.Substring(3).Trim() } else { $_.Trim() }
    }
  )
  $inputPaths = @($InputFingerprint.files | ForEach-Object { $_.path })
  $relevantDirtyPaths = @($dirtyPaths | Where-Object { $inputPaths -contains ($_ -replace "\\", "/") })

  return [ordered]@{
    head = if ($head) { $head } else { "unknown" }
    branch = if ($branch) { $branch } else { "detached" }
    dirty = $dirtyPaths.Count -gt 0
    dirtyPaths = $dirtyPaths
    relevantBuildInputDirty = $relevantDirtyPaths.Count -gt 0
    relevantDirtyPaths = $relevantDirtyPaths
  }
}

function Write-LocalDeliveryJson {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [object]$Value
  )

  $parent = Split-Path -Parent $Path
  if ($parent) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, ($Value | ConvertTo-Json -Depth 20), $utf8NoBom)
}

function Invoke-LocalDeliveryCopy {
  param(
    [Parameter(Mandatory = $true)]
    [scriptblock]$CopyAction,
    [Parameter(Mandatory = $true)]
    [string]$Source,
    [Parameter(Mandatory = $true)]
    [string]$Destination
  )

  & $CopyAction $Source $Destination
  if (-not (Test-Path -LiteralPath $Destination -PathType Leaf)) {
    throw "Copy action completed without creating the destination: $Destination"
  }
}

function Publish-LocalExecutable {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,
    [Parameter(Mandatory = $true)]
    [string]$CandidatePath,
    [Parameter(Mandatory = $true)]
    [string]$ExpectedVersion,
    [Parameter(Mandatory = $true)]
    [string]$BuildId,
    [object]$InputFingerprint,
    [string]$RootExecutablePath,
    [string]$LocalRecordDirectory,
    [string]$ArchiveDirectory,
    [scriptblock]$CopyAction = {
      param($sourcePath, $destinationPath)
      Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
    },
    [scriptblock]$ManifestWriter = {
      param($manifestPath, $manifestValue)
      Write-LocalDeliveryJson -Path $manifestPath -Value $manifestValue
    }
  )

  $root = Get-LocalDeliveryAbsolutePath -Path $ProjectRoot
  $candidate = Get-LocalDeliveryAbsolutePath -Path $CandidatePath
  $expectedCandidate = Get-LocalDeliveryAbsolutePath -Path (Join-Path $root "src-tauri\target\release\focused-moment.exe")
  if (-not [System.StringComparer]::OrdinalIgnoreCase.Equals($candidate, $expectedCandidate)) {
    throw "Only the release candidate is deliverable: $expectedCandidate"
  }
  if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
    throw "Release candidate not found: $candidate"
  }
  if ($candidate -match "[\\/]debug[\\/]") {
    throw "Debug artifacts cannot be delivered to the root entry: $candidate"
  }

  $rootExecutable = if ($RootExecutablePath) { Get-LocalDeliveryAbsolutePath -Path $RootExecutablePath } else { Join-Path $root "Focused Moment.exe" }
  if (-not (Test-LocalDeliveryPathInside -Path $rootExecutable -Parent $root)) {
    throw "Root executable must remain inside the project root: $rootExecutable"
  }

  $localDirectory = if ($LocalRecordDirectory) { Get-LocalDeliveryAbsolutePath -Path $LocalRecordDirectory } else { Join-Path $root ".release\local\$BuildId" }
  $archiveDirectoryPath = if ($ArchiveDirectory) { Get-LocalDeliveryAbsolutePath -Path $ArchiveDirectory } else { Join-Path $root ".release\archive\$BuildId" }
  New-Item -ItemType Directory -Path $localDirectory -Force | Out-Null
  New-Item -ItemType Directory -Path $archiveDirectoryPath -Force | Out-Null

  $journalPath = Join-Path $localDirectory "delivery-journal.json"
  $manifestPath = Join-Path $localDirectory "manifest.json"
  $stagedCandidatePath = Join-Path $localDirectory "Focused Moment.exe.candidate"
  $backupPath = Join-Path $archiveDirectoryPath "Focused Moment.exe"
  $candidateHash = Get-LocalDeliveryFileHash -Path $candidate
  $rootExisted = Test-Path -LiteralPath $rootExecutable -PathType Leaf
  $previousRootHash = if ($rootExisted) { Get-LocalDeliveryFileHash -Path $rootExecutable } else { $null }
  $repositoryState = if ($InputFingerprint) { Get-LocalDeliveryRepositoryState -ProjectRoot $root -InputFingerprint $InputFingerprint } else { $null }

  $journal = [ordered]@{
    schemaVersion = 1
    buildId = $BuildId
    version = $ExpectedVersion
    profile = "release"
    phase = "candidate-validated"
    candidatePath = ConvertTo-LocalDeliveryRelativePath -Path $candidate -Root $root
    candidateSha256 = $candidateHash
    rootPath = ConvertTo-LocalDeliveryRelativePath -Path $rootExecutable -Root $root
    rootExisted = $rootExisted
    previousRootSha256 = $previousRootHash
    backupPath = ConvertTo-LocalDeliveryRelativePath -Path $backupPath -Root $root
    manifestPath = ConvertTo-LocalDeliveryRelativePath -Path $manifestPath -Root $root
    startedAt = (Get-Date).ToUniversalTime().ToString("o")
  }
  Write-LocalDeliveryJson -Path $journalPath -Value $journal

  $restoreRoot = {
    if ($rootExisted) {
      if (-not (Test-Path -LiteralPath $backupPath -PathType Leaf)) {
        throw "Cannot restore the previous root executable because its backup is missing: $backupPath"
      }
      Invoke-LocalDeliveryCopy -CopyAction $CopyAction -Source $backupPath -Destination $rootExecutable
      $restoredHash = Get-LocalDeliveryFileHash -Path $rootExecutable
      if ($restoredHash -ne $previousRootHash) {
        throw "Root executable recovery hash mismatch. Expected $previousRootHash, got $restoredHash."
      }
    } elseif (Test-Path -LiteralPath $rootExecutable -PathType Leaf) {
      Remove-Item -LiteralPath $rootExecutable -Force
    }
  }

  try {
    if ($rootExisted) {
      Invoke-LocalDeliveryCopy -CopyAction $CopyAction -Source $rootExecutable -Destination $backupPath
      $backupHash = Get-LocalDeliveryFileHash -Path $backupPath
      if ($backupHash -ne $previousRootHash) {
        throw "Previous root backup hash mismatch. Expected $previousRootHash, got $backupHash."
      }
    }
    $journal.phase = "root-backed-up"
    Write-LocalDeliveryJson -Path $journalPath -Value $journal

    Invoke-LocalDeliveryCopy -CopyAction $CopyAction -Source $candidate -Destination $stagedCandidatePath
    $stagedHash = Get-LocalDeliveryFileHash -Path $stagedCandidatePath
    if ($stagedHash -ne $candidateHash) {
      throw "Staged candidate hash mismatch. Expected $candidateHash, got $stagedHash."
    }
    $journal.phase = "candidate-staged"
    Write-LocalDeliveryJson -Path $journalPath -Value $journal

    Invoke-LocalDeliveryCopy -CopyAction $CopyAction -Source $stagedCandidatePath -Destination $rootExecutable
    $rootHash = Get-LocalDeliveryFileHash -Path $rootExecutable
    if ($rootHash -ne $candidateHash) {
      throw "Root executable hash mismatch. Expected $candidateHash, got $rootHash."
    }
    $journal.phase = "root-replaced"
    Write-LocalDeliveryJson -Path $journalPath -Value $journal

    $manifest = [ordered]@{
      schemaVersion = 1
      buildId = $BuildId
      version = $ExpectedVersion
      profile = "release"
      deliveredAt = (Get-Date).ToUniversalTime().ToString("o")
      candidate = [ordered]@{
        path = ConvertTo-LocalDeliveryRelativePath -Path $candidate -Root $root
        sha256 = $candidateHash
        length = (Get-Item -LiteralPath $candidate).Length
      }
      rootExecutable = [ordered]@{
        path = ConvertTo-LocalDeliveryRelativePath -Path $rootExecutable -Root $root
        sha256 = $rootHash
        length = (Get-Item -LiteralPath $rootExecutable).Length
      }
      previousRoot = [ordered]@{
        existed = $rootExisted
        sha256 = $previousRootHash
        backupPath = if ($rootExisted) { ConvertTo-LocalDeliveryRelativePath -Path $backupPath -Root $root } else { $null }
      }
      source = $repositoryState
      buildInputFingerprint = $InputFingerprint
      recovery = [ordered]@{
        journalPath = ConvertTo-LocalDeliveryRelativePath -Path $journalPath -Root $root
        backupPath = if ($rootExisted) { ConvertTo-LocalDeliveryRelativePath -Path $backupPath -Root $root } else { $null }
        rollbackSupported = $true
      }
    }

    & $ManifestWriter $manifestPath $manifest
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
      throw "Manifest writer completed without creating the manifest: $manifestPath"
    }
    $writtenManifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
    if ($writtenManifest.rootExecutable.sha256 -ne $candidateHash -or $writtenManifest.candidate.sha256 -ne $candidateHash) {
      throw "Delivery manifest does not match the delivered executable hash."
    }

    $journal.phase = "delivered"
    $journal.completedAt = (Get-Date).ToUniversalTime().ToString("o")
    Write-LocalDeliveryJson -Path $journalPath -Value $journal
    return [ordered]@{
      buildId = $BuildId
      manifestPath = $manifestPath
      journalPath = $journalPath
      archivePath = if ($rootExisted) { $backupPath } else { $null }
      candidatePath = $candidate
      rootExecutablePath = $rootExecutable
      sha256 = $candidateHash
      phase = "delivered"
    }
  } catch {
    $originalError = $_.Exception.Message
    $journal.phase = "delivery-failed"
    $journal.error = $originalError
    try {
      & $restoreRoot
      $journal.recovery = "previous-root-restored"
    } catch {
      $journal.recovery = "restore-failed: $($_.Exception.Message)"
    }
    Write-LocalDeliveryJson -Path $journalPath -Value $journal
    throw "Local executable delivery failed: $originalError. See $journalPath for phase and recovery details."
  }
}

Export-ModuleMember -Function @(
  "Get-LocalDeliveryFileHash",
  "Get-LocalDeliveryInputFiles",
  "Get-LocalDeliveryInputFingerprint",
  "Assert-LocalDeliveryInputFingerprintUnchanged",
  "Get-LocalDeliveryRepositoryState",
  "Write-LocalDeliveryJson",
  "Publish-LocalExecutable"
)
