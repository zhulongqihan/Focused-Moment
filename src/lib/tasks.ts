import { invoke } from "@tauri-apps/api/core";
import type { TodoDraft, TodoItem } from "./contracts";

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

export async function toggleTodoItem(id: number) {
  return invoke<TodoItem[]>("toggle_todo_item", { id });
}

export async function deleteTodoItem(id: number) {
  return invoke<TodoItem[]>("delete_todo_item", { id });
}
