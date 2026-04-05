import { readFileSync, writeFileSync } from "node:fs";

const cargoTomlPath = "src-tauri/Cargo.toml";
const packageJsonPath = "package.json";
const packageLockPath = "package-lock.json";
const tauriConfigPath = "src-tauri/tauri.conf.json";

const cargoContent = readFileSync(cargoTomlPath, "utf8");
const versionMatch = cargoContent.match(/^version\s*=\s*"([^"]+)"/m);

if (!versionMatch) {
  console.error("Cannot find version in src-tauri/Cargo.toml");
  process.exit(1);
}

const version = versionMatch[1];

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
packageJson.version = version;
writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

const packageLock = JSON.parse(readFileSync(packageLockPath, "utf8"));
packageLock.version = version;
if (packageLock.packages && packageLock.packages[""]) {
  packageLock.packages[""].version = version;
}
writeFileSync(packageLockPath, `${JSON.stringify(packageLock, null, 2)}\n`, "utf8");

const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, "utf8"));
tauriConfig.version = version;
writeFileSync(tauriConfigPath, `${JSON.stringify(tauriConfig, null, 2)}\n`, "utf8");

console.log(`Synchronized versions to ${version}`);
