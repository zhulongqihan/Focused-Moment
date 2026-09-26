import type { TodoImportance, TodoItem } from "../../lib/contracts";
import { formatDueDate } from "../shared/date-utils";

export function sortTodos(items: TodoItem[]) {
  const importanceRank: Record<TodoImportance, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return items.slice().sort((left, right) => {
    if (left.isCompleted !== right.isCompleted) {
      return Number(left.isCompleted) - Number(right.isCompleted);
    }

    const leftHasTime = Boolean(left.scheduledTime.trim());
    const rightHasTime = Boolean(right.scheduledTime.trim());

    return (
      left.scheduledDate.localeCompare(right.scheduledDate) ||
      Number(rightHasTime) - Number(leftHasTime) ||
      left.scheduledTime.localeCompare(right.scheduledTime) ||
      importanceRank[left.importanceKey] - importanceRank[right.importanceKey] ||
      right.id - left.id
    );
  });
}

export function formatTodoDue(item: TodoItem) {
  if (!item.scheduledDate.trim()) {
    return "未安排";
  }
  return `${formatDueDate(item.scheduledDate)}${item.scheduledTime ? ` · ${item.scheduledTime}` : ""}`;
}

export function importanceLabel(value: TodoImportance) {
  return value === "high" ? "高" : value === "low" ? "低" : "中";
}
