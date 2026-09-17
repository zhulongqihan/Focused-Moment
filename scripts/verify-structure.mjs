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

function assertDocsIgnorePolicy(projectRoot) {
  const trackedFormalDocs = [
    "docs/architecture.md",
    "docs/maintenance/structure-refactor.md",
  ];
  for (const path of trackedFormalDocs) {
    try {
      execFileSync("git", ["check-ignore", "--quiet", "--no-index", "--", path], {
        cwd: projectRoot,
        stdio: "ignore",
      });
      throw new Error(`Formal document is unexpectedly ignored: ${path}`);
    } catch (error) {
      if (error?.status !== 1) throw error;
    }
  }

  try {
    execFileSync("git", ["check-ignore", "--quiet", "--no-index", "--", "docs/qa/generated-check.md"], {
      cwd: projectRoot,
      stdio: "ignore",
    });
  } catch (error) {
    if (error?.status !== 0) throw new Error("docs/qa generated output must remain ignored.");
  }
}

function assertTrackedArtifactsAbsent(projectRoot) {
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: projectRoot })
    .toString()
    .split("\0")
    .filter(Boolean);
  const forbidden = tracked.filter((path) =>
    /^(?:output\/|\.release\/|src-tauri\/target\/)|(?:^|\/)(?:Focused Moment.*\.(?:exe|msi)|.*\.dmg)$/i.test(path),
  );
  if (forbidden.length > 0) throw new Error(`Generated binaries or output are tracked: ${forbidden.join(", ")}`);
}

function assertRepositoryRules(projectRoot, sourceTexts) {
  const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));
  const requiredScripts = [
    "check",
    "build",
    "test:frontend",
    "verify",
    "verify:css",
    "verify:structure",
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

  const readme = sourceTexts.get("README.md") ?? readFileSync(join(projectRoot, "README.md"), "utf8");
  for (const command of ["pnpm verify", "pnpm package:local", "pnpm native:windows"]) {
    if (!readme.includes(command)) throw new Error(`README is missing documented command: ${command}`);
  }

  const scriptsDirectory = join(projectRoot, "scripts");
  const localWorkspacePath = ["F:", "Focused Moment"].join("\\");
  for (const entry of readdirSync(scriptsDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || !/[.]m?js$|[.]ps1$|[.]psm1$/.test(entry.name)) continue;
    const source = readFileSync(join(scriptsDirectory, entry.name), "utf8");
    if (source.includes(localWorkspacePath) || source.includes(localWorkspacePath.replaceAll("\\", "/"))) {
      throw new Error(`Shareable script hard-codes the local workspace: scripts/${entry.name}`);
    }
  }

  const runtimeFiles = collectRustFiles(join(projectRoot, "src-tauri", "src"));
  const includeUsers = runtimeFiles.filter((path) => readFileSync(path, "utf8").includes("include!("));
  if (includeUsers.length > 0) throw new Error(`Rust runtime must not use include!: ${includeUsers.join(", ")}`);

  const appCss = readFileSync(join(projectRoot, "src", "App.css"), "utf8");
  if (!appCss.includes('@import "./styles/index.css";')) throw new Error("App.css must retain the styles/index.css compatibility entry.");
  const appCssCodeLines = appCss
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("/*") && !line.startsWith("*"));
  if (appCssCodeLines.some((line) => !line.startsWith("@import") && !line.startsWith("*/"))) {
    throw new Error("App.css contains non-compatibility CSS after the ordered split.");
  }

  const localDelivery = readFileSync(join(projectRoot, "scripts", "package-local.ps1"), "utf8");
  if (!localDelivery.includes("tauri build --no-bundle") || !localDelivery.includes("target\\release\\focused-moment.exe")) {
    throw new Error("package-local.ps1 must build and validate the exact Release candidate.");
  }
  if (/target\\debug|Get-ChildItem.*LastWriteTime/.test(localDelivery)) {
    throw new Error("package-local.ps1 must not use Debug or a time-picked executable.");
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
  assertExists(projectRoot, [
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

  const { graph, sourceTexts } = collectImportGraph(projectRoot);
  validateLayerBoundaries(graph, sourceTexts);
  assertRepositoryRules(projectRoot, sourceTexts);
  assertDocsIgnorePolicy(projectRoot);
  assertTrackedArtifactsAbsent(projectRoot);
  return {
    success: true,
    sourceCount: graph.size,
    checkedBoundaries: ["feature-layer", "theme-isolation", "neutral-contract", "rust-modules", "docs", "artifacts"],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(verifyStructure(resolve(process.cwd())), null, 2));
}
