#!/usr/bin/env bash

set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This smoke test must run on macOS." >&2
  exit 2
fi

if [[ "${CI:-}" != "true" ]]; then
  echo "Refusing to launch the app outside CI; the smoke test is intentionally isolated to a disposable runner." >&2
  exit 2
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
app_path="${1:-$repo_root/src-tauri/target/debug/bundle/macos/Focused Moment.app}"
app_executable="$app_path/Contents/MacOS/focused-moment"
smoke_root="${RUNNER_TEMP:-$repo_root/output/qa}/focused-moment-macos-native-${GITHUB_RUN_ID:-$$}"
smoke_home="$smoke_root/home"
smoke_tmp="$smoke_root/tmp"
work_dir="$smoke_root/workdir"
second_work_dir="$smoke_root/second-workdir"
canonical_dir="$smoke_home/Library/Application Support/FocusedMoment"
legacy_dir="$work_dir/FocusedMoment"
report_path="$smoke_root/report.md"
direct_log="$smoke_root/direct.log"
finder_log="$smoke_root/finder.log"
secondary_log="$smoke_root/secondary.log"
ax_probe_log="$smoke_root/accessibility-probe.log"
ax_tree_log="$smoke_root/accessibility-tree.log"
tray_probe_log="$smoke_root/tray-probe.log"
system_tray_probe_log="$smoke_root/system-tray-probe.log"
floating_probe_log="$smoke_root/floating-probe.log"
tray_interaction_log="$smoke_root/tray-interaction.log"
install_log="$smoke_root/install.log"
install_dmg_log="$smoke_root/install-dmg.log"
screen_capture="$smoke_root/screen.png"
install_mount="$smoke_root/dmg-mount"
install_home="$smoke_root/install-home"
install_tmp="$smoke_root/install-tmp"
install_work_dir="$smoke_root/install-workdir"
install_applications="$smoke_root/Applications"
installed_app="$install_applications/Focused Moment.app"
installed_executable="$installed_app/Contents/MacOS/focused-moment"
install_canonical_dir="$install_home/Library/Application Support/FocusedMoment"

mkdir -p "$smoke_home" "$smoke_tmp" "$work_dir" "$second_work_dir"
printf '%s\n' \
  "# macOS native smoke" \
  "" \
  "- runner: $(sw_vers -productName) $(sw_vers -productVersion) ($(uname -m))" \
  "- commit: ${GITHUB_SHA:-local}" \
  "- app: $app_path" \
  "- isolated HOME: $smoke_home" \
  "- isolated working directories: $work_dir and $second_work_dir" \
  > "$report_path"

if [[ ! -x "$app_executable" ]]; then
  echo "Built macOS app executable not found: $app_executable" >&2
  exit 1
fi

# The unsigned CI bundle may carry a quarantine attribute. Removing it is
# scoped to the freshly built disposable artifact, never to a user app.
xattr -dr com.apple.quarantine "$app_path" 2>/dev/null || true

running_pids=()
last_pid=""
launchctl_home_marker=""
launchctl_home_previous=""
install_image_attached=""

append_report() {
  printf '%s\n' "$1" >> "$report_path"
}

stop_pid() {
  local pid="$1"
  if kill -0 "$pid" 2>/dev/null; then
    kill -TERM "$pid" 2>/dev/null || true
    for _ in {1..20}; do
      if ! kill -0 "$pid" 2>/dev/null; then
        break
      fi
      sleep 1
    done
    if kill -0 "$pid" 2>/dev/null; then
      kill -KILL "$pid" 2>/dev/null || true
    fi
  fi
  wait "$pid" 2>/dev/null || true
}

wait_for_direct_start() {
  local pid="$1"
  for _ in {1..45}; do
    if [[ -d "$canonical_dir" ]]; then
      sleep 2
      if kill -0 "$pid" 2>/dev/null; then
        return 0
      fi
      echo "Focused Moment exited immediately after storage initialization." >&2
      sed -n '1,160p' "$direct_log" >&2 || true
      return 1
    fi
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "Focused Moment exited before storage initialization." >&2
      sed -n '1,160p' "$direct_log" >&2 || true
      return 1
    fi
    sleep 1
  done

  echo "Timed out waiting for canonical macOS storage directory: $canonical_dir" >&2
  sed -n '1,160p' "$direct_log" >&2 || true
  return 1
}

