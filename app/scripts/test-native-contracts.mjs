import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { verifyNativeContracts } from "./verify-native-contracts.mjs";

const fixtureRoot = mkdtempSync(join(tmpdir(), "focused-moment-native-contracts-"));

try {
  mkdirSync(join(fixtureRoot, "src-tauri", "src"), { recursive: true });
  mkdirSync(join(fixtureRoot, "src"), { recursive: true });
  writeFileSync(join(fixtureRoot, "src-tauri", "src", "runtime.rs"), `
    #[tauri::command]
    fn bootstrap_shell() {}
    const EVENT: &str = "state-sync";
    tauri::generate_handler![bootstrap_shell]
  `);
  writeFileSync(join(fixtureRoot, "src-tauri", "src", "main.rs"), "fn main() {}");
  writeFileSync(join(fixtureRoot, "src", "bridge.ts"), `
    import { emit, listen } from "@tauri-apps/api/event";
    invoke<void>("bootstrap_shell");
    listen("state-sync", () => {});
    emit("state-sync");
  `);

  const passing = verifyNativeContracts(fixtureRoot);
  assert.deepEqual(passing.registeredCommands, ["bootstrap_shell"]);
  assert.deepEqual(passing.frontendInvokes, ["bootstrap_shell"]);
  assert.deepEqual(passing.frontendEvents, ["state-sync"]);

  writeFileSync(join(fixtureRoot, "src", "bridge.ts"), "invoke<void>(\"missing_command\");");
  assert.throws(() => verifyNativeContracts(fixtureRoot), /not registered/);

  console.log(JSON.stringify({
    success: true,
    cases: ["registered-command-and-event-contract", "unknown-frontend-command-rejected"],
  }, null, 2));
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}
