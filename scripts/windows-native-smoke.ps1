param(
  [string]$ExecutablePath,
  [int]$TimeoutSeconds = 45,
  [string]$CleanupPath
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
Import-Module -Name (Join-Path $PSScriptRoot "local-delivery.psm1") -Force

function Remove-IsolatedFixture {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [switch]$TerminateReferencingProcesses
  )
  $absolutePath = [System.IO.Path]::GetFullPath($Path)
  $tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
  if (-not $absolutePath.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Cleanup path is outside the temporary directory: $absolutePath"
  }
  $leafName = [System.IO.Path]::GetFileName($absolutePath.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar))
  if ($leafName -notmatch '^focused-moment-windows-native-[a-f0-9]{32}$') {
    throw "Cleanup path is not a generated Windows native smoke fixture: $absolutePath"
  }
  $currentProcessIds = [System.Collections.Generic.HashSet[int]]::new()
  $processCursor = [int]$PID
  while ($processCursor -gt 0 -and $currentProcessIds.Add($processCursor)) {
    $currentProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $processCursor" -ErrorAction SilentlyContinue
    if (-not $currentProcess) { break }
    $processCursor = [int]$currentProcess.ParentProcessId
  }
  $matchingProcesses = @(Get-CimInstance Win32_Process | Where-Object { $currentProcessIds -notcontains $_.ProcessId -and $_.CommandLine -and $_.CommandLine -like "*$absolutePath*" })
  if ($matchingProcesses.Count -gt 0) {
    if (-not $TerminateReferencingProcesses) {
      throw "Refusing to remove a native smoke fixture while a process still references it."
    }
    foreach ($matchingProcess in $matchingProcesses) {
      Stop-Process -Id ([int]$matchingProcess.ProcessId) -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 1
  }
  for ($attempt = 1; $attempt -le 20; $attempt += 1) {
    if (-not (Test-Path -LiteralPath $absolutePath)) { return }
    try {
      Remove-Item -LiteralPath $absolutePath -Recurse -Force -ErrorAction Stop
      if (-not (Test-Path -LiteralPath $absolutePath)) { return }
    } catch {
      if ($attempt -eq 20) { throw }
      Start-Sleep -Seconds 1
    }
  }
}

if ($CleanupPath) {
  Remove-IsolatedFixture -Path $CleanupPath
  Write-Output "Removed isolated native smoke fixture: $CleanupPath"
  exit 0
}

function Get-AbsolutePath {
  param([Parameter(Mandatory = $true)][string]$Path)
  return [System.IO.Path]::GetFullPath($Path)
}

function Assert-Inside {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Parent
  )
  $absolutePath = Get-AbsolutePath -Path $Path
  $absoluteParent = (Get-AbsolutePath -Path $Parent).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
  if (-not $absolutePath.StartsWith($absoluteParent, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Path escaped isolation root: $absolutePath"
  }
}