start_direct() {
  local launch_dir="${1:-$work_dir}"
  pushd "$launch_dir" >/dev/null
  HOME="$smoke_home" TMPDIR="$smoke_tmp" "$app_executable" > "$direct_log" 2>&1 &
  local pid=$!
  popd >/dev/null
  running_pids+=("$pid")
  wait_for_direct_start "$pid"
  append_report "- direct native launch: PASS (pid $pid)"
  last_pid="$pid"
}

stop_all_known_pids() {
  local pid
  for pid in "${running_pids[@]:-}"; do
    stop_pid "$pid"
  done
  running_pids=()
}

restore_launchctl_home() {
  if [[ -z "$launchctl_home_marker" ]]; then
    return
  fi
  if [[ -n "$launchctl_home_previous" ]]; then
    launchctl setenv HOME "$launchctl_home_previous"
  else
    launchctl unsetenv HOME || true
  fi
  launchctl_home_marker=""
}

detach_install_image() {
  if [[ -z "$install_image_attached" ]]; then
    return
  fi
  hdiutil detach "$install_mount" -quiet >/dev/null 2>&1 || true
  install_image_attached=""
}

cleanup() {
  stop_all_known_pids
  detach_install_image
  restore_launchctl_home
}
trap cleanup EXIT

if [[ -e "$legacy_dir" ]]; then
  echo "Unexpected legacy directory in fresh smoke fixture: $legacy_dir" >&2
  exit 1
fi

start_direct
direct_pid="$last_pid"
screencapture -x "$screen_capture" >/dev/null 2>&1 || true
if [[ ! -d "$canonical_dir" ]]; then
  echo "Canonical Application Support directory was not created." >&2
  exit 1
fi
if [[ -e "$legacy_dir" ]]; then
  echo "Fresh launch unexpectedly created storage in the working directory." >&2
  exit 1
fi
append_report "- canonical storage path: PASS ($canonical_dir)"
append_report "- fresh launch did not create legacy working-directory storage: PASS"
stop_pid "$direct_pid"
running_pids=()

# Remove only the synthetic canonical directory, then seed a valid legacy
# snapshot. The source is hashed before and after migration to prove that the
# migration is copy/validate/switch, not destructive move.
rm -rf -- "$canonical_dir"
mkdir -p "$legacy_dir"
printf '%s\n' '{"schemaVersion":2,"focusRecords":[],"nextRecordId":7,"todoItems":[],"nextTodoId":0,"timerPreferences":{"pomodoroFocusMinutes":25,"pomodoroBreakMinutes":5,"stopwatchReminderMinutes":30,"toastReminderEnabled":true,"windowAttentionReminderEnabled":true,"soundReminderEnabled":true,"alertSoundKey":"soft_chime"}}' > "$legacy_dir/focused-moment-state.json"
printf '%s\n' '{"schemaVersion":2,"modeKey":"stopwatch","stopwatchElapsedMs":42000,"countdownElapsedMs":0,"countdownDurationMs":1500000,"pomodoroElapsedMs":0,"pomodoroPhaseKey":"focus","pendingPomodoroRecordMs":null,"isRunning":false,"anchorWallClockMs":null,"currentTaskTitle":"","linkedTodoId":null,"completeLinkedTodoOnFinish":false,"completedFocusCount":0,"completedBreakCount":0,"alertSequence":0,"activeAlertKey":null,"stopwatchTargetAlerted":false,"stopwatchStageIndex":0}' > "$legacy_dir/focused-moment-runtime.json"
legacy_state_hash_before="$(shasum -a 256 "$legacy_dir/focused-moment-state.json" | awk '{print $1}')"
legacy_runtime_hash_before="$(shasum -a 256 "$legacy_dir/focused-moment-runtime.json" | awk '{print $1}')"

