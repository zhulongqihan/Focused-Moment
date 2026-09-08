[CmdletBinding()]
param(
  [ValidateSet("cold", "synthetic", "idle", "running", "all")]
  [string]$Phase = "all",
  [string]$ExePath = (Join-Path (Get-Location) "src-tauri/target/debug/focused-moment.exe"),
  [string]$OutputDirectory = (Join-Path (Get-Location) "output/qa/PERF-01/f1060bb"),
  [ValidateRange(5, 60)]
  [int]$SampleIntervalSeconds = 30,
  [ValidateRange(1, 3600)]
  [int]$DurationSeconds = 0
)

$ErrorActionPreference = "Stop"
$workspaceRoot = (Get-Location).Path
$resolvedExePath = (Resolve-Path -LiteralPath $ExePath).Path
$resolvedOutputDirectory = if ([System.IO.Path]::IsPathRooted($OutputDirectory)) {
  [System.IO.Path]::GetFullPath($OutputDirectory)
} else {
  [System.IO.Path]::GetFullPath((Join-Path $workspaceRoot $OutputDirectory))
}

function Assert-WorkspaceOutput([string]$Path) {
  $root = $workspaceRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
  if (-not $Path.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "拒绝在 workspace 外写入性能证据：$Path"
  }
}

function Reset-Directory([string]$Path) {
  Assert-WorkspaceOutput $Path
  if (Test-Path -LiteralPath $Path) {
    Remove-Item -LiteralPath $Path -Recurse -Force
  }
  New-Item -ItemType Directory -Path $Path -Force | Out-Null
}

function Write-Utf8Json([string]$Path, $Value) {
  $json = $Value | ConvertTo-Json -Depth 12
  $utf8 = [System.Text.UTF8Encoding]::new($false)
  [System.IO.File]::WriteAllText($Path, $json, $utf8)
}

function New-SyntheticRecord([int]$Id) {
  $day = (($Id - 1) % 28) + 1
  $hour = 8 + (($Id - 1) % 10)
  $minute = (($Id - 1) * 7) % 60
  $date = "2026-01-{0:D2}" -f $day
  $time = "{0:D2}:{1:D2}" -f $hour, $minute
  [ordered]@{
    id = $Id
    title = "Synthetic focus task {0:D6}" -f $Id
    durationMs = 2700000
    durationLabel = "00:45:00"
    modeKey = "stopwatch"
    modeLabel = "正向计时"
    phaseLabel = "正向计时"
    linkedTodoId = $null
    linkedTodoTitle = $null
    completedAt = "${date}T${time}:00+08:00"
    completedDate = $date
    completedTime = $time
  }
}

function Write-AppFixture([string]$DataDirectory, [int]$RecordCount = 0, [bool]$Running = $false) {
  $appDirectory = Join-Path $DataDirectory "FocusedMoment"
  New-Item -ItemType Directory -Path $appDirectory -Force | Out-Null
  $records = @()
  if ($RecordCount -gt 0) {
    $records = @(1..$RecordCount | ForEach-Object { New-SyntheticRecord $_ })
  }
  $state = [ordered]@{
    schemaVersion = 2
    focusRecords = $records
    nextRecordId = $RecordCount + 1
    todoItems = @()
    nextTodoId = 1
    timerPreferences = [ordered]@{
      pomodoroFocusMinutes = 25
      pomodoroBreakMinutes = 5
      stopwatchReminderMinutes = 25
      toastReminderEnabled = $true
      windowAttentionReminderEnabled = $true
      soundReminderEnabled = $false
      alertSoundKey = "soft_chime"
    }
  }
  $nowMs = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
  $runtime = [ordered]@{
    schemaVersion = 2
    modeKey = "stopwatch"
    stopwatchElapsedMs = 0
    countdownElapsedMs = 0
    countdownDurationMs = 1500000
    pomodoroElapsedMs = 0
    pomodoroPhaseKey = "focus"
    pendingPomodoroRecordMs = $null
    isRunning = $Running
    anchorWallClockMs = if ($Running) { $nowMs } else { $null }
    currentTaskTitle = if ($Running) { "Synthetic performance run" } else { "" }
    linkedTodoId = $null
    completeLinkedTodoOnFinish = $false
    completedFocusCount = $RecordCount
    completedBreakCount = 0
    alertSequence = 0
    activeAlertKey = $null
    stopwatchTargetAlerted = $false
    stopwatchStageIndex = 0
  }
  Write-Utf8Json (Join-Path $appDirectory "focused-moment-state.json") $state
  Write-Utf8Json (Join-Path $appDirectory "focused-moment-runtime.json") $runtime
}

