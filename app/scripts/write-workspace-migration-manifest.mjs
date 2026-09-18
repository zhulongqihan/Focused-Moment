import { createHash } from "node:crypto";
import { createReadStream, existsSync, lstatSync, readdirSync, readlinkSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const appRoot = resolve(import.meta.dirname, "..");
const workspaceRoot = resolve(appRoot, "..");
const manifestPath = resolve(workspaceRoot, "archive", "MIGRATION_MANIFEST.json");

function workspacePath(path) {
  return relative(workspaceRoot, resolve(path)).replaceAll("\\", "/");
}

function hashFile(path) {
  return new Promise((resolvePromise, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolvePromise(hash.digest("hex").toUpperCase()));
  });
}

async function collectFiles(root, skipSelf = false) {
  const files = [];
  const links = [];
  const walk = async (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = resolve(directory, entry.name);
      const relativePath = workspacePath(path);
      if (skipSelf && relativePath === "archive/MIGRATION_MANIFEST.json") continue;
      const stats = lstatSync(path);
      if (stats.isSymbolicLink()) {
        links.push({ path: relativePath, target: readlinkSync(path) });
      } else if (stats.isDirectory()) {
        await walk(path);
      } else if (stats.isFile()) {
        files.push({ path: relativePath, length: stats.size, sha256: await hashFile(path) });
      }
    }
  };
  await walk(root);
  return { files, links };
}

async function summarizeDirectory(path) {
  const result = await collectFiles(path);
  const canonical = result.files.map((entry) => `${entry.path}\t${entry.sha256}\t${entry.length}`).join("\n");
  return {
    path: workspacePath(path),
    fileCount: result.files.length,
    totalBytes: result.files.reduce((sum, entry) => sum + entry.length, 0),
    contentSha256: createHash("sha256").update(canonical).digest("hex").toUpperCase(),
    links: result.links,
  };
}

const mappings = [
  ["index.html", "app/index.html", "file"],
  ["package.json", "app/package.json", "file"],
  ["pnpm-lock.yaml", "app/pnpm-lock.yaml", "file"],
  ["public", "app/public", "directory"],
  ["scripts", "app/scripts", "directory"],
  ["src", "app/src", "directory"],
  ["src-tauri", "app/src-tauri", "directory"],
  ["tests", "app/tests", "directory"],
  ["dist", "app/dist", "directory"],
  ["node_modules", "app/node_modules", "dependency-directory-recreated-by-pnpm"],
  ["PRODUCT.md", "docs/product.md", "file"],
  ["THEME_REFINEMENT_PROMPT.md", "docs/prompts/THEME_REFINEMENT_PROMPT.md", "file"],
  ["docs/qa", "archive/reports/qa", "directory"],
  ["output/qa", "archive/qa/output-qa-legacy", "directory"],
  ["output/playwright", "archive/visuals/playwright-legacy", "directory"],
  ["output/xiaohongshu", "local/marketing/xiaohongshu-20260916", "directory"],
  ["test-results", "archive/qa/test-results-legacy", "directory"],
  [".playwright-cli", "archive/qa/playwright-cli-legacy", "directory"],
  [".release/local", "artifacts/builds/local-history", "directory"],
  [".release/archive", "archive/executables/local-history", "directory"],
  [".release/*", "archive/release-history/.release", "historical-directory-contents"],
  ["Focused Moment Setup v2.11.10.exe", "archive/executables/legacy-programs/Focused Moment Setup v2.11.10.exe", "confirmed-legacy-executable"],
  ["Focused Moment Setup.exe", "archive/executables/legacy-programs/Focused Moment Setup.exe", "confirmed-legacy-executable"],
  ["Focused Moment v2.11.10.exe", "archive/executables/legacy-programs/Focused Moment v2.11.10.exe", "confirmed-legacy-executable"],
];

const archive = await collectFiles(resolve(workspaceRoot, "archive"), true);
const local = await collectFiles(resolve(workspaceRoot, "local"));
const directorySummaries = [];
for (const path of ["app/src", "app/public", "app/tests", "app/scripts", "app/src-tauri/src"]) {
  directorySummaries.push(await summarizeDirectory(resolve(workspaceRoot, path)));
}

const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  workspaceRoot: ".",
  appRoot: "app",
  mappings: mappings.map(([from, to, kind]) => ({ from, to, kind })),
  directorySummaries,
  archivedFiles: archive.files,
  archivedLinks: archive.links,
  localFiles: local.files,
  localLinks: local.links,
  protected: {
    projectPlan: {
      path: "PROJECT_PLAN.md",
      sha256: "E65E6C5C8942B349A44C649F00E29997EBFBDB068DD027A88F3429B909F72604",
      action: "left-in-place-and-not-staged",
    },
    backups: { path: "Focused Moment Backups/", action: "left-in-place" },
    userData: { path: "%LOCALAPPDATA%/FocusedMoment", action: "not-read-or-migrated" },
    unknownPrivate: { paths: [".agents/"], action: "left-in-place" },
  },
  historicalJunctionNote: {
    originalPath: "output/qa/structure-baseline/20260917_092506/playwright-runner/{node_modules,public,src,tests}",
    originalTarget: "<workspaceRoot>/{node_modules,public,src,tests}",
    action: "not-recreated-and-not-used-by-current-workspace",
  },
};

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  manifest: workspacePath(manifestPath),
  archivedFiles: archive.files.length,
  archivedLinks: archive.links.length,
  localFiles: local.files.length,
  directorySummaries: directorySummaries.map(({ path, fileCount, totalBytes }) => ({ path, fileCount, totalBytes })),
}, null, 2));
