export type ThemeId =
  | "night-valley"
  | "editorial-paper"
  | "graphite-console"
  | "aurora-ocean"
  | "botanical-library";

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
    id: "aurora-ocean",
    name: "极光海面",
    englishName: "Aurora Ocean",
    preview: "/theme-previews/04-aurora-ocean.png",
    implemented: false,
    description: "潮汐、极光与流动节奏的概念方向。",
  },
  {
    id: "botanical-library",
    name: "植物书房",
    englishName: "Botanical Library",
    preview: "/theme-previews/05-botanical-library.png",
    implemented: false,
    description: "植物标本、木质书桌与安静阅读的概念方向。",
  },
];

export const implementedThemeId: ThemeId = "night-valley";

export function getTheme(themeId: string | null | undefined) {
  return themes.find((theme) => theme.id === themeId) ?? themes[0];
}
