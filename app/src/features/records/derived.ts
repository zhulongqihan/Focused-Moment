import type { AnalyticsSnapshot, FocusRecord } from "../../lib/contracts";
import type { RecordGroupShape } from "../../lib/theme-contracts";
import {
  formatAnalyticsDate,
  formatDurationMs,
  formatLocalDateKey,
  getToday,
  parseLocalDate,
} from "../shared/date-utils";

export function recordDateKey(record: FocusRecord) {
  if (record.completedDate.trim()) {
    return record.completedDate;
  }

  const dateMatch = record.completedAt.match(/^\d{4}-\d{2}-\d{2}/);
  return dateMatch?.[0] ?? "未记录日期";
}

export function groupRecordsByDate(items: FocusRecord[]): RecordGroupShape[] {
  const groups = new Map<string, RecordGroupShape>();

  for (const record of items) {
    const date = recordDateKey(record);
    const current = groups.get(date);
    if (current) {
      current.records.push(record);
      current.totalDurationMs += record.durationMs;
    } else {
      groups.set(date, {
        date,
        records: [record],
        totalDurationMs: record.durationMs,
      });
    }
  }

  return Array.from(groups.values());
}

export function getRecentTrendDays(items: AnalyticsSnapshot["dailyBreakdown"]) {
  const today = parseLocalDate(getToday());
  if (!today) {
    return items.slice(0, 7);
  }

  const byDate = new Map(items.map((day) => [day.date, day]));
  const days: AnalyticsSnapshot["dailyBreakdown"] = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - offset);
    const dateKey = formatLocalDateKey(date);
    days.push(
      byDate.get(dateKey) ?? {
        date: dateKey,
        totalDurationMs: 0,
        totalDurationLabel: "00:00:00",
        sessionCount: 0,
        linkedSessionCount: 0,
        independentSessionCount: 0,
      }
    );
  }

  return days;
}

export function mergeArchiveDays(days: AnalyticsSnapshot["dailyBreakdown"], items: FocusRecord[]) {
  const recordsByDate = new Map(
    groupRecordsByDate(items).map((group) => [group.date, group]),
  );

  return days.map((day) => {
    const group = recordsByDate.get(day.date);
    if (!group || group.records.length === 0 || day.sessionCount > 0 || day.totalDurationMs > 0) {
      return day;
    }

    const linkedSessionCount = group.records.filter((record) => record.linkedTodoId !== null).length;
    return {
      ...day,
      totalDurationMs: group.totalDurationMs,
      totalDurationLabel: formatDurationMs(group.totalDurationMs),
      sessionCount: group.records.length,
      linkedSessionCount,
      independentSessionCount: group.records.length - linkedSessionCount,
    };
  });
}

export function createArchivePath(days: AnalyticsSnapshot["dailyBreakdown"]) {
  if (days.length === 0) {
    return "M 0 72";
  }

  const maxDuration = Math.max(1, ...days.map((day) => day.totalDurationMs));
  const points = days.map((day, index) => {
    const x = days.length === 1 ? 50 : 7 + (86 * index) / (days.length - 1);
    const intensity = day.totalDurationMs / maxDuration;
    return { x, y: 70 - intensity * 42 };
  });

  if (points.length === 1) {
    return `M 0 ${points[0].y + 18} C 20 ${points[0].y + 18}, 34 ${points[0].y}, ${points[0].x} ${points[0].y}`;
  }

  let path = `M ${points[0].x - 8} ${points[0].y + 8} C ${points[0].x - 4} ${points[0].y + 4}, ${points[0].x - 2} ${points[0].y}, ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const distance = (current.x - previous.x) * 0.42;
    path += ` C ${previous.x + distance} ${previous.y}, ${current.x - distance} ${current.y}, ${current.x} ${current.y}`;
  }
  return path;
}

export { formatAnalyticsDate, formatDurationMs };
