import type { FocusRecord, TodoItem } from "../../lib/contracts";

export interface FocusHistoryCommandResult {
  id: string;
  kind: "task" | "record" | "date";
  taskId: number | null;
  recordId: number | null;
  date: string | null;
  label: string;
  detail: string;
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase();
}

function formatMinutes(durationMs: number) {
  const minutes = Math.round(Math.max(0, durationMs) / 60_000);
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
}

function matches(value: string, query: string) {
  return normalize(value).includes(query);
}

function recordDate(record: FocusRecord) {
  return record.completedDate.trim() || record.completedAt.slice(0, 10) || "未记录日期";
}

export function buildFocusHistoryResults(
  todos: TodoItem[],
  records: FocusRecord[],
  query: string,
): FocusHistoryCommandResult[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  const results: FocusHistoryCommandResult[] = [];
  for (const todo of todos) {
    const linked = records.filter((record) => record.linkedTodoId === todo.id);
    const durationMs = linked.reduce((total, record) => total + record.durationMs, 0);
    const latest = linked[0];
    const searchable = `${todo.title} ${todo.scheduledDate} ${todo.scheduledTime} ${todo.continuationNote}`;
    if (!matches(searchable, normalizedQuery)) continue;
    results.push({
      id: `history-task-${todo.id}`,
      kind: "task",
      taskId: todo.id,
      recordId: null,
      date: null,
      label: `任务：${todo.title}`,
      detail: `${linked.length} 轮 · ${formatMinutes(durationMs)} · 最近 ${latest ? `${recordDate(latest)} ${latest.completedTime || "未填写时间"}` : "暂无记录"}${todo.continuationNote ? ` · 下次：${todo.continuationNote}` : ""}`,
    });
  }

  for (const record of records) {
    const date = recordDate(record);
    const searchable = `${record.title} ${record.linkedTodoTitle ?? ""} ${date} ${record.completedTime} ${record.durationLabel}`;
    if (!matches(searchable, normalizedQuery)) continue;
    results.push({
      id: `history-record-${record.id}`,
      kind: "record",
      taskId: record.linkedTodoId,
      recordId: record.id,
      date,
      label: `记录：${record.title}`,
      detail: `${date} ${record.completedTime || "未填写时间"} · ${record.durationLabel} · ${record.linkedTodoTitle ?? "独立专注"}`,
    });
  }

  const dateBuckets = new Map<string, { count: number; durationMs: number }>();
  for (const record of records) {
    const date = recordDate(record);
    if (date === "未记录日期" || !matches(date, normalizedQuery)) continue;
    const bucket = dateBuckets.get(date) ?? { count: 0, durationMs: 0 };
    bucket.count += 1;
    bucket.durationMs += record.durationMs;
    dateBuckets.set(date, bucket);
  }
  for (const [date, bucket] of dateBuckets) {
    results.push({
      id: `history-date-${date}`,
      kind: "date",
      taskId: null,
      recordId: null,
      date,
      label: `日期：${date}`,
      detail: `${bucket.count} 条记录 · ${formatMinutes(bucket.durationMs)} · 定位日期归档`,
    });
  }

  return results.slice(0, 20);
}
