import { expect, test } from "@playwright/test";
import { bootWithTauriMock } from "./helpers/tauri-mock.mjs";

const themeModules = [
  ["night-valley", ".trail-page", "/theme-modules/night-valley.ts"],
  ["editorial-paper", ".ep-today-page", "/EditorialPaperViews.tsx"],
  ["graphite-console", ".gc-today-page", "/GraphiteConsoleViews.tsx"],
  ["metro-pulse", ".mp-today-page", "/MetroPulseViews.tsx"],
  ["clutch-court", ".cc-today-page", "/ClutchCourtViews.tsx"],
  ["legacy-aurora-ocean", ".ao-today-page", "/AuroraOceanViews.tsx"],
  ["legacy-botanical-library", ".bl-today-page", "/BotanicalLibraryViews.tsx"],
];

async function setStoredTheme(page, themeId) {
  await page.evaluate(async (id) => {
    const invoke = window.__TAURI_INTERNALS__.invoke;
    const preferences = await invoke("get_app_preferences");
    await invoke("update_app_preferences", { preferences: { ...preferences, themeId: id } });
  }, themeId);
}

async function openSettings(page) {
  await page.getByRole("button", { name: "设置", exact: true }).click();
}

test("theme implementations load only on demand and successful modules stay cached", async ({ page }) => {
  const moduleRequests = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    const match = themeModules.find(([, , modulePath]) => path.endsWith(modulePath));
    if (match) moduleRequests.push(match[0]);
  });

  await bootWithTauriMock(page);
  await expect(page.locator(".minimal-app")).toHaveAttribute("data-theme", "night-valley");
  expect(moduleRequests).toContain("night-valley");
  expect(moduleRequests).not.toContain("editorial-paper");
  expect(moduleRequests).not.toContain("graphite-console");
  expect(moduleRequests).not.toContain("metro-pulse");
  expect(moduleRequests).not.toContain("clutch-court");
  expect(moduleRequests).not.toContain("legacy-aurora-ocean");
  expect(moduleRequests).not.toContain("legacy-botanical-library");

  for (const [themeId, surface] of themeModules) {
    if (themeId === "night-valley") continue;
    await setStoredTheme(page, themeId);
    await expect(page.locator(surface)).toBeVisible();
    expect(moduleRequests.filter((id) => id === themeId)).toHaveLength(1);
  }

  await setStoredTheme(page, "editorial-paper");
  await expect(page.locator(".ep-today-page")).toBeVisible();
  expect(moduleRequests.filter((id) => id === "editorial-paper")).toHaveLength(1);
});

test("failed theme imports keep the current theme and can be retried", async ({ page }) => {
  let clutchRequests = 0;
  await page.route("**/src/components/ClutchCourtViews.tsx*", async (route) => {
    clutchRequests += 1;
    if (clutchRequests === 1) {
      await route.abort("failed");
      return;
    }
    await route.continue();
  });

  await bootWithTauriMock(page);
  await openSettings(page);
  await page.locator('.nv-theme-card[title="使用今日赛场主题"]').click();
  const failure = page.locator('.theme-load-error[role="alert"]');
  await expect(failure).toContainText("今日赛场主题暂时无法加载");
  await expect(page.locator(".minimal-app")).toHaveAttribute("data-theme", "night-valley");
  await expect(page.locator(".nv-settings-page")).toBeVisible();

  await failure.getByRole("button", { name: "重试加载" }).click();
  await expect.poll(() => clutchRequests).toBe(2);
  await expect(page.locator(".minimal-app")).toHaveAttribute("data-theme", "clutch-court");
  await expect(page.locator(".nt-settings-page--clutch")).toBeVisible();
  await expect(failure).toBeHidden();
});

test("failed theme imports can return to the still-active theme", async ({ page }) => {
  await page.route("**/src/components/EditorialPaperViews.tsx*", (route) => route.abort("failed"));
  await bootWithTauriMock(page);
  await openSettings(page);
  await page.locator('.nv-theme-card[title="使用编辑纸页主题"]').click();

  const failure = page.locator('.theme-load-error[role="alert"]');
  await expect(failure).toContainText("编辑纸页主题暂时无法加载");
  await failure.getByRole("button", { name: "返回当前主题" }).click();
  await expect(failure).toBeHidden();
  await expect(page.locator(".minimal-app")).toHaveAttribute("data-theme", "night-valley");
  await expect(page.locator(".nv-settings-page")).toBeVisible();
  await expect.poll(() => page.evaluate(async () => (await window.__TAURI_INTERNALS__.invoke("get_app_preferences")).themeId)).toBe("night-valley");
});

