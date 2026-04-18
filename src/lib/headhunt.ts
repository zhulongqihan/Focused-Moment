import { invoke } from "@tauri-apps/api/core";
import type { HeadhuntPayload, HeadhuntSnapshot } from "./contracts";

export async function getHeadhuntSnapshot() {
  return invoke<HeadhuntSnapshot>("get_headhunt_snapshot");
}

export async function setCurrentHeadhuntBanner(bannerId: string) {
  return invoke<HeadhuntSnapshot>("set_current_headhunt_banner", { bannerId });
}

export async function performHeadhunt(pulls: 1 | 10) {
  return invoke<HeadhuntPayload>("perform_headhunt", { pulls });
}

export async function performPreviewHeadhunt(pulls: 1 | 10) {
  return invoke<HeadhuntPayload>("perform_preview_headhunt", { pulls });
}
