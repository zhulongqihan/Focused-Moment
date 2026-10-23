param(
  [Parameter(Mandatory=$true)][int]$ProcessId,
  [ValidateSet('Windows','Inspect','Click','ClickPhysical','DialogClick','Toggle','SetText','TypeText','Hide','Show','Minimize','WatchAttention','Screenshot','OpenTray','MenuInspect','MenuClick')][string]$Action='Inspect',
  [long]$WindowHandle,
  [string]$Name,
  [string]$Value,
  [string]$OutputPath,
  [int]$Seconds=30
)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes,System.Drawing,System.Windows.Forms
Add-Type @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class ReleaseQaWindows {
 public delegate bool Callback(IntPtr handle,IntPtr value);
 [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left,Top,Right,Bottom; }
 public sealed class Info { public long Handle; public uint OwnerPid; public bool Visible; public int Width,Height; public string Title,ClassName; }
 [DllImport("user32.dll")] public static extern bool EnumWindows(Callback callback,IntPtr value);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr handle,out uint owner);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr handle);
 [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr handle);
 [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr handle);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr handle,out Rect rectangle);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr handle,StringBuilder title,int length);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr handle,StringBuilder title,int length);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr handle,int command);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr handle);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint x,uint y,uint data,UIntPtr extra);
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr handle,IntPtr dc,uint flags);
 public sealed class MenuInfo { public string Name; public int Index; public uint Id,State; public bool Enabled; public int Left,Top,Right,Bottom; }
 [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h,uint message,IntPtr w,IntPtr l);
 [DllImport("user32.dll")] public static extern int GetMenuItemCount(IntPtr menu);
 [DllImport("user32.dll")] public static extern uint GetMenuItemID(IntPtr menu,int position);
 [DllImport("user32.dll")] public static extern uint GetMenuState(IntPtr menu,uint position,uint flags);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetMenuString(IntPtr menu,uint position,StringBuilder name,int count,uint flags);
 [DllImport("user32.dll")] public static extern bool GetMenuItemRect(IntPtr window,IntPtr menu,uint position,out Rect rect);
 public static MenuInfo[] Menu(IntPtr hwnd) {var menu=SendMessage(hwnd,0x1e1,IntPtr.Zero,IntPtr.Zero);var result=new List<MenuInfo>();for(int i=0;i<GetMenuItemCount(menu);i++){var text=new StringBuilder(512);GetMenuString(menu,(uint)i,text,512,0x400);var state=GetMenuState(menu,(uint)i,0x400);var rect=new Rect();GetMenuItemRect(IntPtr.Zero,menu,(uint)i,out rect);result.Add(new MenuInfo{Name=text.ToString(),Index=i,Id=GetMenuItemID(menu,i),State=state,Enabled=(state&3)==0,Left=rect.Left,Top=rect.Top,Right=rect.Right,Bottom=rect.Bottom});}return result.ToArray();}
 [StructLayout(LayoutKind.Sequential)] public struct Key {public ushort Vk,Scan;public uint Flags,Time;public UIntPtr Extra;}
 [StructLayout(LayoutKind.Sequential)] public struct Mouse {public int X,Y;public uint Data,Flags,Time;public UIntPtr Extra;}
 [StructLayout(LayoutKind.Explicit)] public struct InputUnion {[FieldOffset(0)]public Key Key;[FieldOffset(0)]public Mouse Mouse;}
 [StructLayout(LayoutKind.Sequential)] public struct Input {public uint Type;public InputUnion Data;}
 [DllImport("user32.dll")]public static extern uint SendInput(uint count,Input[] input,int size);
 public static void Text(string text){foreach(char c in text){var down=new Input{Type=1,Data=new InputUnion{Key=new Key{Scan=c,Flags=4}}};var up=new Input{Type=1,Data=new InputUnion{Key=new Key{Scan=c,Flags=6}}};if(SendInput(2,new[]{down,up},Marshal.SizeOf(typeof(Input)))!=2)throw new Exception("Unicode keyboard input was rejected.");}}
 [StructLayout(LayoutKind.Sequential)]public struct Point {public int X,Y;}
 [DllImport("user32.dll")]public static extern IntPtr WindowFromPoint(Point point);
 [DllImport("user32.dll")]public static extern IntPtr GetAncestor(IntPtr window,uint flags);
 [DllImport("user32.dll")]public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
 public static Info[] Windows(uint pid) { var result=new List<Info>(); EnumWindows((h,p)=>{uint owner;GetWindowThreadProcessId(h,out owner);if(pid==0 || owner==pid){var t=new StringBuilder(512);var c=new StringBuilder(256);var r=new Rect();GetWindowText(h,t,512);GetClassName(h,c,256);GetWindowRect(h,out r);result.Add(new Info{Handle=h.ToInt64(),OwnerPid=owner,Visible=IsWindowVisible(h),Title=t.ToString(),ClassName=c.ToString(),Width=r.Right-r.Left,Height=r.Bottom-r.Top});}return true;},IntPtr.Zero);return result.ToArray(); }
}
'@
[void][ReleaseQaWindows]::SetThreadDpiAwarenessContext([IntPtr](-4))
$qaRoot=[IO.Path]::GetFullPath((Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'artifacts/qa/native')).TrimEnd('\')+'\'
$process=Get-Process -Id $ProcessId -ErrorAction Stop
$exe=[IO.Path]::GetFullPath($process.Path)
if(-not $exe.StartsWith($qaRoot,[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($exe) -ne 'Focused Moment.exe'){throw 'Target is not an isolated repository native QA executable.'}
$windows=@([ReleaseQaWindows]::Windows([uint32]$ProcessId))
if($Action -eq 'Windows'){ConvertTo-Json -InputObject $windows -Depth 4 -Compress;exit 0}
function Get-Elements($root){return @($root.FindAll([Windows.Automation.TreeScope]::Descendants,[Windows.Automation.Condition]::TrueCondition))}
function Element-Json($element){$r=$element.Current.BoundingRectangle;$value=$null;$pattern=$null;if($element.TryGetCurrentPattern([Windows.Automation.ValuePattern]::Pattern,[ref]$pattern)){$value=$pattern.Current.Value};[pscustomobject]@{name=$element.Current.Name;controlType=$element.Current.ControlType.ProgrammaticName;enabled=$element.Current.IsEnabled;offscreen=$element.Current.IsOffscreen;automationId=$element.Current.AutomationId;value=$value;rectangle=$(if($r.IsEmpty){@(0,0,0,0)}else{@($r.X,$r.Y,$r.Width,$r.Height)})}}
function Find-Element($root,$name,$type){
 $deadline=[DateTime]::UtcNow.AddSeconds(5)
 do {$element=Get-Elements $root|Where-Object {$_.Current.Name -eq $name -and $_.Current.ControlType -eq $type}|Select-Object -First 1;if($element){return $element};Start-Sleep -Milliseconds 150}while([DateTime]::UtcNow -lt $deadline)
 throw "Control not ready: $name"
}
function Assert-PointOwner($point,$expected){$actual=[ReleaseQaWindows]::GetAncestor([ReleaseQaWindows]::WindowFromPoint($point),2);if($actual -ne $expected){throw "Pointer target is covered by another window (expected $expected, actual $actual)."}}
function Focus-Window($target){[void][ReleaseQaWindows]::SetForegroundWindow($target);Start-Sleep -Milliseconds 100;if([ReleaseQaWindows]::GetForegroundWindow() -ne $target){throw 'Isolated target did not gain foreground; refusing global input.'}}
function Point-ForElement($element){$r=$element.Current.BoundingRectangle;if($r.IsEmpty){throw 'Control has no screen rectangle.'};$point=[ReleaseQaWindows+Point]::new();$point.X=[int]($r.X+$r.Width/2);$point.Y=[int]($r.Y+$r.Height/2);return $point}
function Click-Element($element,$expectedHandle=$handle){
 if(-not $element.Current.IsEnabled){throw 'The requested control is disabled.'}
 if($element.Current.IsOffscreen){$scroll=$null;if($element.TryGetCurrentPattern([Windows.Automation.ScrollItemPattern]::Pattern,[ref]$scroll)){$scroll.ScrollIntoView()}else{$element.SetFocus()};Start-Sleep -Milliseconds 150}
 $pattern=$null
 if($element.TryGetCurrentPattern([Windows.Automation.InvokePattern]::Pattern,[ref]$pattern)){$pattern.Invoke();$script:clickMethod='uia-invoke';return}
 Focus-Window $expectedHandle;$point=Point-ForElement $element;Assert-PointOwner $point $expectedHandle;[void][ReleaseQaWindows]::SetCursorPos($point.X,$point.Y);[ReleaseQaWindows]::mouse_event(2,0,0,0,[UIntPtr]::Zero);[ReleaseQaWindows]::mouse_event(4,0,0,0,[UIntPtr]::Zero);$script:clickMethod='native-pointer'
}
if($Action -eq 'OpenTray'){
 $other=@(Get-Process -Name 'Focused Moment','focused-moment' -ErrorAction SilentlyContinue | Where-Object {$_.Id -ne $ProcessId})
 if($other.Count -gt 0){throw 'Another Focused Moment process exists; refusing ambiguous tray selection.'}
 $shellWindows=@([ReleaseQaWindows]::Windows(0) | Where-Object {$_.Visible -and $_.ClassName -in @('Shell_TrayWnd','Shell_SecondaryTrayWnd','TopLevelWindowForOverflowXamlIsland','NotifyIconOverflowWindow')})
 $matches=@();$overflow=$null;$overflowHandle=[IntPtr]::Zero
 foreach($shellWindow in $shellWindows){$shell=[Windows.Automation.AutomationElement]::FromHandle([IntPtr]$shellWindow.Handle);foreach($element in (Get-Elements $shell)){
  if($element.Current.Name -eq 'Focused Moment' -and -not $element.Current.IsOffscreen){$point=Point-ForElement $element;if([ReleaseQaWindows]::GetAncestor([ReleaseQaWindows]::WindowFromPoint($point),2) -eq [IntPtr]$shellWindow.Handle){$matches+=,[pscustomobject]@{Element=$element;Handle=[IntPtr]$shellWindow.Handle}}}
  if($element.Current.Name -in @('显示隐藏的图标','Show hidden icons','隐藏的图标菜单')){$overflow=$element;$overflowHandle=[IntPtr]$shellWindow.Handle}
 }}
 if($matches.Count -eq 0 -and $overflow){Click-Element $overflow $overflowHandle;Start-Sleep -Milliseconds 500;$shellWindows=@([ReleaseQaWindows]::Windows(0) | Where-Object {$_.Visible -and $_.ClassName -in @('TopLevelWindowForOverflowXamlIsland','NotifyIconOverflowWindow')});foreach($shellWindow in $shellWindows){$shell=[Windows.Automation.AutomationElement]::FromHandle([IntPtr]$shellWindow.Handle);foreach($element in (Get-Elements $shell)){if($element.Current.Name -eq 'Focused Moment' -and -not $element.Current.IsOffscreen){$point=Point-ForElement $element;if([ReleaseQaWindows]::GetAncestor([ReleaseQaWindows]::WindowFromPoint($point),2) -eq [IntPtr]$shellWindow.Handle){$matches+=,[pscustomobject]@{Element=$element;Handle=[IntPtr]$shellWindow.Handle}}}}}}
 if($matches.Count -ne 1){throw "Expected one unambiguous Focused Moment tray icon; found $($matches.Count)."}
 $point=Point-ForElement $matches[0].Element;Assert-PointOwner $point $matches[0].Handle;[void][ReleaseQaWindows]::SetCursorPos($point.X,$point.Y);[ReleaseQaWindows]::mouse_event(8,0,0,0,[UIntPtr]::Zero);Start-Sleep -Milliseconds 100;[ReleaseQaWindows]::mouse_event(16,0,0,0,[UIntPtr]::Zero);$deadline=[DateTime]::UtcNow.AddSeconds(4);do{$menu=@([ReleaseQaWindows]::Windows([uint32]$ProcessId)|Where-Object {$_.Visible -and $_.ClassName -eq '#32768'});if($menu.Count -eq 1){[pscustomobject]@{trayOpened=$true;icon=(Element-Json $matches[0].Element);menu=$menu[0]}|ConvertTo-Json -Depth 5 -Compress;exit 0};Start-Sleep -Milliseconds 100}while([DateTime]::UtcNow -lt $deadline);throw 'Native right-click did not produce an owned visible tray menu.'
}
if($Action -in @('MenuInspect','MenuClick')){
 $menuWindow=$windows | Where-Object {$_.ClassName -eq '#32768' -and $_.Visible} | Select-Object -First 1
 if(-not $menuWindow){throw 'No menu owned by the isolated candidate is visible.'}
 $WindowHandle=$menuWindow.Handle
}
if(-not $WindowHandle){$selected=$windows | Where-Object {$_.Visible -and $_.Width -gt 1000 -and $_.Height -gt 600} | Select-Object -First 1;if(-not $selected){throw 'No owned main window is visible.'};$WindowHandle=$selected.Handle}
$handle=[IntPtr]$WindowHandle;$owner=[uint32]0
[void][ReleaseQaWindows]::GetWindowThreadProcessId($handle,[ref]$owner)
if(-not [ReleaseQaWindows]::IsWindow($handle) -or $owner -ne $ProcessId){throw 'Window is not owned by the isolated candidate.'}
if($Action -eq 'WatchAttention'){
 $output=[IO.Path]::GetFullPath($OutputPath);if(-not $output.StartsWith($qaRoot,[StringComparison]::OrdinalIgnoreCase) -or $Seconds -lt 1 -or $Seconds -gt 45){throw 'Invalid attention evidence path or duration.'}
 Add-Type -ReferencedAssemblies System.Windows.Forms @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Windows.Forms;
public sealed class ReleaseQaAttentionWatcher : NativeWindow, IDisposable {
 [DllImport("user32.dll")]static extern bool RegisterShellHookWindow(IntPtr h);
 [DllImport("user32.dll")]static extern bool DeregisterShellHookWindow(IntPtr h);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern uint RegisterWindowMessage(string message);
 [DllImport("user32.dll")]static extern bool IsWindowVisible(IntPtr h);
 public sealed class Entry {public double Seconds;public long WindowHandle;public bool Visible;public int ShellEvent;}
 public readonly List<Entry> Events=new List<Entry>();
 private readonly IntPtr target;private readonly uint message;private readonly DateTime started=DateTime.UtcNow;
 public ReleaseQaAttentionWatcher(IntPtr h){target=h;message=RegisterWindowMessage("SHELLHOOK");CreateHandle(new CreateParams{Caption="Focused Moment isolated QA attention observer"});if(!RegisterShellHookWindow(Handle))throw new Exception("Windows rejected the shell attention observer.");}
 protected override void WndProc(ref Message m){if(m.Msg==message && m.LParam==target && m.WParam.ToInt64()==0x8006)Events.Add(new Entry{Seconds=(DateTime.UtcNow-started).TotalSeconds,WindowHandle=target.ToInt64(),Visible=IsWindowVisible(target),ShellEvent=0x8006});base.WndProc(ref m);}
 public void Dispose(){DeregisterShellHookWindow(Handle);DestroyHandle();}
}
'@
 $watcher=[ReleaseQaAttentionWatcher]::new($handle)
 try {Write-Output 'READY';$deadline=[DateTime]::UtcNow.AddSeconds($Seconds);while([DateTime]::UtcNow -lt $deadline){[Windows.Forms.Application]::DoEvents();Start-Sleep -Milliseconds 25};[pscustomobject]@{pid=$ProcessId;windowHandle=$WindowHandle;events=@($watcher.Events.ToArray());method='Windows HSHELL_FLASH notifications filtered to the isolated main HWND';limitation='Observes Windows shell attention events, not human perception or every taskbar animation frame.'}|ConvertTo-Json -Depth 5|Set-Content -LiteralPath $output -Encoding UTF8}finally{$watcher.Dispose()};exit 0
}
$root=[Windows.Automation.AutomationElement]::FromHandle($handle)
switch($Action){
 'Inspect' {[pscustomobject]@{pid=$ProcessId;windowHandle=$WindowHandle;visible=[ReleaseQaWindows]::IsWindowVisible($handle);minimized=[ReleaseQaWindows]::IsIconic($handle);elements=@(Get-Elements $root | ForEach-Object {Element-Json $_})}|ConvertTo-Json -Depth 6 -Compress}
 'MenuInspect' {[pscustomobject]@{pid=$ProcessId;windowHandle=$WindowHandle;items=@([ReleaseQaWindows]::Menu($handle))}|ConvertTo-Json -Depth 6 -Compress}
 'Click' {$element=Find-Element $root $Name ([Windows.Automation.ControlType]::Button);Click-Element $element;[pscustomobject]@{clicked=$true;method=$script:clickMethod}|ConvertTo-Json -Compress}
 'ClickPhysical' {$element=Find-Element $root $Name ([Windows.Automation.ControlType]::Button);if(-not $element.Current.IsEnabled){throw "Enabled button not found: $Name"};Focus-Window $handle;$point=Point-ForElement $element;Assert-PointOwner $point $handle;[void][ReleaseQaWindows]::SetCursorPos($point.X,$point.Y);[ReleaseQaWindows]::mouse_event(2,0,0,0,[UIntPtr]::Zero);Start-Sleep -Milliseconds 30;[ReleaseQaWindows]::mouse_event(4,0,0,0,[UIntPtr]::Zero);'{"clicked":true,"method":"native-pointer"}'}
 'DialogClick' {if(-not ($windows|Where-Object {$_.Handle -eq $WindowHandle -and $_.ClassName -eq '#32770' -and $_.Visible})){throw 'Expected an owned visible native dialog.'};$element=Get-Elements $root|Where-Object {$_.Current.Name -eq $Name -and $_.Current.AutomationId -in @('CommandButton_1','CommandButton_2')}|Select-Object -First 1;if(-not $element){throw 'Native dialog command button was not found.'};Click-Element $element;[pscustomobject]@{clicked=$true;method=$script:clickMethod}|ConvertTo-Json -Compress}
 'Toggle' {$element=Find-Element $root $Name ([Windows.Automation.ControlType]::CheckBox);if(-not $element.Current.IsEnabled){throw 'Checkbox is disabled.'};$pattern=$element.GetCurrentPattern([Windows.Automation.TogglePattern]::Pattern);$before=$pattern.Current.ToggleState.ToString();$pattern.Toggle();[pscustomobject]@{before=$before;after=$pattern.Current.ToggleState.ToString()}|ConvertTo-Json -Compress}
 'MenuClick' {$item=[ReleaseQaWindows]::Menu($handle)|Where-Object {$_.Name -eq $Name}|Select-Object -First 1;if(-not $item -or -not $item.Enabled){throw "Enabled menu item not found: $Name"};if($item.Right -le $item.Left -or $item.Bottom -le $item.Top){throw 'Menu item has no native screen rectangle.'};$point=[ReleaseQaWindows+Point]::new();$point.X=[int](($item.Left+$item.Right)/2);$point.Y=[int](($item.Top+$item.Bottom)/2);Assert-PointOwner $point $handle;[void][ReleaseQaWindows]::SetCursorPos($point.X,$point.Y);[ReleaseQaWindows]::mouse_event(2,0,0,0,[UIntPtr]::Zero);[ReleaseQaWindows]::mouse_event(4,0,0,0,[UIntPtr]::Zero);'{"clicked":true}'}
 'SetText' {$element=Find-Element $root $Name ([Windows.Automation.ControlType]::Edit);$pattern=$element.GetCurrentPattern([Windows.Automation.ValuePattern]::Pattern);$pattern.SetValue($Value);'{"updated":true}'}
 'TypeText' {$element=Find-Element $root $Name ([Windows.Automation.ControlType]::Edit);Focus-Window $handle;$element.SetFocus();Start-Sleep -Milliseconds 100;if([ReleaseQaWindows]::GetForegroundWindow() -ne $handle -or -not [Windows.Automation.Automation]::Compare($element,[Windows.Automation.AutomationElement]::FocusedElement)){throw 'Target edit does not own keyboard focus; refusing global input.'};[Windows.Forms.SendKeys]::SendWait('^a');[ReleaseQaWindows]::Text($Value);'{"typed":true}'}
 'Hide' {[void][ReleaseQaWindows]::ShowWindow($handle,0);'{"hidden":true}'}
 'Minimize' {[void][ReleaseQaWindows]::ShowWindow($handle,6);'{"minimized":true}'}
 'Show' {[void][ReleaseQaWindows]::ShowWindow($handle,5);[void][ReleaseQaWindows]::ShowWindow($handle,9);[void][ReleaseQaWindows]::SetForegroundWindow($handle);Start-Sleep -Milliseconds 300;if(-not [ReleaseQaWindows]::IsWindowVisible($handle)){throw 'Owned main window did not become visible.'};[pscustomobject]@{shown=$true}|ConvertTo-Json -Compress}
 'Screenshot' {$output=[IO.Path]::GetFullPath($OutputPath);if(-not $output.StartsWith($qaRoot,[StringComparison]::OrdinalIgnoreCase)){throw 'Output is outside native QA evidence.'};$rect=[ReleaseQaWindows+Rect]::new();[void][ReleaseQaWindows]::GetWindowRect($handle,[ref]$rect);$bitmap=[Drawing.Bitmap]::new($rect.Right-$rect.Left,$rect.Bottom-$rect.Top);$graphics=[Drawing.Graphics]::FromImage($bitmap);$dc=$graphics.GetHdc();try{$captured=[ReleaseQaWindows]::PrintWindow($handle,$dc,2)}finally{$graphics.ReleaseHdc($dc)};try{$bitmap.Save($output,[Drawing.Imaging.ImageFormat]::Png)}finally{$graphics.Dispose();$bitmap.Dispose()};[pscustomobject]@{captured=$captured;path=$output}|ConvertTo-Json -Compress}
}