function Get-DescendantProcessIds([int]$RootId) {
  $all = @(Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId)
  $ids = [System.Collections.Generic.List[int]]::new()
  $ids.Add($RootId)
  $changed = $true
  while ($changed) {
    $changed = $false
    foreach ($process in $all) {
      if ($ids.Contains([int]$process.ParentProcessId) -and -not $ids.Contains([int]$process.ProcessId)) {
        $ids.Add([int]$process.ProcessId)
        $changed = $true
      }
    }
  }
  return @($ids)
}

function Get-ProcessStats([int]$RootId) {
  $ids = @(Get-DescendantProcessIds $RootId)
  $processes = @($ids | ForEach-Object {
    try { Get-Process -Id $_ -ErrorAction Stop } catch { $null }
  } | Where-Object { $_ })
  $cpuSeconds = 0.0
  $workingSetBytes = [int64]0
  $privateBytes = [int64]0
  foreach ($process in $processes) {
    try { $cpuSeconds += $process.TotalProcessorTime.TotalSeconds } catch { }
    try { $workingSetBytes += [int64]$process.WorkingSet64 } catch { }
    try { $privateBytes += [int64]$process.PrivateMemorySize64 } catch { }
  }
  [ordered]@{
    processCount = $processes.Count
    processIds = @($processes.Id)
    cpuSeconds = [Math]::Round($cpuSeconds, 3)
    workingSetBytes = $workingSetBytes
    privateBytes = $privateBytes
  }
}

function Stop-MeasuredProcess($Process) {
  if (-not $Process) { return }
  $ids = @(Get-DescendantProcessIds $Process.Id | Sort-Object -Descending)
  foreach ($id in $ids) {
    try { Stop-Process -Id $id -Force -ErrorAction Stop } catch { }
  }
  try { $null = $Process.WaitForExit(5000) } catch { }
}

function Start-MeasuredProcess([string]$DataDirectory) {
  $previousLocalAppData = $env:LOCALAPPDATA
  $previousAppData = $env:APPDATA
  $env:LOCALAPPDATA = $DataDirectory
  $env:APPDATA = $DataDirectory
  $watch = [System.Diagnostics.Stopwatch]::StartNew()
  $process = Start-Process -FilePath $resolvedExePath -WorkingDirectory (Split-Path $resolvedExePath) -WindowStyle Hidden -PassThru
  $ready = $false
  try {
    $ready = $process.WaitForInputIdle(1000)
  } catch { }
  if (-not $ready) {
    while ($watch.Elapsed.TotalSeconds -lt 20) {
      if ($process.HasExited) { break }
      if (@(Get-DescendantProcessIds $process.Id).Count -ge 5) {
        $ready = $true
        break
      }
      Start-Sleep -Milliseconds 250
    }
  }
  $watch.Stop()
  $env:LOCALAPPDATA = $previousLocalAppData
  $env:APPDATA = $previousAppData
  [ordered]@{
    process = $process
    ready = $ready
    readyMs = [Math]::Round($watch.Elapsed.TotalMilliseconds, 1)
  }
}

function Measure-ColdStarts([string]$RootDirectory) {
  $results = @()
  for ($run = 1; $run -le 3; $run++) {
    $directory = Join-Path $RootDirectory ("run-{0}" -f $run)
    Reset-Directory $directory
    Write-AppFixture $directory
    $started = Start-MeasuredProcess $directory
    Start-Sleep -Seconds 2
    $stats = Get-ProcessStats $started.process.Id
    $results += [ordered]@{
      run = $run
      ready = $started.ready
      readyMs = $started.readyMs
      sample = $stats
    }
    Stop-MeasuredProcess $started.process
  }
  return $results
}

function Measure-SyntheticStarts([string]$RootDirectory) {
  $results = @()
  foreach ($count in @(1000, 10000)) {
    for ($run = 1; $run -le 3; $run++) {
      $directory = Join-Path $RootDirectory ("records-{0}-run-{1}" -f $count, $run)
      Reset-Directory $directory
      Write-AppFixture $directory $count
      $started = Start-MeasuredProcess $directory
      Start-Sleep -Seconds 3
      $stats = Get-ProcessStats $started.process.Id
      $results += [ordered]@{
        recordCount = $count
        run = $run
        ready = $started.ready
        readyMs = $started.readyMs
        sample = $stats
      }
      Stop-MeasuredProcess $started.process
    }
  }
  return $results
}

