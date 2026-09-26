export interface WeeklyChartValue {
  totalDurationMs: number;
}

export interface WeeklyChartPoint {
  x: number;
  y: number;
  barHeight: number;
}

export interface WeeklyChartGeometry {
  points: WeeklyChartPoint[];
  linePath: string;
  areaPath: string;
}

function bezierPath(points: WeeklyChartPoint[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return "M " + points[0].x + " " + points[0].y;
  let path = "M " + points[0].x + " " + points[0].y;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const start = points[index];
    const end = points[index + 1];
    const next = points[Math.min(points.length - 1, index + 2)];
    const controlOneX = start.x + (end.x - previous.x) / 6;
    const controlOneY = start.y + (end.y - previous.y) / 6;
    const controlTwoX = end.x - (next.x - start.x) / 6;
    const controlTwoY = end.y - (next.y - start.y) / 6;
    path += " C " + controlOneX + " " + controlOneY + ", " + controlTwoX + " " + controlTwoY + ", " + end.x + " " + end.y;
  }
  return path;
}

export function buildWeeklyChartGeometry(days: readonly WeeklyChartValue[]): WeeklyChartGeometry {
  const maximum = Math.max(1, ...days.map((day) => day.totalDurationMs));
  const points = days.map((day, index) => ({
    x: days.length > 1 ? 7 + (index * 86) / (days.length - 1) : 50,
    y: 100 - (day.totalDurationMs / maximum) * 68,
    barHeight: day.totalDurationMs === 0 ? 0 : (day.totalDurationMs / maximum) * 68,
  }));
  const linePath = bezierPath(points);
  const areaPath = points.length > 1
    ? linePath + " L " + points[points.length - 1].x + " 100 L " + points[0].x + " 100 Z"
    : "";
  return { points, linePath, areaPath };
}
