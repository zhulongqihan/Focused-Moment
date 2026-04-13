import { invoke } from "@tauri-apps/api/core";
import type { HeadhuntPayload, HeadhuntSnapshot } from "./contracts";

export async function getHeadhuntSnapshot() {
  return invoke<HeadhuntSnapshot>("get_headhunt_snapshot");
}

export async function performHeadhunt(pulls: 1 | 10) {
  return invoke<HeadhuntPayload>("perform_headhunt", { pulls });
}
