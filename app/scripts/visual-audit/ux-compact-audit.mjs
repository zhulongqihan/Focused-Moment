async (page) => {
  const themes = [
    { id: "night-valley", label: "夜谷", density: ".nv-density-choice button" },
    { id: "editorial-paper", label: "编辑纸页", density: ".ep-density-row button" },
    { id: "graphite-console", label: "石墨控制台", density: ".gc-setting-slider-list input[type=range]" },
    { id: "aurora-ocean", label: "极光海面", density: ".ao-density-buttons button" },
    { id: "botanical-library", label: "植物书房", density: ".bl-density-buttons button" },
  ];
  const tabs = ["今日", "计时", "待办", "记录", "设置"];
  const clickTab = async (tab) => {
    await page.locator(".minimal-nav > button").nth(tabs.indexOf(tab)).click();
    await page.waitForTimeout(180);
  };
  const metrics = async () => page.evaluate(() => {
    const nav = document.querySelector(".minimal-nav");
    const navRect = nav?.getBoundingClientRect();
    const buttons = [...(nav?.querySelectorAll(":scope > button") || [])].map((element) => {
      const rect = element.getBoundingClientRect();
      return { text: element.textContent?.trim(), left: Math.round(rect.left), top: Math.round(rect.top), right: Math.round(rect.right), bottom: Math.round(rect.bottom) };
    });
    const navIssues = buttons.filter((button) => !navRect
      || button.left < Math.round(navRect.left) - 1
      || button.top < Math.round(navRect.top) - 1
      || button.right > Math.round(navRect.right) + 1
      || button.bottom > Math.round(navRect.bottom) + 1
      || button.left < -1
      || button.right > window.innerWidth + 1);
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1 || document.body.scrollWidth > window.innerWidth + 1,
      scrollWidth: document.documentElement.scrollWidth,
      navIssues,
      heading: document.querySelector(".minimal-content h1")?.getBoundingClientRect().toJSON() ?? null,
      contentHeight: document.querySelector(".minimal-content")?.scrollHeight ?? null,
    };
  });
  const results = [];
  for (const theme of themes) {
    await page.evaluate(() => {
      localStorage.removeItem("ux-audit.mock-state");
      localStorage.removeItem("focused-moment.theme");
    });
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);
    await clickTab("设置");
    await page.getByRole("button", { name: new RegExp(theme.label) }).last().click({ force: true });
    await page.waitForTimeout(220);
    if (theme.id === "graphite-console") {
      const density = page.locator(theme.density).first();
      await density.fill("1");
    } else {
      await page.locator(theme.density).filter({ hasText: /紧凑/ }).click();
    }
    await page.waitForTimeout(180);
    for (const viewport of [{ width: 1280, height: 800 }, { width: 560, height: 860 }]) {
      await page.setViewportSize(viewport);
      for (const tab of tabs) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await clickTab(tab);
        results.push({ theme: theme.id, tab, density: "compact", ...(await metrics()) });
      }
    }
  }
  const failures = results
    .filter((item) => item.overflow || item.navIssues.length || !item.heading || item.heading.bottom <= 0)
    .map((item) => ({ theme: item.theme, tab: item.tab, viewport: item.viewport, overflow: item.overflow, navIssues: item.navIssues, heading: item.heading }));
  return { count: results.length, failures };
}
