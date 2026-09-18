async (page) => {
  const themes = [
    { id: "night-valley", label: "夜谷" },
    { id: "editorial-paper", label: "编辑纸页" },
    { id: "graphite-console", label: "石墨控制台" },
    { id: "aurora-ocean", label: "极光海面" },
    { id: "botanical-library", label: "植物书房" },
  ];
  const tabs = ["今日", "计时", "待办", "记录", "设置"];
  const slug = (value) => ({ "今日": "today", "计时": "focus", "待办": "todos", "记录": "records", "设置": "settings" }[value] || value);
  const clickTab = async (tab) => {
    await page.locator(".minimal-nav > button").nth(tabs.indexOf(tab)).click();
    await page.waitForTimeout(180);
  };
  const firstVisible = async (locator) => {
    const count = await locator.count();
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      if (await candidate.isVisible().catch(() => false)) return candidate;
    }
    return null;
  };
  const clickFirstVisible = async (locator) => {
    const candidate = await firstVisible(locator);
    if (!candidate) return false;
    await candidate.scrollIntoViewIfNeeded().catch(() => {});
    await candidate.click();
    return true;
  };
  const visibleCount = async (locator) => {
    const count = await locator.count();
    let visible = 0;
    for (let index = 0; index < count; index += 1) {
      if (await locator.nth(index).isVisible().catch(() => false)) visible += 1;
    }
    return visible;
  };
  const waitForCount = async (locator, timeout = 1400) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await locator.count()) return true;
      await page.waitForTimeout(100);
    }
    return Boolean(await locator.count());
  };
  const waitForVisible = async (locator, timeout = 1800) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await firstVisible(locator)) return true;
      await page.waitForTimeout(100);
    }
    return Boolean(await firstVisible(locator));
  };
  const auditOutputRoot = process.env.FOCUSED_MOMENT_AUDIT_OUTPUT_DIR || "../artifacts/qa/visual-audit/ux-audit";
  const screenshot = async (theme, tab, round) => {
    const path = `${auditOutputRoot}/${theme.id}-${slug(tab)}-r${round}.jpg`;
    await page.screenshot({ path, type: "jpeg", quality: 82 });
    return path;
  };
  const metrics = async () => page.evaluate(() => {
    const visible = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const root = document.querySelector(".minimal-app");
    const content = document.querySelector(".minimal-content");
    const actionable = [...document.querySelectorAll(".minimal-content button, .minimal-content a, .minimal-content input, .minimal-content select, .minimal-content textarea")].filter(visible);
    const placeholders = actionable.filter((element) => (element.getAttribute("title") || "").includes("尚未接入") || element.textContent?.includes("尚未接入"));
    const heading = document.querySelector(".minimal-content h1");
    const headingRect = heading?.getBoundingClientRect();
    const navigation = document.querySelector(".minimal-nav");
    const navigationRect = navigation?.getBoundingClientRect();
    const navigationButtons = [...(navigation?.querySelectorAll(":scope > button") || [])]
      .filter(visible)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { text: (element.textContent || "").trim().slice(0, 20), left: Math.round(rect.left), top: Math.round(rect.top), right: Math.round(rect.right), bottom: Math.round(rect.bottom) };
      });
    const navigationLayoutIssues = navigationButtons.filter((button) => !navigationRect
      || button.left < Math.round(navigationRect.left) - 1
      || button.top < Math.round(navigationRect.top) - 1
      || button.right > Math.round(navigationRect.right) + 1
      || button.bottom > Math.round(navigationRect.bottom) + 1
      || button.left < -1
      || button.right > window.innerWidth + 1);
    const critical = actionable
      .filter((element) => /开始|继续|保存|添加|写一张|钉上|完成|编辑|专注记录|回看记录|打开记录|潮汐记录|QUEUE|ADD TASK/.test(element.textContent || ""))
      .slice(0, 8)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { text: (element.textContent || "").trim().slice(0, 40), top: Math.round(rect.top), bottom: Math.round(rect.bottom), disabled: element.hasAttribute("disabled") };
      });
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      root: root ? { scrollWidth: root.scrollWidth, scrollHeight: root.scrollHeight } : null,
      content: content ? { scrollWidth: content.scrollWidth, clientWidth: content.clientWidth, scrollHeight: content.scrollHeight } : null,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      bodyHorizontalOverflow: document.body.scrollWidth > window.innerWidth + 1,
      visibleActionCount: actionable.length,
      disabledPlaceholderCount: placeholders.length,
      disabledPlaceholders: placeholders.map((element) => ({ text: (element.textContent || "").trim(), title: element.getAttribute("title") })),
      scrollY: Math.round(window.scrollY),
      heading: headingRect ? { top: Math.round(headingRect.top), bottom: Math.round(headingRect.bottom), visible: headingRect.bottom > 0 && headingRect.top < window.innerHeight } : null,
      navigation: navigationRect ? { left: Math.round(navigationRect.left), top: Math.round(navigationRect.top), right: Math.round(navigationRect.right), bottom: Math.round(navigationRect.bottom), buttons: navigationButtons, layoutIssues: navigationLayoutIssues } : null,
      critical,
      focused: document.activeElement ? { tag: document.activeElement.tagName, text: (document.activeElement.textContent || "").trim().slice(0, 36), label: document.activeElement.getAttribute("aria-label") } : null,
    };
  });
  const performRound2 = async (tab, theme) => {
    if (tab === "今日") {
      const recordLink = await firstVisible(page.locator(".minimal-content button").filter({ hasText: /专注记录|回看记录|查看记录|查看潮汐记录|打开记录|翻开成长记录|查看更多记录/ }));
      if (recordLink) {
        await recordLink.scrollIntoViewIfNeeded().catch(() => {});
        await recordLink.click();
        await page.waitForTimeout(180);
        const openedRecords = await page.locator(".minimal-nav > button").nth(3).evaluate((element) => element.classList.contains("active"));
        await clickTab("今日");
        return openedRecords ? "今日 → 记录入口 → 今日（成功）" : "今日 → 记录入口未切换";
      }
      const addLink = await firstVisible(page.locator(".minimal-content button").filter({ hasText: /添加时段|整理待办|打开待办/ }));
      if (addLink) {
        await addLink.scrollIntoViewIfNeeded().catch(() => {});
        await addLink.click();
        await page.waitForTimeout(180);
        await clickTab("今日");
        return "今日 → 待办入口 → 今日（成功）";
      }
      return "未找到今日页相邻入口";
    }
    if (tab === "计时") {
      const title = await firstVisible(page.locator('.minimal-content input[type="text"]'));
      if (title) await title.fill("用户体验复核");
      const start = await firstVisible(page.locator('.minimal-content button').filter({ hasText: /开始/ }));
      if (start) {
        await start.scrollIntoViewIfNeeded().catch(() => {});
        await start.click();
        await page.waitForTimeout(700);
        const pause = await firstVisible(page.locator('.minimal-content button').filter({ hasText: /暂停/ }));
        if (pause) {
          await pause.scrollIntoViewIfNeeded().catch(() => {});
          await pause.click();
        }
        await page.waitForTimeout(180);
        const reset = await firstVisible(page.locator('.minimal-content button').filter({ hasText: /重置|清空设置/ }));
        if (reset && await reset.isEnabled().catch(() => false)) {
          await reset.scrollIntoViewIfNeeded().catch(() => {});
          await reset.click();
        }
        return pause ? "填写事项 → 开始 → 暂停 → 重置（成功）" : "开始成功但未找到暂停";
      }
      return "未找到开始按钮";
    }
    if (tab === "待办") {
      const open = await firstVisible(page.locator('.minimal-content button').filter({ hasText: /新增待办|写一张纸条|添加待办|ADD TASK|加入潮汐/ }));
      if (open) {
        await open.scrollIntoViewIfNeeded().catch(() => {});
        await open.click();
        await page.waitForTimeout(120);
      }
      const title = await firstVisible(page.locator('.minimal-content input[type="text"]'));
      if (title) await title.fill("用户体验复核后的下一步");
      const submit = await firstVisible(page.locator('.minimal-content button').filter({ hasText: /保存这一页|钉上书架|添加待办|添加|QUEUE|放入水面/ }).last());
      if (submit) {
        await submit.scrollIntoViewIfNeeded().catch(() => {});
        await submit.click();
        await page.waitForTimeout(220);
        const created = await page.getByText("用户体验复核后的下一步", { exact: true }).count();
        return created ? "打开新增 → 填写待办 → 保存（成功）" : "提交完成但新待办未出现";
      }
      return "未找到待办保存入口";
    }
    if (tab === "记录") {
      const editSelector = {
        "night-valley": ".record-row__actions .row-action",
        "editorial-paper": ".ep-record-entry__actions .ep-text-button",
        "graphite-console": ".gc-signal-day",
        "aurora-ocean": ".ao-wave-row__actions .ao-card-action",
        "botanical-library": ".bl-reading-actions .bl-row-action",
      }[theme.id];
      const editRowSelector = {
        "night-valley": ".record-row button",
        "editorial-paper": ".ep-record-entry button",
        "aurora-ocean": ".ao-wave-row button",
        "botanical-library": ".bl-reading-row button",
      }[theme.id];
      // Every theme puts the rename action first in its row action group. Use
      // the structural selector here so localized copy cannot make a valid
      // button disappear from the audit.
      const editLocator = page.locator(`.minimal-content ${editSelector}`);
      const editFallback = editRowSelector ? page.locator(`.minimal-content ${editRowSelector}`).first() : null;
      const edit = theme.id === "graphite-console"
        ? null
        : (await waitForCount(editLocator)
          ? editLocator.first()
          : (editFallback && await waitForCount(editFallback) ? editFallback : null));
      if (edit) {
        await edit.scrollIntoViewIfNeeded().catch(() => {});
        await edit.click();
        const title = page.locator('.minimal-content input[aria-label="编辑记录标题"], .minimal-content input[type="text"]').last();
        if (await waitForCount(title)) {
          await title.fill("用户体验复核记录");
          const saveButton = page.getByRole("button", { name: "保存", exact: true }).last();
          if (await waitForCount(saveButton)) await saveButton.click();
          else await title.press("Enter");
          await page.waitForTimeout(220);
          const saved = await page.getByText("用户体验复核记录", { exact: true }).count();
          return saved ? "编辑记录标题 → 保存（成功）" : "记录保存后标题未出现";
        }
      }
      const signalDay = await firstVisible(page.locator('.minimal-content button.gc-signal-day'));
      if (signalDay) {
        await signalDay.scrollIntoViewIfNeeded().catch(() => {});
        await signalDay.click();
        await page.waitForTimeout(180);
        return "选择信号日期 → 刷新事件日志（成功）";
      }
      const history = await firstVisible(page.locator('.minimal-content .gc-history-index summary'));
      if (history) {
        await history.scrollIntoViewIfNeeded().catch(() => {});
        await history.click();
        await page.waitForTimeout(120);
        return "展开完整索引（成功）";
      }
      return `未找到记录编辑入口（候选 ${await editLocator.count()}，兜底 ${editFallback ? await editFallback.count() : 0}，记录行 ${await page.locator('.minimal-content .ao-wave-row, .minimal-content .bl-reading-row, .minimal-content .ep-record-entry, .minimal-content .record-row').count()}）`;
    }
    if (tab === "设置") {
      const range = await firstVisible(page.locator('.minimal-content input[type="range"]'));
      if (range) {
        const current = Number(await range.inputValue());
        await range.fill(String(current >= 90 ? 42 : current + 7));
      }
      const saveButton = await firstVisible(page.locator('.minimal-content button').filter({ hasText: /保存外观设置|保存设置|保存书房布置|保存光场设置|保存更改|APPLY/ }).last());
      if (saveButton) {
        await saveButton.scrollIntoViewIfNeeded().catch(() => {});
        await saveButton.click();
        await page.waitForTimeout(220);
        return "调整视觉强度 → 保存外观（成功）";
      }
      return range ? "已调整视觉强度（自动保存）" : "未找到视觉强度控件";
    }
    return "未执行";
  };
  const resetBetweenThemes = async () => {
    await page.evaluate(() => {
      localStorage.removeItem("ux-audit.mock-state");
      localStorage.removeItem("focused-moment.theme");
      localStorage.setItem("focused-moment.density", "roomy");
    });
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);
  };
  const results = [];
  for (let themeIndex = 0; themeIndex < themes.length; themeIndex += 1) {
    const theme = themes[themeIndex];
    if (themeIndex >= 0) await resetBetweenThemes();
    await clickTab("设置");
    const themeButton = page.getByRole("button", { name: new RegExp(theme.label) }).last();
    if (await themeButton.count()) await themeButton.click({ force: true });
    await page.waitForTimeout(220);
    for (let tabIndex = 0; tabIndex < tabs.length; tabIndex += 1) {
      const tab = tabs[tabIndex];
      await page.evaluate(() => window.scrollTo(0, 0));
      await clickTab(tab);
      const r1 = await metrics();
      const r1Screenshot = await screenshot(theme, tab, 1);
      const action = await performRound2(tab, theme);
      await page.evaluate(() => window.scrollTo(0, 0));
      await clickTab(tab);
      const r2 = await metrics();
      const r2Screenshot = await screenshot(theme, tab, 2);
      await page.setViewportSize({ width: 560, height: 860 });
      await page.evaluate(() => window.scrollTo(0, 5000));
      const scrolledBeforeNavigation = await page.evaluate(() => Math.round(window.scrollY));
      const nextTab = tabs[(tabIndex + 1) % tabs.length];
      await clickTab(nextTab);
      await clickTab(tab);
      const navigationReset = await page.evaluate(() => Math.round(window.scrollY) <= 1);
      const nav = page.getByRole("navigation", { name: "主导航" });
      const navButton = nav.locator("button").nth(tabIndex);
      await navButton.focus();
      await page.keyboard.press("Tab");
      const r3 = await metrics();
      const r3Screenshot = await screenshot(theme, tab, 3);
      await page.setViewportSize({ width: 1280, height: 800 });
      results.push({ theme: theme.id, tab, action, navigation: { scrolledBeforeNavigation, reset: navigationReset }, r1: { screenshot: r1Screenshot, ...r1 }, r2: { screenshot: r2Screenshot, ...r2 }, r3: { screenshot: r3Screenshot, ...r3 } });
    }
  }
  await page.evaluate((value) => localStorage.setItem("ux-audit.last-results", JSON.stringify(value)), results);
  return results;
}
