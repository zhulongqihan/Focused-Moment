import { readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sourceExtensions = new Set([".ts", ".tsx"]);
const ignoredDirectoryNames = new Set(["node_modules", "dist", "target", "output", ".release"]);

function collectSourceFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectoryNames.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(path));
    } else if (sourceExtensions.has(extname(entry.name))) {
      files.push(path);
    }
  }
  return files;
}

function findMatchingBracket(source, openIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = openIndex; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "[") depth += 1;
    if (character === "]") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function extractRegisteredCommands(runtimeSource) {
  const marker = "tauri::generate_handler![";
  const markerIndex = runtimeSource.indexOf(marker);
  if (markerIndex < 0) throw new Error("Tauri command registration was not found.");
  const openIndex = markerIndex + marker.length - 1;
  const closeIndex = findMatchingBracket(runtimeSource, openIndex);
  if (closeIndex < 0) throw new Error("Tauri command registration is not balanced.");
  const body = runtimeSource.slice(openIndex + 1, closeIndex);
  return [...body.matchAll(/\b[a-z][a-z0-9_]*\b/g)].map((match) => match[0]);
}

function extractCommandFunctions(runtimeSource) {
  return [...runtimeSource.matchAll(/#\[tauri::command\]\s*(?:async\s+)?fn\s+([a-z][a-z0-9_]*)/g)]
    .map((match) => match[1]);
}

function extractFrontendInvokes(frontendSource) {
  return [...frontendSource.matchAll(/\binvoke(?:\s*<[^>\r\n]+>)?\s*\(\s*["']([^"']+)["']/g)]
    .map((match) => match[1]);
}

function extractEventCalls(frontendSource, callPattern) {
  const constants = new Map(
    [...frontendSource.matchAll(/\b(?:const|let)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*["']([^"']+)["']/g)]
      .map((match) => [match[1], match[2]]),
  );
  return [...frontendSource.matchAll(new RegExp(`\\b(?:${callPattern})(?:\\s*<[^>\\r\\n]+>)?\\s*\\(\\s*([a-zA-Z_$][a-zA-Z0-9_$]*|["'][^"']+["'])`, "g"))]
    .map((match) => match[1].startsWith('"') || match[1].startsWith("'")
      ? match[1].slice(1, -1)
      : constants.get(match[1]))
    .filter((value) => value);
}

function extractFrontendEvents(frontendSource) {
  return extractEventCalls(frontendSource, "listen|emit");
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

export function verifyNativeContracts(projectRoot = resolve(new URL("..", import.meta.url).pathname, "..")) {
  const runtimePaths = [
    join(projectRoot, "src-tauri", "src", "runtime.rs"),
    join(projectRoot, "src-tauri", "src", "main.rs"),
  ];
  const runtimeSource = runtimePaths.map((path) => readFileSync(path, "utf8")).join("\n");
  const frontendFiles = collectSourceFiles(join(projectRoot, "src"));
  const frontendSource = frontendFiles.map((path) => readFileSync(path, "utf8")).join("\n");

  const registeredCommands = uniqueSorted(extractRegisteredCommands(runtimeSource));
  const commandFunctions = uniqueSorted(extractCommandFunctions(runtimeSource));
  const frontendInvokes = uniqueSorted(extractFrontendInvokes(frontendSource));
  const frontendEvents = uniqueSorted(extractFrontendEvents(frontendSource));
  const frontendEmittedEvents = uniqueSorted(extractEventCalls(frontendSource, "emit"));
  const runtimeEvents = uniqueSorted([
    ...runtimeSource.matchAll(/"([a-z][a-z0-9-]+)"/g),
  ].map((match) => match[1]).filter((value) => frontendEvents.includes(value)));

  const missingCommandFunctions = registeredCommands.filter((name) => !commandFunctions.includes(name));
  const unknownFrontendInvokes = frontendInvokes.filter((name) => !registeredCommands.includes(name));
  const missingRuntimeEvents = frontendEvents.filter((name) => !runtimeEvents.includes(name) && !frontendEmittedEvents.includes(name));

  if (new Set(registeredCommands).size !== registeredCommands.length) {
    throw new Error("Tauri command registration contains duplicate command names.");
  }
  if (missingCommandFunctions.length > 0) {
    throw new Error(`Registered commands without command functions: ${missingCommandFunctions.join(", ")}`);
  }
  if (unknownFrontendInvokes.length > 0) {
    throw new Error(`Frontend invokes commands that are not registered: ${unknownFrontendInvokes.join(", ")}`);
  }
  if (missingRuntimeEvents.length > 0) {
    throw new Error(`Frontend events are not represented by runtime event literals: ${missingRuntimeEvents.join(", ")}`);
  }
  if (/\b(?:native_smoke|debug)\b/i.test(registeredCommands.join(" "))) {
    throw new Error("Native smoke/debug helpers must not be exposed as Tauri commands.");
  }

  return {
    registeredCommands,
    commandFunctions,
    frontendInvokes,
    frontendEvents,
    frontendEmittedEvents,
    runtimeEvents,
    sourceFiles: frontendFiles.map((path) => path.slice(projectRoot.length + 1).replaceAll("\\", "/")).sort(),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = verifyNativeContracts(resolve(process.cwd()));
  console.log(JSON.stringify({
    success: true,
    commandCount: result.registeredCommands.length,
    commands: result.registeredCommands,
    frontendInvokeCount: result.frontendInvokes.length,
    events: result.frontendEvents,
  }, null, 2));
}