function Write-Utf8Json {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Content
  )
  [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

function Start-IsolatedFocusedMoment {
  param(
    [Parameter(Mandatory = $true)][string]$Executable,
    [Parameter(Mandatory = $true)][string]$WorkingDirectory,
    [Parameter(Mandatory = $true)][hashtable]$Environment,
    [Parameter(Mandatory = $true)][string]$CanonicalStatePath,
    [Parameter(Mandatory = $true)][string]$WebViewPath,
    [Parameter(Mandatory = $true)][int]$Timeout
  )

  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $Executable
  $startInfo.WorkingDirectory = $WorkingDirectory
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  foreach ($entry in $Environment.GetEnumerator()) {
    $startInfo.Environment[$entry.Key] = [string]$entry.Value
  }

  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  if (-not $process.Start()) {
    throw "Failed to start isolated Focused Moment process."
  }

  $deadline = [DateTime]::UtcNow.AddSeconds($Timeout)
  while ([DateTime]::UtcNow -lt $deadline) {
    if ($process.HasExited) {
      throw "Isolated Focused Moment exited before its window and storage became ready (exit $($process.ExitCode))."
    }
    $process.Refresh()
    $hasWindow = $process.MainWindowHandle -ne [IntPtr]::Zero
    $hasCanonicalState = Test-Path -LiteralPath $CanonicalStatePath -PathType Leaf
    $hasWebViewData = Test-Path -LiteralPath $WebViewPath -PathType Container
    if ($hasWindow -and $hasCanonicalState -and $hasWebViewData) {
      return [pscustomobject]@{
        Process = $process
        WindowHandle = $process.MainWindowHandle
        WindowTitle = $process.MainWindowTitle
        CanonicalState = $hasCanonicalState
        WebViewData = $hasWebViewData
      }
    }
    Start-Sleep -Milliseconds 500
  }

  if (-not $process.HasExited) {
    $process.Kill()
    $process.WaitForExit(5000)
  }
  throw "Timed out waiting for isolated native window/storage/WebView2 data."
}

function Stop-IsolatedProcess {
  param([Parameter(Mandatory = $true)][System.Diagnostics.Process]$Process)
  if ($Process.HasExited) {
    $Process.Dispose()
    return
  }
  $Process.Kill()
  $Process.WaitForExit(5000)
  $Process.Dispose()
}

$sourceExecutable = Get-AbsolutePath -Path $ExecutablePath
if (-not (Test-Path -LiteralPath $sourceExecutable -PathType Leaf)) {
  throw "Native smoke executable not found: $sourceExecutable"
}

$existingProcesses = @(Get-Process -Name "focused-moment" -ErrorAction SilentlyContinue)
if ($existingProcesses.Count -gt 0) {
  throw "Refusing native smoke while a Focused Moment process is already running; no user process was terminated."
}

$runId = "windows-native-{0}-{1}" -f (Get-Date -Format "yyyyMMdd-HHmmss"), ([guid]::NewGuid().ToString("N").Substring(0, 10))
$qaRoot = Join-Path $projectRoot "output\qa\native\$runId"
$isolationRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("focused-moment-windows-native-" + [guid]::NewGuid().ToString("N"))
$qaExecutable = Join-Path $qaRoot "Focused Moment.exe"
$workDirectory = Join-Path $isolationRoot "workdir"
$localAppData = Join-Path $isolationRoot "LocalAppData"
$roamingAppData = Join-Path $isolationRoot "AppData"
$tempDirectory = Join-Path $isolationRoot "Temp"
$userProfile = Join-Path $isolationRoot "UserProfile"
$canonicalDirectory = Join-Path $localAppData "FocusedMoment"
$webViewDirectory = Join-Path $localAppData "com.zhulongqihan.focusedmoment"
$legacyDirectory = Join-Path $workDirectory "FocusedMoment"
$reportPath = Join-Path $qaRoot "report.md"
$process = $null
$reportLines = [System.Collections.Generic.List[string]]::new()

try {
  foreach ($path in @($qaRoot, $workDirectory, $localAppData, $roamingAppData, $tempDirectory, $userProfile)) {
    New-Item -ItemType Directory -Path $path -Force | Out-Null
  }
  Assert-Inside -Path $qaExecutable -Parent $qaRoot
  Assert-Inside -Path $workDirectory -Parent $isolationRoot
  Assert-Inside -Path $localAppData -Parent $isolationRoot
  Assert-Inside -Path $roamingAppData -Parent $isolationRoot
  Assert-Inside -Path $tempDirectory -Parent $isolationRoot
  Assert-Inside -Path $userProfile -Parent $isolationRoot

  Copy-Item -LiteralPath $sourceExecutable -Destination $qaExecutable -Force
  $sourceHash = Get-LocalDeliveryFileHash -Path $sourceExecutable
  $qaHash = Get-LocalDeliveryFileHash -Path $qaExecutable
  if ($sourceHash -ne $qaHash) {
    throw "QA executable copy hash mismatch."
  }

  $environment = @{
    LOCALAPPDATA = $localAppData
    APPDATA = $roamingAppData
    TEMP = $tempDirectory
    TMP = $tempDirectory
    USERPROFILE = $userProfile
    HOME = $userProfile
    WEBVIEW2_USER_DATA_FOLDER = $webViewDirectory
    FOCUSED_MOMENT_NATIVE_SMOKE = "1"
  }

  $reportLines.Add("# Windows native smoke")
  $reportLines.Add("")
  $reportLines.Add("- run: $runId")
  $reportLines.Add("- source executable: $sourceExecutable")
  $reportLines.Add("- QA executable: $qaExecutable")
  $reportLines.Add("- source SHA-256: $sourceHash")
  $reportLines.Add("- QA SHA-256: $qaHash")
  $reportLines.Add("- isolated working directory: $workDirectory")
  $reportLines.Add("- isolated LOCALAPPDATA: $localAppData")
  $reportLines.Add("- expected WebView2 data directory: $webViewDirectory")

  $firstStart = Start-IsolatedFocusedMoment -Executable $qaExecutable -WorkingDirectory $workDirectory -Environment $environment -CanonicalStatePath (Join-Path $canonicalDirectory "focused-moment-state.json") -WebViewPath $webViewDirectory -Timeout $TimeoutSeconds
  $process = $firstStart.Process
  $reportLines.Add("- release executable copy starts with a visible native window: PASS (handle $($firstStart.WindowHandle), title '$($firstStart.WindowTitle)')")
  $reportLines.Add("- synthetic canonical storage is created under isolated LOCALAPPDATA: PASS")
  $reportLines.Add("- synthetic WebView2 data is created under isolated LOCALAPPDATA: PASS")
  if (Test-Path -LiteralPath $legacyDirectory) {
    throw "Fresh launch created legacy working-directory storage: $legacyDirectory"
  }
  $reportLines.Add("- fresh launch does not create legacy working-directory storage: PASS")
  Stop-IsolatedProcess -Process $process
  $process = $null

  Remove-Item -LiteralPath $canonicalDirectory -Recurse -Force
  New-Item -ItemType Directory -Path $legacyDirectory -Force | Out-Null
  Write-Utf8Json -Path (Join-Path $legacyDirectory "focused-moment-state.json") -Content '{"schemaVersion":2,"focusRecords":[],"nextRecordId":7,"todoItems":[],"nextTodoId":0,"timerPreferences":{"pomodoroFocusMinutes":25,"pomodoroBreakMinutes":5,"stopwatchReminderMinutes":30,"toastReminderEnabled":true,"windowAttentionReminderEnabled":true,"soundReminderEnabled":true,"alertSoundKey":"soft_chime"}}'
  Write-Utf8Json -Path (Join-Path $legacyDirectory "focused-moment-runtime.json") -Content '{"schemaVersion":2,"modeKey":"stopwatch","stopwatchElapsedMs":42000,"countdownElapsedMs":0,"countdownDurationMs":1500000,"pomodoroElapsedMs":0,"pomodoroPhaseKey":"focus","pendingPomodoroRecordMs":null,"isRunning":false,"anchorWallClockMs":null,"currentTaskTitle":"","linkedTodoId":null,"completeLinkedTodoOnFinish":false,"completedFocusCount":0,"completedBreakCount":0,"alertSequence":0,"activeAlertKey":null,"stopwatchTargetAlerted":false,"stopwatchStageIndex":0}'
  $legacyStatePath = Join-Path $legacyDirectory "focused-moment-state.json"
  $legacyRuntimePath = Join-Path $legacyDirectory "focused-moment-runtime.json"
  $legacyStateHash = Get-LocalDeliveryFileHash -Path $legacyStatePath
  $legacyRuntimeHash = Get-LocalDeliveryFileHash -Path $legacyRuntimePath

  $secondStart = Start-IsolatedFocusedMoment -Executable $qaExecutable -WorkingDirectory $workDirectory -Environment $environment -CanonicalStatePath (Join-Path $canonicalDirectory "focused-moment-state.json") -WebViewPath $webViewDirectory -Timeout $TimeoutSeconds
  $process = $secondStart.Process
  $reportLines.Add("- valid synthetic legacy state migrates into canonical storage: PASS")
  if ((Get-LocalDeliveryFileHash -Path $legacyStatePath) -ne $legacyStateHash -or (Get-LocalDeliveryFileHash -Path $legacyRuntimePath) -ne $legacyRuntimeHash) {
    throw "Legacy migration changed a synthetic source file."
  }
  $migrationBackups = @(Get-ChildItem -LiteralPath $workDirectory -Directory -Filter "FocusedMoment.migration-backup-*" -ErrorAction SilentlyContinue)
  if ($migrationBackups.Count -eq 0) {
    throw "Legacy migration backup directory was not created beside the synthetic source."
  }
  if ((Get-Content -Raw -LiteralPath (Join-Path $canonicalDirectory "focused-moment-state.json")) -notmatch '"nextRecordId":\s*7') {
    throw "Migrated synthetic state did not preserve nextRecordId."
  }
  if ((Get-Content -Raw -LiteralPath (Join-Path $canonicalDirectory "focused-moment-runtime.json")) -notmatch '"stopwatchElapsedMs":\s*42000') {
    throw "Migrated synthetic runtime did not preserve stopwatchElapsedMs."
  }
  $reportLines.Add("- legacy source remains byte-stable and timestamped migration backup exists: PASS")
  Stop-IsolatedProcess -Process $process
  $process = $null
  $reportLines.Add("- controlled process cleanup: PASS (only the isolated child was stopped)")

  $reportLines.Add("")
  $reportLines.Add("Automated scope: startup visibility, exact executable-copy hash, isolated LOCALAPPDATA/APPDATA/TEMP/USERPROFILE, WebView2 data path, fresh legacy-path guard, and synthetic legacy migration. Timer button interaction, system tray actions, floating/unlock windows, backup UI, audio, notifications, and graceful user-initiated quit remain manual/native UI coverage unless a UI automation runner is available.")
  [System.IO.File]::WriteAllLines($reportPath, $reportLines, [System.Text.UTF8Encoding]::new($false))
  $reportLines -join [Environment]::NewLine
} finally {
  if ($process) {
    try { Stop-IsolatedProcess -Process $process } catch { }
  }
  if (Test-Path -LiteralPath $isolationRoot) {
    try {
      Remove-IsolatedFixture -Path $isolationRoot -TerminateReferencingProcesses
    } catch {
      $reportLines.Add("- synthetic temp cleanup: WARNING ($($_.Exception.Message))")
      [System.IO.File]::WriteAllLines($reportPath, $reportLines, [System.Text.UTF8Encoding]::new($false))
    }
  }
  if (-not (Test-Path -LiteralPath $reportPath -PathType Leaf)) {
    New-Item -ItemType Directory -Path $qaRoot -Force | Out-Null
    [System.IO.File]::WriteAllLines($reportPath, $reportLines, [System.Text.UTF8Encoding]::new($false))
  }
}
