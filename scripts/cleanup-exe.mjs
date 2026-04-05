import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const nsisDir = join(root, "src-tauri", "target", "release", "bundle", "nsis");

if (!existsSync(nsisDir)) {
  console.log(`NSIS directory not found: ${nsisDir}`);
  process.exit(0);
}

const files = readdirSync(nsisDir);
const exeFiles = files
  .map((name) => {
    const modern = name.match(/^Focused Moment_(\d+)\.(\d+)\.(\d+)_.*\.exe$/i);
    const legacy = name.match(/^Focused-Moment-v(\d+)\.(\d+)\.(\d+).*\.exe$/i);
    const match = modern ?? legacy;

    if (!match) {
      return null;
    }

    return {
      name,
      path: join(nsisDir, name),
      major: Number(match[1]),
      minor: Number(match[2]),
      patch: Number(match[3]),
    };
  })
  .filter(Boolean)
  .sort((a, b) => {
    if (a.major !== b.major) return b.major - a.major;
    if (a.minor !== b.minor) return b.minor - a.minor;
    if (a.patch !== b.patch) return b.patch - a.patch;
    return a.name.localeCompare(b.name);
  });

const keep = 2;
const toDelete = exeFiles.slice(keep);

for (const item of toDelete) {
  rmSync(item.path, { force: true });
  console.log(`Deleted old exe: ${item.name}`);
}

if (toDelete.length === 0) {
  console.log("No old exe needs cleanup.");
}
