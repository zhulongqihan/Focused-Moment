param(
  [Parameter(Mandatory = $true)][int]$ApplicationProcessId,
  [Parameter(Mandatory = $true)][string]$ExpectedExecutable
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$ownedProcess = Get-Process -Id $ApplicationProcessId
if ([System.IO.Path]::GetFullPath($ownedProcess.Path) -ne [System.IO.Path]::GetFullPath($ExpectedExecutable)) {
  throw 'HWND inspection refused: process executable does not match this isolated candidate.'
}
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class NativeCdpWindows {
  public delegate bool EnumProc(IntPtr hwnd, IntPtr param);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback, IntPtr param);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int count);
  public class Entry { public long hwnd; public string title; public bool visible; }
  public static Entry[] ForProcess(uint processId) {
    var result = new List<Entry>();
    EnumWindows(delegate(IntPtr hwnd, IntPtr param) {
      uint owner; GetWindowThreadProcessId(hwnd, out owner);
      if (owner == processId) {
        var text = new StringBuilder(1024); GetWindowText(hwnd, text, text.Capacity);
        result.Add(new Entry { hwnd = hwnd.ToInt64(), title = text.ToString(), visible = IsWindowVisible(hwnd) });
      }
      return true;
    }, IntPtr.Zero);
    return result.ToArray();
  }
}
'@
@{ processId = $ApplicationProcessId; windows = @([NativeCdpWindows]::ForProcess($ApplicationProcessId)) } | ConvertTo-Json -Depth 5 -Compress
