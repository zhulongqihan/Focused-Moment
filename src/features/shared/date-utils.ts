import type { FocusRecord } from "../../lib/contracts";

export const calendarDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
  weekday: "short",
});

const recordDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDueDate(value: string) {
  const date = parseLocalDate(value);
  if (!date) {
    return `截止 ${value}`;
  }

  const today = parseLocalDate(getToday());
  const difference = today
    ? Math.round((date.getTime() - today.getTime()) / 86_400_000)
    : null;
  if (difference === 0) {
    return "今天截止";
  }
  if (difference === 1) {
    return "明天截止";
  }
  if (difference !== null && difference < 0) {
    return `已逾期 · ${calendarDateFormatter.format(date)}`;
  }
  return `截止 ${calendarDateFormatter.format(date)}`;
}

export function isOverdue(value: string) {
  const date = parseLocalDate(value);
  const today = parseLocalDate(getToday());
  return Boolean(date && today && date.getTime() < today.getTime());
}

export function formatRecordDate(record: FocusRecord) {
  const date = new Date(record.completedAt);
  if (!Number.isNaN(date.getTime())) {
    return recordDateFormatter.format(date);
  }
  return `${record.completedDate} ${record.completedTime}`.trim();
}

export function formatAnalyticsDate(value: string) {
  const date = parseLocalDate(value);
  return date ? calendarDateFormatter.format(date) : value;
}

export function formatArchiveRangeDate(value: string) {
  const date = parseLocalDate(value);
  return date ? `${date.getMonth() + 1}月${date.getDate()}日` : value;
}

export function formatRecordDay(value: string) {
  if (value === "未记录日期") {
    return value;
  }

  const date = parseLocalDate(value);
  const today = parseLocalDate(getToday());
  const difference = date && today
    ? Math.round((date.getTime() - today.getTime()) / 86_400_000)
    : null;
  const dateLabel = formatAnalyticsDate(value);

  if (difference === 0) {
    return `今天 · ${dateLabel}`;
  }
  if (difference === -1) {
    return `昨天 · ${dateLabel}`;
  }
  return dateLabel;
}

export function formatDurationMs(value: number) {
  const totalSeconds = Math.max(0, Math.round(value / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}
