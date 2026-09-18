import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const workspaceRoot = path.resolve(root, "..");
const runId = (process.env.FOCUSED_MOMENT_TEST_RUN_ID || `manual-${Date.now()}-${process.pid}`)
  .replace(/[^a-zA-Z0-9_-]+/g, "-");
const outputDir = path.join(workspaceRoot, "artifacts", "qa", "visual-diffs", runId);
fs.mkdirSync(outputDir, { recursive: true });
const pairs = [
  ["today", path.join(workspaceRoot, "docs/design-references/concept-images/01-night-valley/today.png"), path.join(workspaceRoot, "archive/visuals/playwright-legacy/today-after.png")],
  ["timer", path.join(workspaceRoot, "docs/design-references/concept-images/01-night-valley/timer.png"), path.join(workspaceRoot, "archive/visuals/playwright-legacy/night-valley-timer.png")],
  ["todo", path.join(workspaceRoot, "docs/design-references/concept-images/01-night-valley/todo.png"), path.join(workspaceRoot, "archive/visuals/playwright-legacy/night-valley-todo.png")],
  ["records", path.join(workspaceRoot, "docs/design-references/concept-images/01-night-valley/records.png"), path.join(workspaceRoot, "archive/visuals/playwright-legacy/night-valley-records.png")],
  ["settings", path.join(workspaceRoot, "docs/design-references/concept-images/01-night-valley/settings.png"), path.join(workspaceRoot, "archive/visuals/playwright-legacy/night-valley-settings.png")],
];

const toDataUrl = (filePath) => {
  const extension = path.extname(filePath).toLowerCase() === ".png" ? "png" : "jpeg";
  return `data:image/${extension};base64,${fs.readFileSync(path.resolve(filePath)).toString("base64")}`;
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1487, height: 1058 }, deviceScaleFactor: 1 });
await page.setContent('<!doctype html><html><body style="margin:0;background:#000"><canvas id="canvas" width="1487" height="1058"></canvas></body></html>');

const results = [];
for (const [name, referencePath, actualPath] of pairs) {
  const result = await page.evaluate(async ({ reference, actual }) => {
    const canvas = document.querySelector("#canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const load = (source) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = source;
    });

    const [referenceImage, actualImage] = await Promise.all([load(reference), load(actual)]);
    const width = canvas.width;
    const height = canvas.height;

    context.clearRect(0, 0, width, height);
    context.globalAlpha = 0.5;
    context.drawImage(referenceImage, 0, 0, width, height);
    context.globalAlpha = 0.5;
    context.drawImage(actualImage, 0, 0, width, height);
    context.globalAlpha = 1;
    const overlay = canvas.toDataURL("image/png");

    context.clearRect(0, 0, width, height);
    context.drawImage(referenceImage, 0, 0, width, height);
    const referenceData = context.getImageData(0, 0, width, height).data;
    context.clearRect(0, 0, width, height);
    context.drawImage(actualImage, 0, 0, width, height);
    const actualData = context.getImageData(0, 0, width, height).data;
    const difference = context.createImageData(width, height);
    let totalDelta = 0;
    let changedPixels = 0;
    for (let index = 0; index < referenceData.length; index += 4) {
      const delta = (Math.abs(referenceData[index] - actualData[index]) + Math.abs(referenceData[index + 1] - actualData[index + 1]) + Math.abs(referenceData[index + 2] - actualData[index + 2])) / 3;
      totalDelta += delta;
      if (delta > 10) changedPixels += 1;
      const intensity = Math.min(255, Math.round(delta * 3.2));
      difference.data[index] = intensity;
      difference.data[index + 1] = Math.max(0, Math.round(110 - delta * 1.4));
      difference.data[index + 2] = Math.max(0, Math.round(80 - delta * 0.8));
      difference.data[index + 3] = 255;
    }
    context.putImageData(difference, 0, 0);
    return {
      overlay,
      difference: canvas.toDataURL("image/png"),
      meanDelta: totalDelta / (width * height),
      changedPixelRatio: changedPixels / (width * height),
    };
  }, { reference: toDataUrl(referencePath), actual: toDataUrl(actualPath) });

  fs.writeFileSync(path.join(outputDir, `night-valley-${name}-overlay.png`), Buffer.from(result.overlay.split(",")[1], "base64"));
  fs.writeFileSync(path.join(outputDir, `night-valley-${name}-difference.png`), Buffer.from(result.difference.split(",")[1], "base64"));
  results.push({ name, meanDelta: Number(result.meanDelta.toFixed(2)), changedPixelRatio: Number(result.changedPixelRatio.toFixed(4)) });
}

fs.writeFileSync(path.join(outputDir, "night-valley-visual-diff-summary.json"), `${JSON.stringify(results, null, 2)}\n`);
await browser.close();
console.log(JSON.stringify(results, null, 2));
