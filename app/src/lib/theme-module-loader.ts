import type { Component } from "solid-js";
import type {
  FocusSurfaceProps,
  RecordsSurfaceProps,
  SettingsSurfaceProps,
  TodaySurfaceProps,
  TodoSurfaceProps,
} from "./theme-contracts";

export type ThemeModuleId =
  | "night-valley"
  | "editorial-paper"
  | "graphite-console"
  | "metro-pulse"
  | "clutch-court"
  | "aurora-ocean"
  | "botanical-library";

export interface ThemeModule {
  today: Component<TodaySurfaceProps>;
  focus: Component<FocusSurfaceProps>;
  todos: Component<TodoSurfaceProps>;
  records: Component<RecordsSurfaceProps>;
  settings: Component<SettingsSurfaceProps>;
}

const importers: Record<ThemeModuleId, () => Promise<unknown>> = {
  "night-valley": () => import("../components/theme-modules/night-valley"),
  "editorial-paper": () => import("../components/EditorialPaperViews"),
  "graphite-console": () => import("../components/GraphiteConsoleViews"),
  "metro-pulse": () => import("../components/MetroPulseViews"),
  "clutch-court": () => import("../components/ClutchCourtViews"),
  "aurora-ocean": () => import("../components/AuroraOceanViews"),
  "botanical-library": () => import("../components/BotanicalLibraryViews"),
};

const successfulModules = new Map<ThemeModuleId, ThemeModule>();
const inFlightModules = new Map<ThemeModuleId, Promise<ThemeModule>>();
const failedModules = new Set<ThemeModuleId>();
const retrySequence = new Map<ThemeModuleId, number>();
let moduleUrlManifest: Promise<Partial<Record<ThemeModuleId, string>>> | undefined;

function toThemeModule(themeId: ThemeModuleId, namespace: unknown): ThemeModule {
  switch (themeId) {
    case "night-valley":
      return (namespace as typeof import("../components/theme-modules/night-valley")).default;
    case "editorial-paper": {
      const module = namespace as typeof import("../components/EditorialPaperViews");
      return {
        today: module.EditorialPaperToday,
        focus: module.EditorialPaperFocus,
        todos: module.EditorialPaperTodos,
        records: module.EditorialPaperRecords,
        settings: module.EditorialPaperSettings,
      };
    }
    case "graphite-console": {
      const module = namespace as typeof import("../components/GraphiteConsoleViews");
      return {
        today: module.GraphiteConsoleToday,
        focus: module.GraphiteConsoleFocus,
        todos: module.GraphiteConsoleTodos,
        records: module.GraphiteConsoleRecords,
        settings: module.GraphiteConsoleSettings,
      };
    }
    case "metro-pulse": {
      const module = namespace as typeof import("../components/MetroPulseViews");
      return {
        today: module.MetroPulseToday,
        focus: module.MetroPulseFocus,
        todos: module.MetroPulseTodos,
        records: module.MetroPulseRecords,
        settings: module.MetroPulseSettings,
      };
    }
    case "clutch-court": {
      const module = namespace as typeof import("../components/ClutchCourtViews");
      return {
        today: module.ClutchCourtToday,
        focus: module.ClutchCourtFocus,
        todos: module.ClutchCourtTodos,
        records: module.ClutchCourtRecords,
        settings: module.ClutchCourtSettings,
      };
    }
    case "aurora-ocean": {
      const module = namespace as typeof import("../components/AuroraOceanViews");
      return {
        today: module.AuroraOceanToday,
        focus: module.AuroraOceanFocus,
        todos: module.AuroraOceanTodos,
        records: module.AuroraOceanRecords,
        settings: module.AuroraOceanSettings,
      };
    }
    case "botanical-library": {
      const module = namespace as typeof import("../components/BotanicalLibraryViews");
      return {
        today: module.BotanicalLibraryToday,
        focus: module.BotanicalLibraryFocus,
        todos: module.BotanicalLibraryTodos,
        records: module.BotanicalLibraryRecords,
        settings: module.BotanicalLibrarySettings,
      };
    }
  }
}

async function loadWithFreshUrl(themeId: ThemeModuleId): Promise<ThemeModule> {
  if (!moduleUrlManifest) {
    const manifestUrl = new URL(`${import.meta.env.BASE_URL}theme-module-urls.json`, window.location.href);
    moduleUrlManifest = fetch(manifestUrl, { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error(`主题模块地址读取失败：${response.status}`);
      return await response.json() as Partial<Record<ThemeModuleId, string>>;
    }).catch((error: unknown) => {
      moduleUrlManifest = undefined;
      throw error;
    });
  }

  const modulePath = (await moduleUrlManifest)[themeId];
  if (!modulePath) throw new Error(`缺少主题模块地址：${themeId}`);
  const moduleUrl = modulePath.startsWith("/")
    ? new URL(modulePath, window.location.href)
    : new URL(`${import.meta.env.BASE_URL}${modulePath}`, window.location.href);
  const nextSequence = (retrySequence.get(themeId) ?? 0) + 1;
  retrySequence.set(themeId, nextSequence);
  moduleUrl.searchParams.set("themeRetry", `${Date.now()}-${nextSequence}`);
  const namespace = await import(/* @vite-ignore */ moduleUrl.href);
  return toThemeModule(themeId, namespace);
}

/** Cache successful modules; cache-bust a rejected module URL before retrying it. */
export function loadThemeModule(themeId: ThemeModuleId): Promise<ThemeModule> {
  const cached = successfulModules.get(themeId);
  if (cached) return Promise.resolve(cached);

  const inFlight = inFlightModules.get(themeId);
  if (inFlight) return inFlight;

  const load = (failedModules.has(themeId)
    ? loadWithFreshUrl(themeId)
    : importers[themeId]().then((namespace) => toThemeModule(themeId, namespace))
  ).then(
    (module) => {
      failedModules.delete(themeId);
      successfulModules.set(themeId, module);
      inFlightModules.delete(themeId);
      return module;
    },
    (error: unknown) => {
      failedModules.add(themeId);
      inFlightModules.delete(themeId);
      throw error;
    },
  );
  inFlightModules.set(themeId, load);
  return load;
}