test("theme preview derivatives declare stable dimensions and defer image loading", async ({ page }) => {
  await bootWithTauriMock(page);
  await openSettings(page);

  const previews = page.locator('img[src^="/theme-previews/"]');
  await expect(previews).toHaveCount(7);
  const attributes = await previews.evaluateAll((images) => images.map((image) => ({
    src: image.getAttribute("src"),
    width: image.getAttribute("width"),
    height: image.getAttribute("height"),
    loading: image.getAttribute("loading"),
    decoding: image.getAttribute("decoding"),
  })));
  for (const image of attributes) {
    expect(image.src).toMatch(/\.webp$/);
    expect(image.width).toBe("640");
    expect(image.height).toBe("455");
    expect(image.loading).toBe("lazy");
    expect(image.decoding).toBe("async");
  }
});

test("a pending theme load does not block timer, preference saves or drafts, and stale loads cannot win", async ({ page }) => {
  let releaseEditorial;
  let markEditorialStarted;
  let markEditorialFinished;
  const editorialStarted = new Promise((resolve) => { markEditorialStarted = resolve; });
  const editorialFinished = new Promise((resolve) => { markEditorialFinished = resolve; });
  const editorialGate = new Promise((resolve) => { releaseEditorial = resolve; });
  let editorialRequests = 0;
  await page.route("**/src/components/EditorialPaperViews.tsx*", async (route) => {
    editorialRequests += 1;
    if (editorialRequests === 1) {
      markEditorialStarted();
      await editorialGate;
    }
    await route.continue();
  });
  page.on("requestfinished", (request) => {
    if (new URL(request.url()).pathname.endsWith("/EditorialPaperViews.tsx")) markEditorialFinished();
  });

  await bootWithTauriMock(page);
  await openSettings(page);
  await page.locator('.nv-theme-card[title="使用编辑纸页主题"]').click();
  await editorialStarted;
  await expect(page.locator('.theme-load-status[role="status"]')).toContainText("正在加载编辑纸页主题");
  await expect(page.locator(".minimal-app")).toHaveAttribute("data-theme", "night-valley");
  await page.evaluate(() => {
    const shell = document.querySelector(".minimal-app");
    window.__themeCommitsDuringProbe = [];
    new MutationObserver(() => window.__themeCommitsDuringProbe.push(shell.getAttribute("data-theme")))
      .observe(shell, { attributes: true, attributeFilter: ["data-theme"] });
  });

  const soundReminder = page.getByRole("checkbox", { name: "声音提醒" });
  const wasEnabled = await page.evaluate(async () => (await window.__TAURI_INTERNALS__.invoke("get_timer_preferences")).soundReminderEnabled);
  await soundReminder.setChecked(!wasEnabled);
  await expect.poll(() => page.evaluate(async () => (await window.__TAURI_INTERNALS__.invoke("get_timer_preferences")).soundReminderEnabled)).toBe(!wasEnabled);

  await page.locator(".minimal-nav > button").filter({ hasText: "待办" }).click();
  await page.locator(".nv-todo-create-trigger").click();
  const todoDraft = page.locator('input[name="todoTitle"]');
  await todoDraft.fill("主题加载期间保留的待办草稿");
  await page.locator(".minimal-nav > button").filter({ hasText: "计时" }).click();
  await page.locator('input[name="sessionTitle"]').fill("主题加载期间继续专注");
  await page.getByRole("button", { name: "开始", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__startTimerCalls)).toBe(1);
  await expect.poll(() => page.evaluate(async () => (await window.__TAURI_INTERNALS__.invoke("get_timer_snapshot")).isRunning)).toBe(true);

  await openSettings(page);
  await page.locator('.nv-theme-card[title="使用石墨控制台主题"]').click();
  await expect(page.locator(".minimal-app")).toHaveAttribute("data-theme", "graphite-console");
  releaseEditorial();
  await editorialFinished;
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.locator(".minimal-app")).toHaveAttribute("data-theme", "graphite-console");
  expect(await page.evaluate(() => window.__themeCommitsDuringProbe)).toEqual(["graphite-console"]);
  await expect.poll(() => page.evaluate(async () => (await window.__TAURI_INTERNALS__.invoke("get_timer_snapshot")).isRunning)).toBe(true);

  await page.locator(".minimal-nav > button").filter({ hasText: "待办" }).click();
  await page.locator(".gc-todos-page button.gc-lime-button").first().click();
  await expect(page.locator('input[name="graphiteTodoTitle"]')).toHaveValue("主题加载期间保留的待办草稿");
});
