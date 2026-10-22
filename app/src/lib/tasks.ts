import { invoke } from "@tauri-apps/api/core";
import type { PendingBookmarkNotice, TodoDraft, TodoItem } from "./contracts";
import { invokeRevisioned } from "./revisioned-command";

export async function getTodoItems() {
  return invoke<TodoItem[]>("get_todo_items");
}

export async function createTodoItem(input: TodoDraft) {
  return invokeRevisioned<TodoItem[]>("create_todo_item", {
    title: input.title,
    scheduledDate: input.scheduledDate,
    scheduledTime: input.scheduledTime,
    importanceKey: input.importanceKey,
  });
}

export async function updateTodoItem(id: number, input: TodoDraft) {
  return invokeRevisioned<TodoItem[]>("update_todo_item", {
    id,
    title: input.title,
    scheduledDate: input.scheduledDate,
    scheduledTime: input.scheduledTime,
    importanceKey: input.importanceKey,
  });
}

export async function updateTodoContinuationNote(id: number, note: string) {
  return invokeRevisioned<TodoItem[]>("update_todo_continuation_note", { id, note });
}

export async function getPendingBookmarkNotices() {
  return invoke<PendingBookmarkNotice[]>("get_pending_bookmark_notices");
}

export async function saveContinuationBookmark(todoId: number, recordId: number, note: string) {
  return invokeRevisioned<TodoItem[]>("save_continuation_bookmark", { todoId, recordId, note });
}

export async function acknowledgePendingBookmarkNotice(recordId: number) {
  return invoke<void>("acknowledge_pending_bookmark_notice", { recordId });
}

export async function toggleTodoItem(id: number) {
  return invokeRevisioned<TodoItem[]>("toggle_todo_item", { id });
}

export async function deleteTodoItem(id: number) {
  return invokeRevisioned<TodoItem[]>("delete_todo_item", { id });
}

export async function restoreTodoItem(item: TodoItem) {
  return invokeRevisioned<TodoItem[]>("restore_todo_item", { item });
}
