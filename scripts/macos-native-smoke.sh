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

cleanup() {
  stop_all_known_pids
  restore_launchctl_home
}
trap cleanup EXIT

if [[ -e "$legacy_dir" ]]; then
  echo "Unexpected legacy directory in fresh smoke fixture: $legacy_dir" >&2
  exit 1
fi

start_direct
direct_pid="$last_pid"
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

append_report ""
append_report "The smoke uses only RUNNER_TEMP and a synthetic HOME; no developer data directory is read or migrated."
cat "$report_path"
