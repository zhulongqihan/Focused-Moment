import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

const sourceExtensions = new Set([".ts", ".tsx"]);
const themeNames = [
  "NightValley",
  "GraphiteConsole",
  "EditorialPaper",
  "AuroraOcean",
  "BotanicalLibrary",
];
const themeFilePattern = new RegExp(
  `^src/components/(${themeNames.join("|")})Views\\.tsx$`,
);

function toProjectPath(projectRoot, absolutePath) {
  return relative(projectRoot, absolutePath).replaceAll("\\", "/");
}

function collectFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "target") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(path));
    else if (sourceExtensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

function resolveSourceImport(projectRoot, importerPath, specifier) {
  if (!specifier.startsWith(".")) return null;
  const base = normalize(join(dirname(importerPath), specifier));
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.d.ts`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate) && sourceExtensions.has(extname(candidate))) {
      return toProjectPath(projectRoot, candidate);
    }
  }
  return null;
}

function collectImportGraph(projectRoot) {
  const srcRoot = join(projectRoot, "src");
  const graph = new Map();
  const sourceTexts = new Map();
  for (const absolutePath of collectFiles(srcRoot)) {
    const projectPath = toProjectPath(projectRoot, absolutePath);
    const source = readFileSync(absolutePath, "utf8");
    sourceTexts.set(projectPath, source);
    const sourceFile = ts.createSourceFile(
      absolutePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      extname(absolutePath) === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const imports = new Set();
    sourceFile.forEachChild((node) => {
      const moduleSpecifier =
        ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
          ? node.moduleSpecifier
          : undefined;
      if (!moduleSpecifier || !ts.isStringLiteral(moduleSpecifier)) return;
      const resolved = resolveSourceImport(projectRoot, absolutePath, moduleSpecifier.text);
      if (resolved) imports.add(resolved);
    });
    graph.set(projectPath, imports);
  }
  return { graph, sourceTexts };
}

function layerOf(projectPath) {
  if (projectPath.startsWith("src/features/")) return "features";
  if (projectPath.startsWith("src/lib/")) return "lib";
  if (projectPath.startsWith("src/components/")) return "components";
  if (projectPath === "src/MainShell.tsx" || projectPath === "src/App.tsx") return "app";
  return "other";
}

function isThemeComponent(projectPath) {
  return themeFilePattern.test(projectPath);
}

export function validateLayerBoundaries(graph, sourceTexts = new Map()) {
  const errors = [];
  for (const [from, targets] of graph) {
    const fromLayer = layerOf(from);
    if (fromLayer === "features" || fromLayer === "lib") {
      for (const target of targets) {
        if (target === "src/App.tsx" || target === "src/MainShell.tsx") {
          errors.push(`${from} must not import application shell ${target}`);
        }
        if (isThemeComponent(target)) {
          errors.push(`${from} must not import concrete theme ${target}`);
        }
      }
    }

    if (isThemeComponent(from)) {
      for (const target of targets) {
        if (isThemeComponent(target) && target !== from) {
          errors.push(`${from} must not import sibling theme ${target}`);
        }
      }
    }
  }

  const neutralContracts = sourceTexts.get("src/lib/theme-contracts.ts");
  if (neutralContracts && /NightValley|GraphiteConsole|EditorialPaper|AuroraOcean|BotanicalLibrary/.test(neutralContracts)) {
    errors.push("src/lib/theme-contracts.ts must remain theme-neutral");
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));
  return { errors: [] };
}

function assertExists(projectRoot, paths) {
  const missing = paths.filter((path) => !existsSync(join(projectRoot, path)));
  if (missing.length > 0) throw new Error(`Required structure paths are missing: ${missing.join(", ")}`);
}

function assertDocsIgnorePolicy(workspaceRoot) {
  const trackedFormalDocs = [
    "docs/architecture.md",
    "docs/maintenance/structure-refactor.md",
    "docs/maintenance/workspace-migration.md",
    "docs/product.md",
    "docs/prompts/THEME_REFINEMENT_PROMPT.md",
  ];
  for (const path of trackedFormalDocs) {
    try {
      execFileSync("git", ["check-ignore", "--quiet", "--no-index", "--", path], {
        cwd: workspaceRoot,
        stdio: "ignore",
      });
      throw new Error(`Formal document is unexpectedly ignored: ${path}`);
    } catch (error) {
      if (error?.status !== 1) throw error;
    }
  }

  try {
    execFileSync("git", ["check-ignore", "--quiet", "--no-index", "--", "artifacts/qa/generated-check.md"], {
      cwd: workspaceRoot,
      stdio: "ignore",
    });
  } catch (error) {
    if (error?.status !== 0) throw new Error("artifacts/qa generated output must remain ignored.");
  }
}

function assertTrackedArtifactsAbsent(workspaceRoot) {
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: workspaceRoot })
    .toString()
    .split("\0")
    .filter(Boolean);
  const forbidden = tracked.filter((path) => {
    if (/^artifacts\//i.test(path)) return !/^artifacts\/README\.md$/i.test(path);
    if (/^local\//i.test(path)) return !/^local\/README\.md$/i.test(path);
    if (/^archive\//i.test(path)) return !/^archive\/(?:README\.md|MIGRATION_MANIFEST\.json)$/i.test(path);
    return /^(?:output\/|\.release\/|src-tauri\/target\/)|(?:^|\/)(?:Focused Moment.*\.(?:exe|msi)|.*\.dmg)$/i.test(path);
  });
  if (forbidden.length > 0) throw new Error(`Generated binaries or output are tracked: ${forbidden.join(", ")}`);
}

function assertWorkspaceLayout(appRoot, workspaceRoot) {
  const required = [
    "app/package.json",
    "app/pnpm-lock.yaml",
    "app/src",
    "app/src-tauri",
    "app/public",
    "app/tests",
    "app/scripts",
    "docs",
    "artifacts",
    "archive",
    "local",
    "Focused Moment.exe",
  ];
  const missing = required.filter((path) => !existsSync(join(workspaceRoot, path)));
  if (missing.length > 0) throw new Error(`Workspace layout is incomplete: ${missing.join(", ")}`);

  const forbiddenOuterEntries = [
    "index.html",
    "package.json",
    "pnpm-lock.yaml",
    "public",
    "scripts",
    "src",
    "src-tauri",
    "tests",
    "node_modules",
    "dist",
    "output",
    "test-results",
    ".release",
    "playwright.config.mjs",
    "vite.config.ts",
    "tsconfig.json",
    "tsconfig.node.json",
    ".vscode",
    ".impeccable",
  ];
  const presentForbidden = forbiddenOuterEntries.filter((entry) => existsSync(join(workspaceRoot, entry)));
  if (presentForbidden.length > 0) throw new Error(`Application files remain at workspace root: ${presentForbidden.join(", ")}`);
  if (resolve(appRoot) === resolve(workspaceRoot)) throw new Error("appRoot and workspaceRoot must be distinct.");
}

function assertRepositoryRules(appRoot, workspaceRoot, sourceTexts) {
  const packageJson = JSON.parse(readFileSync(join(appRoot, "package.json"), "utf8"));
  const requiredScripts = [
    "check",
    "build",
    "test:frontend",
    "verify",
    "verify:css",
    "verify:structure",
    "verify:playwright-output",
    "verify:native-contracts",
    "test:native-contracts",
    "test:local-delivery",
    "native:windows",
    "package:local",
  ];
  const missingScripts = requiredScripts.filter((name) => typeof packageJson.scripts?.[name] !== "string");
  if (missingScripts.length > 0) throw new Error(`Required package scripts are missing: ${missingScripts.join(", ")}`);
  if (/\b(?:build|package|release|native:windows|tauri\s+dev)\b/i.test(packageJson.scripts.verify)) {
    throw new Error("pnpm verify must not build, start the app, package, publish, or run native smoke.");
  }

  const readme = readFileSync(join(workspaceRoot, "README.md"), "utf8");
  for (const command of ["pnpm verify", "pnpm package:local", "pnpm native:windows"]) {
    if (!readme.includes(command)) throw new Error(`README is missing documented command: ${command}`);
  }

  const scriptsDirectory = join(appRoot, "scripts");
  const localWorkspacePath = ["F:", "Focused Moment"].join("\\");
  for (const entry of readdirSync(scriptsDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || !/[.]m?js$|[.]ps1$|[.]psm1$/.test(entry.name)) continue;
    const source = readFileSync(join(scriptsDirectory, entry.name), "utf8");
    if (source.includes(localWorkspacePath) || source.includes(localWorkspacePath.replaceAll("\\", "/"))) {
      throw new Error(`Shareable script hard-codes the local workspace: scripts/${entry.name}`);
    }
  }

  const runtimeFiles = collectRustFiles(join(appRoot, "src-tauri", "src"));
  const includeUsers = runtimeFiles.filter((path) => readFileSync(path, "utf8").includes("include!("));
  if (includeUsers.length > 0) throw new Error(`Rust runtime must not use include!: ${includeUsers.join(", ")}`);

  const appCss = readFileSync(join(appRoot, "src", "App.css"), "utf8");
  if (!appCss.includes('@import "./styles/index.css";')) throw new Error("App.css must retain the styles/index.css compatibility entry.");
  const appCssCodeLines = appCss
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("/*") && !line.startsWith("*"));
  if (appCssCodeLines.some((line) => !line.startsWith("@import") && !line.startsWith("*/"))) {
    throw new Error("App.css contains non-compatibility CSS after the ordered split.");
  }

  const localDelivery = readFileSync(join(appRoot, "scripts", "package-local.ps1"), "utf8");
  if (!localDelivery.includes("tauri build --no-bundle") || !localDelivery.includes("target\\release\\focused-moment.exe")) {
    throw new Error("package-local.ps1 must build and validate the exact Release candidate.");
  }
  if (/target\\debug|Get-ChildItem.*LastWriteTime|\.release/.test(localDelivery)) {
    throw new Error("package-local.ps1 must not use Debug or a time-picked executable.");
  }
  if (!localDelivery.includes("artifacts\\builds\\local") || !localDelivery.includes("archive\\executables\\local")) {
    throw new Error("package-local.ps1 must keep build records and recovery copies in workspace zones.");
  }
}

function collectRustFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectRustFiles(path));
    else if (entry.name.endsWith(".rs")) files.push(path);
  }
  return files;
}

export function verifyStructure(projectRoot = resolve(process.cwd())) {
  const appRoot = resolve(projectRoot);
  const workspaceRoot = resolve(appRoot, "..");
  assertExists(appRoot, [
    "src/features/shell/useMainShellController.ts",
    "src/features/todos/TodoDateGroupList.tsx",
    "src/features/todos/todo-groups.ts",
    "src/features/records/derived.ts",
    "src/features/shared/date-utils.ts",
    "src/lib/theme-contracts.ts",
    "src/styles/index.css",
    "src-tauri/src/domain.rs",
    "src-tauri/src/timer_engine.rs",
    "src-tauri/src/commands.rs",
    "src-tauri/src/desktop.rs",
    "src-tauri/src/runtime.rs",
  ]);

  const { graph, sourceTexts } = collectImportGraph(appRoot);
  validateLayerBoundaries(graph, sourceTexts);
  assertWorkspaceLayout(appRoot, workspaceRoot);
  assertRepositoryRules(appRoot, workspaceRoot, sourceTexts);
  assertDocsIgnorePolicy(workspaceRoot);
  assertTrackedArtifactsAbsent(workspaceRoot);
  return {
    success: true,
    sourceCount: graph.size,
    checkedBoundaries: ["feature-layer", "theme-isolation", "neutral-contract", "rust-modules", "workspace-zones", "docs", "artifacts"],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(verifyStructure(resolve(process.cwd())), null, 2));
}