function Measure-LongRun([string]$RootDirectory, [string]$Name, [bool]$Running) {
  $directory = Join-Path $RootDirectory $Name
  Reset-Directory $directory
  Write-AppFixture $directory 0 $Running
  $started = Start-MeasuredProcess $directory
  $duration = if ($DurationSeconds -gt 0) { $DurationSeconds } elseif ($Running) { 1800 } else { 600 }
  $watch = [System.Diagnostics.Stopwatch]::StartNew()
  $samples = @()
  $previous = $null
  while ($watch.Elapsed.TotalSeconds -lt $duration) {
    if ($started.process.HasExited) { break }
    $stats = Get-ProcessStats $started.process.Id
    $elapsed = $watch.Elapsed.TotalSeconds
    $sample = [ordered]@{
      elapsedSeconds = [Math]::Round($elapsed, 1)
      processCount = $stats.processCount
      processIds = $stats.processIds
      cpuSeconds = $stats.cpuSeconds
      workingSetBytes = $stats.workingSetBytes
      privateBytes = $stats.privateBytes
    }
    if ($previous) {
      $wallSeconds = $elapsed - $previous.elapsedSeconds
      $sample.cpuPercentAllCores = if ($wallSeconds -gt 0) { [Math]::Round((($stats.cpuSeconds - $previous.cpuSeconds) / $wallSeconds) / [Environment]::ProcessorCount * 100, 3) } else { 0 }
    }
    $samples += $sample
    $previous = $sample
    $remaining = $duration - $elapsed
    if ($remaining -gt 0) { Start-Sleep -Seconds ([Math]::Min($SampleIntervalSeconds, [Math]::Ceiling($remaining))) }
  }
  $watch.Stop()
  Stop-MeasuredProcess $started.process
  [ordered]@{
    name = $Name
    requestedSeconds = $duration
    observedSeconds = [Math]::Round($watch.Elapsed.TotalSeconds, 1)
    runningFixture = $Running
    ready = $started.ready
    readyMs = $started.readyMs
    samples = $samples
  }
}

New-Item -ItemType Directory -Path $resolvedOutputDirectory -Force | Out-Null
switch ($Phase) {
  "cold" {
    $root = Join-Path $resolvedOutputDirectory "cold-start"
    $result = [ordered]@{ phase = "cold-start"; capturedAt = (Get-Date).ToString("o"); results = @(Measure-ColdStarts $root) }
    Write-Utf8Json (Join-Path $resolvedOutputDirectory "cold-start.json") $result
  }
  "synthetic" {
    $root = Join-Path $resolvedOutputDirectory "synthetic-history"
    $result = [ordered]@{ phase = "synthetic-history"; capturedAt = (Get-Date).ToString("o"); results = @(Measure-SyntheticStarts $root) }
    Write-Utf8Json (Join-Path $resolvedOutputDirectory "synthetic-history.json") $result
  }
  "idle" {
    $root = Join-Path $resolvedOutputDirectory "long-run"
    $result = Measure-LongRun $root "idle-10m" $false
    Write-Utf8Json (Join-Path $resolvedOutputDirectory "idle-10m.json") $result
  }
  "running" {
    $root = Join-Path $resolvedOutputDirectory "long-run"
    $result = Measure-LongRun $root "running-timer-30m" $true
    Write-Utf8Json (Join-Path $resolvedOutputDirectory "running-timer-30m.json") $result
  }
  "all" {
    $root = Join-Path $resolvedOutputDirectory "cold-start"
    $cold = [ordered]@{ phase = "cold-start"; capturedAt = (Get-Date).ToString("o"); results = @(Measure-ColdStarts $root) }
    Write-Utf8Json (Join-Path $resolvedOutputDirectory "cold-start.json") $cold
    $root = Join-Path $resolvedOutputDirectory "synthetic-history"
    $synthetic = [ordered]@{ phase = "synthetic-history"; capturedAt = (Get-Date).ToString("o"); results = @(Measure-SyntheticStarts $root) }
    Write-Utf8Json (Join-Path $resolvedOutputDirectory "synthetic-history.json") $synthetic
    $root = Join-Path $resolvedOutputDirectory "long-run"
    $idle = Measure-LongRun $root "idle-10m" $false
    Write-Utf8Json (Join-Path $resolvedOutputDirectory "idle-10m.json") $idle
    $running = Measure-LongRun $root "running-timer-30m" $true
    Write-Utf8Json (Join-Path $resolvedOutputDirectory "running-timer-30m.json") $running
  }
}

Write-Output "Performance baseline evidence written to $resolvedOutputDirectory"