start_direct
direct_pid="$last_pid"
for _ in {1..20}; do
  if [[ -f "$canonical_dir/focused-moment-state.json" && -f "$canonical_dir/focused-moment-runtime.json" ]]; then
    break
  fi
  sleep 1
done

if [[ ! -f "$canonical_dir/focused-moment-state.json" || ! -f "$canonical_dir/focused-moment-runtime.json" ]]; then
  echo "Migrated state/runtime files were not found in Application Support." >&2
  sed -n '1,160p' "$direct_log" >&2 || true
  exit 1
fi
grep -Fq '"nextRecordId":7' "$canonical_dir/focused-moment-state.json"
grep -Fq '"stopwatchElapsedMs":42000' "$canonical_dir/focused-moment-runtime.json"
legacy_state_hash_after="$(shasum -a 256 "$legacy_dir/focused-moment-state.json" | awk '{print $1}')"
legacy_runtime_hash_after="$(shasum -a 256 "$legacy_dir/focused-moment-runtime.json" | awk '{print $1}')"
if [[ "$legacy_state_hash_before" != "$legacy_state_hash_after" || "$legacy_runtime_hash_before" != "$legacy_runtime_hash_after" ]]; then
  echo "Legacy source changed during migration." >&2
  exit 1
fi
if ! find "$work_dir" -maxdepth 1 -type d -name 'FocusedMoment.migration-backup-*' -print -quit | grep -q .; then
  echo "Migration backup directory was not created beside the legacy source." >&2
  exit 1
fi
append_report "- valid legacy state/runtime migrated into Application Support: PASS"
append_report "- legacy source preserved byte-for-byte: PASS"
append_report "- timestamped migration backup retained beside source: PASS"
stop_pid "$direct_pid"
running_pids=()

start_direct "$second_work_dir"
direct_pid="$last_pid"
if grep -Fq '本地数据未加载' "$direct_log"; then
  echo "Restart after migration reported a storage startup failure." >&2
  sed -n '1,160p' "$direct_log" >&2 || true
  exit 1
fi
append_report "- restart from migrated Application Support data using a different working directory: PASS"

# The first process is the singleton. A second native launch from another
# working directory must hand off to it and exit cleanly instead of creating a
# second app process.
pushd "$work_dir" >/dev/null
HOME="$smoke_home" TMPDIR="$smoke_tmp" "$app_executable" > "$secondary_log" 2>&1 &
secondary_pid=$!
popd >/dev/null
if wait "$secondary_pid"; then
  secondary_exit_code=0
else
  secondary_exit_code=$?
fi
if [[ "$secondary_exit_code" -ne 0 ]]; then
  echo "The secondary macOS launch did not exit cleanly (exit $secondary_exit_code)." >&2
  sed -n '1,160p' "$secondary_log" >&2 || true
  exit 1
fi
if ! kill -0 "$direct_pid" 2>/dev/null; then
  echo "The primary macOS instance was not alive after the secondary launch." >&2
  exit 1
fi
append_report "- secondary native launch exits without creating a second instance: PASS"

# Record the actual macOS accessibility surface before adding interaction
# assertions. WebKit/Tauri may expose a different hierarchy from Chromium;
# keeping this probe in the artifact prevents guessed selectors from becoming
# false native evidence.
if /usr/bin/osascript > "$ax_probe_log" 2>&1 <<'APPLESCRIPT'
tell application "System Events"
  tell process "Focused Moment"
    set windowNames to name of every window
    set buttonNames to name of every button of window 1
    return "windows=" & (windowNames as text) & ";buttons=" & (buttonNames as text)
  end tell
end tell
APPLESCRIPT
then
  append_report "- macOS Accessibility window/button probe: PASS"
else
  append_report "- macOS Accessibility window/button probe: UNAVAILABLE (see accessibility-probe.log)"
fi

