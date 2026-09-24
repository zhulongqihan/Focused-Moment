export type ThemeId =
  | "night-valley"
  | "editorial-paper"
  | "graphite-console"
  | "metro-pulse"
  | "clutch-court";

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  englishName: string;
  preview: string;
  implemented: boolean;
  description: string;
}

/**
 * Theme metadata is deliberately separate from the page implementation.
 * Implemented themes are production surfaces; the remaining concepts stay
 * visible in Settings without pretending to be usable.
 */
export const themes: ThemeDefinition[] = [
  {
    id: "night-valley",
    name: "夜谷",
    englishName: "Night Valley",
    preview: "/theme-previews/01-night-valley.png",
    implemented: true,
    description: "深夜山谷、金色路径与薄荷色状态。",
  },
  {
    id: "editorial-paper",
    name: "编辑纸页",
    englishName: "Editorial Paper",
    preview: "/theme-previews/02-editorial-paper.png",
    implemented: true,
    description: "纸张、铅字与可读性的工作界面。",
  },
  {
    id: "graphite-console",
    name: "石墨控制台",
    englishName: "Graphite Console",
    preview: "/theme-previews/03-graphite-console.png",
    implemented: true,
    description: "铆钉、信号灯与可执行序列的深色控制台。",
  },
  {
    id: "metro-pulse",
    name: "今日班次",
    englishName: "Metro Pulse",
    preview: "/theme-previews/06-metro-pulse.png",
    implemented: true,
    description: "蓝白交通导视、清晰站台与准点出发。",
  },
  {
    id: "clutch-court",
    name: "今日赛场",
    englishName: "Clutch Court",
    preview: "/theme-previews/07-clutch-court.png",
    implemented: true,
    description: "篮球场、战术回合与 Jimmy Butler 关键时刻。",
  },
];

export const implementedThemeId: ThemeId = "night-valley";

const legacyThemeIds: Record<string, ThemeId> = {
  "aurora-ocean": "metro-pulse",
  "botanical-library": "clutch-court",
};

export function normalizeThemeId(themeId: string | null | undefined): ThemeId {
  if (!themeId) return implementedThemeId;
  const migrated = legacyThemeIds[themeId] ?? themeId;
  return themes.find((theme) => theme.id === migrated)?.id ?? implementedThemeId;
}

export function getTheme(themeId: string | null | undefined) {
  return themes.find((theme) => theme.id === normalizeThemeId(themeId)) ?? themes[0];
}
