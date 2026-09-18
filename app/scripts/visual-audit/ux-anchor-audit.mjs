async page => {
  const themes = [
    { id: "night-valley", label: "夜谷" },
    { id: "editorial-paper", label: "Editorial Paper" },
    { id: "graphite-console", label: "石墨控制台" },
    { id: "aurora-ocean", label: "极光海面" },
    { id: "botanical-library", label: "植物书房" },
  ];
  const output = [];
  for (const theme of themes) {
    await page.evaluate(() => {
      localStorage.removeItem("ux-audit.mock-state");
      localStorage.removeItem("focused-moment.theme");
      localStorage.setItem("focused-moment.density", "roomy");
    });
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(450);
    const settingsButton = page.getByRole("button", { name: "设置", exact: true }).last();
    if (await settingsButton.count()) await settingsButton.click({ force: true });
    await page.waitForTimeout(120);
    const themeButton = page.getByRole("button", { name: new RegExp(theme.label) }).last();
    if (await themeButton.count()) await themeButton.click({ force: true });
    await page.waitForTimeout(180);
    const links = page.locator('.minimal-content a[href^="#"]');
    const count = await links.count();
    const failures = [];
    for (let index = 0; index < count; index += 1) {
      const link = links.nth(index);
      const href = await link.getAttribute("href");
      const text = (await link.innerText()).trim();
      const id = href ? href.slice(1) : "";
      const exists = Boolean(id && await page.evaluate(anchorId => document.getElementById(anchorId), id));
      let visible = false;
      let box = null;
      if (exists) {
        await link.scrollIntoViewIfNeeded().catch(() => {});
        await link.click({ force: true }).catch(() => {});
        await page.waitForTimeout(70);
        box = await page.evaluate(anchorId => {
          const node = document.getElementById(anchorId);
          if (!node) return null;
          const rect = node.getBoundingClientRect();
          return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), height: Math.round(rect.height) };
        }, id);
        const viewportHeight = await page.evaluate(() => window.innerHeight);
        visible = Boolean(box && box.height > 0 && box.bottom > 0 && box.top < viewportHeight);
      }
      if (!exists || !visible) failures.push({ text, href, exists, box });
    }
    output.push({ theme: theme.id, count, failures });
  }
  return output;
}
