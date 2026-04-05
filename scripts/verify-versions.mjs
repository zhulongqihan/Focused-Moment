import { readFileSync } from "node:fs";

const cargoToml = readFileSync("src-tauri/Cargo.toml", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const tauriConfig = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
const changelog = readFileSync("CHANGELOG.md", "utf8");
const packageLock = JSON.parse(readFileSync("package-lock.json", "utf8"));

const cargoMatch = cargoToml.match(/^version\s*=\s*"([^"]+)"/m);
if (!cargoMatch) {
  console.error("Cannot parse version from src-tauri/Cargo.toml");
  process.exit(1);
}

const cargoVersion = cargoMatch[1];
const packageVersion = packageJson.version;
const tauriVersion = tauriConfig.version;
const lockVersion = packageLock.version;
const lockRootVersion = packageLock.packages?.[""]?.version;

const mismatch =
  cargoVersion !== packageVersion ||
  cargoVersion !== tauriVersion ||
  cargoVersion !== lockVersion ||
  cargoVersion !== lockRootVersion;

if (mismatch) {
  console.error("Version mismatch detected:");
  console.error(`  Cargo.toml: ${cargoVersion}`);
  console.error(`  package.json: ${packageVersion}`);
  console.error(`  src-tauri/tauri.conf.json: ${tauriVersion}`);
  console.error(`  package-lock.json: ${lockVersion}`);
  console.error(`  package-lock packages['']: ${lockRootVersion}`);
  process.exit(1);
}

if (!changelog.includes(`[${cargoVersion}]`)) {
  console.error(`CHANGELOG.md does not contain entry for [${cargoVersion}]`);
  process.exit(1);
}

console.log(`Version check passed: ${cargoVersion}`);
