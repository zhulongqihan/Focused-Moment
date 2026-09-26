import type { TodoItem } from "../../lib/contracts";

export interface TodoDateGroup {
  date: string;
  label: string;
  items: TodoItem[];
}

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseTodoDateKey(value: string) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTodoDateGroupLabel(value: string) {
  if (value === "未设置日期") return "收件箱 · 未安排";
  const date = parseTodoDateKey(value);
  if (!date) return value;

  const today = parseTodoDateKey(localDateKey());
  const difference = today
    ? Math.round((date.getTime() - today.getTime()) / 86_400_000)
    : null;
  const dateLabel = `${date.getMonth() + 1}月${date.getDate()}日`;
  const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date);

  if (difference === 0) return `今天 · ${dateLabel}`;
  if (difference === 1) return `明天 · ${dateLabel}`;
  if (difference !== null && difference < 0) return `已过期 · ${dateLabel}`;
  return `${dateLabel} · ${weekday}`;
}

export function groupTodosByDate(items: TodoItem[]) {
  const groups = new Map<string, TodoDateGroup>();
  for (const item of items) {
    const date = item.scheduledDate.trim() || "未设置日期";
    const group = groups.get(date);
    if (group) {
      group.items.push(item);
      continue;
    }
    groups.set(date, { date, label: formatTodoDateGroupLabel(date), items: [item] });
  }
  return Array.from(groups.values());
}