if /usr/bin/osascript > "$ax_tree_log" 2>&1 <<'APPLESCRIPT'
tell application "System Events"
  tell process "Focused Moment"
    set uiElements to entire contents of window 1
    set treeItems to {}
    set elementLimit to count of uiElements
    if elementLimit > 250 then set elementLimit to 250
    repeat with elementIndex from 1 to elementLimit
      set elementRef to item elementIndex of uiElements
      try
        set elementRole to role of elementRef
      on error
        set elementRole to "?"
      end try
      try
        set elementName to name of elementRef
      on error
        set elementName to ""
      end try
      set end of treeItems to (elementRole & ":" & elementName)
    end repeat
    set AppleScript's text item delimiters to linefeed
    return treeItems as text
  end tell
end tell
APPLESCRIPT
then
  append_report "- macOS Accessibility tree probe: PASS"
else
  append_report "- macOS Accessibility tree probe: UNAVAILABLE (see accessibility-tree.log)"
fi

if /usr/bin/osascript > "$tray_probe_log" 2>&1 <<'APPLESCRIPT'
tell application "System Events"
  tell process "Focused Moment"
    set itemNames to name of every menu bar item of menu bar 1
    return itemNames as text
  end tell
end tell
APPLESCRIPT
then
  append_report "- macOS application menu accessibility probe: PASS"
else
  append_report "- macOS application menu accessibility probe: UNAVAILABLE (see tray-probe.log)"
fi

if /usr/bin/osascript > "$system_tray_probe_log" 2>&1 <<'APPLESCRIPT'
tell application "System Events"
  set statusItems to {}
  repeat with processName in {"SystemUIServer", "ControlCenter", "NotificationCenter", "Dock"}
    try
      tell process (contents of processName)
        set barCount to count of menu bars
        set end of statusItems to ((contents of processName) & ":bars=" & (barCount as text))
        repeat with barIndex from 1 to barCount
          set itemRefs to entire contents of menu bar barIndex
          set itemLimit to count of itemRefs
          if itemLimit > 250 then set itemLimit to 250
          repeat with itemIndex from 1 to itemLimit
            set itemRef to item itemIndex of itemRefs
            try
              set itemRole to role of itemRef
            on error
              set itemRole to "?"
            end try
            try
              set itemName to name of itemRef
            on error
              set itemName to ""
            end try
            try
              set itemDescription to description of itemRef
            on error
              set itemDescription to ""
            end try
            try
              set itemPosition to position of itemRef as text
            on error
              set itemPosition to ""
            end try
            set end of statusItems to ((contents of processName) & ":bar" & (barIndex as text) & ":" & itemRole & ":" & itemName & ":" & itemDescription & ":" & itemPosition)
          end repeat
        end repeat
      end tell
    on error processError
      set end of statusItems to ((contents of processName) & ":ERROR:" & processError)
    end try
  end repeat
  set AppleScript's text item delimiters to linefeed
  return statusItems as text
end tell
APPLESCRIPT
then
  if grep -Fq "Focused Moment" "$system_tray_probe_log"; then
    append_report "- macOS status-bar item probe: PASS"
  else
    append_report "- macOS status-bar item probe: UNAVAILABLE (no Focused Moment item exposed; see system-tray-probe.log)"
  fi
else
  append_report "- macOS status-bar surface probe: UNAVAILABLE (see system-tray-probe.log)"
fi

# The compact top-bar control is intentionally hidden by the cinematic Today
# layout. Exercise the real keyboard-accessible command-palette route so the
# native smoke verifies that the configured Tauri floating window can actually
# be shown from the shipped UI.
if /usr/bin/osascript > "$floating_probe_log" 2>&1 <<'APPLESCRIPT'
tell application "System Events"
  tell process "Focused Moment"
    set frontmost to true
    keystroke "k" using {command down}
    delay 1
    repeat 8 times
      key code 125
    end repeat
    key code 36
    delay 2
    set windowNames to name of every window
    return "windows=" & (windowNames as text)
  end tell
