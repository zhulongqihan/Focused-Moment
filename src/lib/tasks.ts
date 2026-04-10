import { invoke } from "@tauri-apps/api/core";
import type { TodoItem } from "./contracts";

export async function getTodoItems() {
  return invoke<TodoItem[]>("get_todo_items");
}

export async function createTodoItem(title: string) {
  return invoke<TodoItem[]>("create_todo_item", { title });
}

export async function updateTodoItem(id: number, title: string) {
  return invoke<TodoItem[]>("update_todo_item", { id, title });
}

export async function toggleTodoItem(id: number) {
  return invoke<TodoItem[]>("toggle_todo_item", { id });
}

export async function deleteTodoItem(id: number) {
  return invoke<TodoItem[]>("delete_todo_item", { id });
}
