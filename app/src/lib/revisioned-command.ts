import { invoke } from "@tauri-apps/api/core";
import type { DataRevisions, RevisionedResult } from "./contracts";

type RevisionListener = (revisions: DataRevisions) => void;

const revisionListeners = new Set<RevisionListener>();

export function subscribeToLocalRevisionChanges(listener: RevisionListener) {
  revisionListeners.add(listener);
  return () => revisionListeners.delete(listener);
}

export async function invokeRevisioned<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const result = await invoke<RevisionedResult<T> | T>(command, args);
  if (!result || typeof result !== "object" || !("revisions" in result) || !("value" in result)) {
    return result as T;
  }
  const revisioned = result as RevisionedResult<T>;
  for (const listener of revisionListeners) {
    try {
      listener(revisioned.revisions);
    } catch (error) {
      console.error("本地提交版本通知失败。", error);
    }
  }
  return revisioned.value;
}
