param(
  [switch]$Latest,
  [switch]$SkipPackage
)

$ErrorActionPreference = "Stop"

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Label,
    [Parameter(Mandatory = $true)]
    [string]$FilePath,
    [string[]]$Arguments = @()
  )

  Write-Host ("==> {0}" -f $Label)
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Step failed: $Label"
  }
}

function Get-GitOutput {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  $result = & git @Arguments 2>$null
  if ($LASTEXITCODE -ne 0) {
    throw "git command failed: $($Arguments -join ' ')"
  }

  return ($result | Out-String).Trim()
}

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

$package = Get-Content -Raw (Join-Path $projectRoot "package.json") | ConvertFrom-Json
$version = $package.version
$tag = "v{0}" -f $version

$branch = Get-GitOutput -Arguments @("branch", "--show-current")
if ($branch -ne "main") {
  throw "release:ship 只能在 main 分支执行，当前分支为 $branch。"
}

$statusLines = @(git status --short)
if ($LASTEXITCODE -ne 0) {
  throw "无法读取当前 git 状态。"
}

if ($statusLines.Count -gt 0) {
  throw "当前工作区仍有未提交改动，请先提交后再执行 release:ship。"
}

if (-not $SkipPackage) {
  Invoke-Step -Label "构建并导出正式版附件" -FilePath "pnpm.cmd" -Arguments @("package:release")
}

$tagExists = $true
& git rev-parse -q --verify ("refs/tags/{0}" -f $tag) *> $null
if ($LASTEXITCODE -ne 0) {
  $tagExists = $false
}

if (-not $tagExists) {
  Invoke-Step -Label ("创建版本标签 {0}" -f $tag) -FilePath "git" -Arguments @("tag", "-a", $tag, "-m", ("Focused Moment {0}" -f $tag))
}

Invoke-Step -Label "推送 main 到 origin" -FilePath "git" -Arguments @("push", "origin", "main")
Invoke-Step -Label ("推送标签 {0}" -f $tag) -FilePath "git" -Arguments @("push", "origin", $tag)

$publishScript = Join-Path $PSScriptRoot "publish-release.ps1"
$publishArguments = @(
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  $publishScript,
  "-Profile",
  "release"
)

if ($Latest) {
  $publishArguments += "-Latest"
}

Invoke-Step -Label "创建或更新 GitHub Release" -FilePath "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -Arguments $publishArguments
