param([Parameter(Mandatory=$true)][int]$ProcessId,[Parameter(Mandatory=$true)][string]$OutputPath,[int]$Seconds=12)
$ErrorActionPreference="Stop"
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$process=Get-Process -Id $ProcessId -ErrorAction Stop
$workspaceRoot=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$qaRoot=[IO.Path]::GetFullPath((Join-Path $workspaceRoot "artifacts\qa\native")).TrimEnd('\')+'\'
if (-not $process.Path.StartsWith($qaRoot,[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($process.Path) -ne 'Focused Moment.exe' -or -not [IO.Path]::GetFullPath($OutputPath).StartsWith($qaRoot,[StringComparison]::OrdinalIgnoreCase)) { throw "Audio meter is restricted to isolated native QA candidates and evidence paths." }
if ($Seconds -lt 1 -or $Seconds -gt 30) { throw "Audio sample duration is out of bounds." }
Add-Type @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class DeviceEnumerator {}
[ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IDeviceEnumerator {
 [PreserveSig] int EnumAudioEndpoints(int a,int b,out IntPtr c);
 [PreserveSig] int GetDefaultAudioEndpoint(int flow,int role,out IDevice device);
}
[ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IDevice {
 [PreserveSig] int Activate(ref Guid iid,int context,IntPtr activation,[MarshalAs(UnmanagedType.IUnknown)] out object result);
}
[ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface ISessionManager {
 [PreserveSig] int GetAudioSessionControl(IntPtr guid,uint flags,out IntPtr control);
 [PreserveSig] int GetSimpleAudioVolume(IntPtr guid,uint flags,out IntPtr volume);
 [PreserveSig] int GetSessionEnumerator(out ISessionEnumerator sessions);
}
[ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface ISessionEnumerator {
 [PreserveSig] int GetCount(out int count);
 [PreserveSig] int GetSession(int index,out ISession session);
}
[ComImport, Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface ISession {
 [PreserveSig] int GetState(out int state);
 [PreserveSig] int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string name);
 [PreserveSig] int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string name,IntPtr context);
 [PreserveSig] int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string name);
 [PreserveSig] int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string name,IntPtr context);
 [PreserveSig] int GetGroupingParam(out Guid grouping);
 [PreserveSig] int SetGroupingParam(ref Guid grouping,IntPtr context);
 [PreserveSig] int RegisterAudioSessionNotification(IntPtr notification);
 [PreserveSig] int UnregisterAudioSessionNotification(IntPtr notification);
 [PreserveSig] int GetSessionIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string id);
 [PreserveSig] int GetSessionInstanceIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string id);
 [PreserveSig] int GetProcessId(out uint pid);
}
[ComImport, Guid("C02216F6-8C67-4B5B-9D00-D008E73E0064"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IMeter {
 [PreserveSig] int GetPeakValue(out float peak);
}
public sealed class NativeQaAudioMeter {
 private ISessionManager manager;
 public NativeQaAudioMeter() {
  IDevice device; Marshal.ThrowExceptionForHR(((IDeviceEnumerator)new DeviceEnumerator()).GetDefaultAudioEndpoint(0,0,out device));
  Guid iid=typeof(ISessionManager).GUID; object value; Marshal.ThrowExceptionForHR(device.Activate(ref iid,23,IntPtr.Zero,out value)); manager=(ISessionManager)value;
 }
 public Dictionary<uint,float> Peaks(uint[] allowed) {
  var ids=new HashSet<uint>(allowed); var found=new Dictionary<uint,float>(); ISessionEnumerator sessions;
  Marshal.ThrowExceptionForHR(manager.GetSessionEnumerator(out sessions)); int count; sessions.GetCount(out count);
  for(int i=0;i<count;i++) { ISession session; if(sessions.GetSession(i,out session)!=0) continue; uint pid; session.GetProcessId(out pid);
   if(ids.Contains(pid)) { var meter=session as IMeter; float peak; if(meter!=null && meter.GetPeakValue(out peak)==0) found[pid]=Math.Max(found.ContainsKey(pid)?found[pid]:0,peak); }
   Marshal.ReleaseComObject(session);
  }
  Marshal.ReleaseComObject(sessions); return found;
 }
}
'@
$meter=[NativeQaAudioMeter]::new()
$samples=[Collections.Generic.List[object]]::new()
$watch=[Diagnostics.Stopwatch]::StartNew()
$nextRefresh=0
$allowed=[uint32[]]@($ProcessId)
Write-Output "READY"
while ($watch.Elapsed.TotalSeconds -lt $Seconds) {
 if ($watch.Elapsed.TotalSeconds -ge $nextRefresh) {
  $all=@(Get-CimInstance Win32_Process); $ids=[Collections.Generic.HashSet[int]]::new(); [void]$ids.Add($ProcessId)
  do { $before=$ids.Count; foreach($item in $all) { if($ids.Contains([int]$item.ParentProcessId)) { [void]$ids.Add([int]$item.ProcessId) } } } while($ids.Count -gt $before)
  $allowed=[uint32[]]@($ids); $nextRefresh=$watch.Elapsed.TotalSeconds+1
 }
 $peaks=$meter.Peaks($allowed)
 foreach($entry in $peaks.GetEnumerator()) { $samples.Add([pscustomobject]@{ seconds=$watch.Elapsed.TotalSeconds; processId=$entry.Key; peak=$entry.Value }) }
 Start-Sleep -Milliseconds 100
}
$result=[pscustomobject]@{ evidenceClass="CoreAudio-isolated-process-meter"; rootProcessId=$ProcessId; durationSeconds=$watch.Elapsed.TotalSeconds; samples=@($samples.ToArray()); limitation="Reads peak levels only for the isolated process tree. Does not record audio, inspect other apps audio levels, identify waveforms, or prove human audibility." }
[IO.File]::WriteAllText($OutputPath,($result|ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))
