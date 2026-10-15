import { invoke } from "@tauri-apps/api/core";
import type { PendingBookmarkNotice, TodoDraft, TodoItem } from "./contracts";

export async function getTodoItems() {
  return invoke<TodoItem[]>("get_todo_items");
}

export async function createTodoItem(input: TodoDraft) {
  return invoke<TodoItem[]>("create_todo_item", {
    title: input.title,
    scheduledDate: input.scheduledDate,
    scheduledTime: input.scheduledTime,
    importanceKey: input.importanceKey,
  });
}

export async function updateTodoItem(id: number, input: TodoDraft) {
  return invoke<TodoItem[]>("update_todo_item", {
    id,
    title: input.title,
    scheduledDate: input.scheduledDate,
    scheduledTime: input.scheduledTime,
    importanceKey: input.importanceKey,
  });
}

export async function updateTodoContinuationNote(id: number, note: string) {
  return invoke<TodoItem[]>("update_todo_continuation_note", { id, note });
}

export async function getPendingBookmarkNotices() {
  return invoke<PendingBookmarkNotice[]>("get_pending_bookmark_notices");
}

export async function saveContinuationBookmark(todoId: number, recordId: number, note: string) {
  return invoke<TodoItem[]>("save_continuation_bookmark", { todoId, recordId, note });
}

export async function acknowledgePendingBookmarkNotice(recordId: number) {
  return invoke<void>("acknowledge_pending_bookmark_notice", { recordId });
}

export async function toggleTodoItem(id: number) {
  return invoke<TodoItem[]>("toggle_todo_item", { id });
}

export async function deleteTodoItem(id: number) {
  return invoke<TodoItem[]>("delete_todo_item", { id });
}

export async function restoreTodoItem(item: TodoItem) {
  return invoke<TodoItem[]>("restore_todo_item", { item });
}