end tell
APPLESCRIPT
then
  if grep -Fq "Focused Moment 悬浮工作台" "$floating_probe_log"; then
    append_report "- command-palette keyboard path shows the native floating workspace: PASS"
  else
    echo "The command-palette keyboard path did not expose the floating workspace window." >&2
    sed -n '1,160p' "$floating_probe_log" >&2 || true
    exit 1
  fi
else
  echo "The command-palette keyboard path could not be executed." >&2
  sed -n '1,160p' "$floating_probe_log" >&2 || true
  exit 1
fi

stop_pid "$direct_pid"
running_pids=()

# Exercise LaunchServices/Finder-style bundle opening separately from the
# direct executable checks above. launchctl HOME is isolated on the disposable
# CI login session so the bundle does not target a developer account.
launchctl_home_previous="$(launchctl getenv HOME 2>/dev/null || true)"
launchctl_home_marker="set"
launchctl setenv HOME "$smoke_home"
open -n "$app_path" > "$finder_log" 2>&1
finder_pid=""
for _ in {1..45}; do
  finder_pid="$(pgrep -f "$app_executable" | head -n 1 || true)"
  if [[ -n "$finder_pid" ]]; then
    break
  fi
  sleep 1
done
if [[ -z "$finder_pid" ]]; then
  echo "LaunchServices did not start the built app bundle." >&2
  sed -n '1,160p' "$finder_log" >&2 || true
  exit 1
fi
append_report "- LaunchServices/Finder-style bundle launch: PASS (pid $finder_pid)"
stop_pid "$finder_pid"

# A macOS DMG is the installation boundary for this product: mount the exact
# artifact produced by the build, copy the app to a disposable Applications
# directory, and launch that copied bundle through LaunchServices with a new
# synthetic HOME. Never write to the runner's real /Applications or user data.
dmg_path="$(find "$repo_root/src-tauri/target/debug/bundle/dmg" -maxdepth 1 -type f -name '*.dmg' -print -quit)"
if [[ -z "$dmg_path" ]]; then
  echo "Debug macOS DMG was not produced." >&2
  exit 1
fi
mkdir -p "$install_mount" "$install_home" "$install_tmp" "$install_work_dir" "$install_applications"
hdiutil attach -readonly -nobrowse -mountpoint "$install_mount" "$dmg_path" > "$install_dmg_log" 2>&1
install_image_attached="attached"
if [[ ! -d "$install_mount/Focused Moment.app" ]]; then
  echo "Mounted DMG did not contain Focused Moment.app." >&2
  find "$install_mount" -maxdepth 2 -print >&2 || true
  exit 1
fi
ditto "$install_mount/Focused Moment.app" "$installed_app"
if [[ ! -x "$installed_executable" ]]; then
  echo "Copied installed app executable not found: $installed_executable" >&2
  exit 1
fi
append_report "- read-only DMG mounted and app copied to isolated Applications directory: PASS ($dmg_path)"

pushd "$install_work_dir" >/dev/null
HOME="$install_home" TMPDIR="$install_tmp" "$installed_executable" > "$install_log" 2>&1 &
installed_pid=$!
popd >/dev/null
running_pids+=("$installed_pid")
for _ in {1..45}; do
  if [[ -d "$install_canonical_dir" ]]; then
    break
  fi
  if ! kill -0 "$installed_pid" 2>/dev/null; then
    echo "Copied installed app exited before initializing its canonical data directory." >&2
    sed -n '1,160p' "$install_log" >&2 || true
    exit 1
  fi
  sleep 1
done
if [[ ! -d "$install_canonical_dir" ]]; then
  echo "Installed app did not initialize its canonical Application Support directory." >&2
  sed -n '1,160p' "$install_log" >&2 || true
  exit 1
fi
append_report "- copied installed app launches with canonical Application Support data: PASS (pid $installed_pid)"
stop_pid "$installed_pid"
installed_pid=""
running_pids=()
detach_install_image

append_report ""
append_report "The smoke uses only RUNNER_TEMP and a synthetic HOME; no developer data directory is read or migrated."
cat "$report_path"
