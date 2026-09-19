import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourceCssSha256 = "646F193069898745892C48B363CE03590104ECB8007E457995FF26E081D11140";
const sourceCssLength = 445703;
const modules = [
  ["00-foundation.css", 1, 900],
  ["10-trail-reference.css", 901, 3175],
  ["20-theme-shell.css", 3176, 3596],
  ["30-measured-surfaces.css", 3597, 5492],
  ["40-responsive-layout.css", 5493, 6068],
  ["50-trail-polish.css", 6069, 7260],
  ["60-focus-todos-records.css", 7261, 10000],
  ["70-settings-feedback.css", 10001, 11166],
  ["80-continuity-workflow.css", 11167, 13000],
];

function normalize(value) {
  return value.replace(/\r\n/g, "\n");
}

function fail(message) {
  console.error(`CSS order verification failed: ${message}`);
  process.exitCode = 1;
}

const indexPath = resolve(root, "src/styles/index.css");
const index = normalize(readFileSync(indexPath, "utf8"));
const expectedImports = modules.map(([file]) => `@import "./${file}";`).join("\n");
if (!index.includes(expectedImports)) {
  fail("src/styles/index.css does not preserve the declared module order");
}

const sourceApp = normalize(readFileSync(resolve(root, "src/App.css"), "utf8"));
if (!sourceApp.includes('@import "./styles/index.css";')) {
  fail("src/App.css is not connected to the ordered stylesheet entrypoint");
}

const combined = modules.map(([file]) => normalize(readFileSync(resolve(root, "src/styles", file), "utf8"))).join("");
const canonical = combined.replaceAll('url("../assets/', 'url("./assets/');
const digest = createHash("sha256").update(canonical).digest("hex").toUpperCase();
if (canonical.length !== sourceCssLength || digest !== sourceCssSha256) {
  fail(`ordered stream changed (length ${canonical.length}, sha256 ${digest})`);
}

for (const [file] of modules) {
  const contents = normalize(readFileSync(resolve(root, "src/styles", file), "utf8"));
  for (const [, asset] of contents.matchAll(/url\("(\.\.?\/assets\/[^"#]+)"\)/g)) {
    const assetPath = resolve(root, "src/styles", file, "..", asset);
    if (!existsSync(assetPath)) {
      fail(`${file} references missing asset ${asset}`);
    }
  }
}

if (process.exitCode !== 1) {
  console.log(`CSS order verified: ${modules.length} modules, ${sourceCssLength} canonical bytes, sha256 ${sourceCssSha256}`);
}
