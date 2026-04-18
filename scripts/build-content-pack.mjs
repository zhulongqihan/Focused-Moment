import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const CONTENT_SCHEMA_VERSION = 1;
const CONTENT_CHANNEL = "cn-stable";
const DEFAULT_INPUT = path.join(
  projectRoot,
  "src-tauri",
  "content",
  "focused-moment-content-cn-pack.json"
);
const OUTPUT_DIR = path.join(projectRoot, ".release", "content");
const PACK_FILENAME = "focused-moment-content-cn-pack.json";
const MANIFEST_FILENAME = "focused-moment-content-cn-manifest.json";

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      result[key] = true;
      continue;
    }

    result[key] = next;
    index += 1;
  }
  return result;
}

function ensureString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} 不能为空`);
  }
  return value.trim();
}

function ensureStringArray(value, fieldName) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${fieldName} 必须是字符串数组`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function normalizeBanner(rawBanner) {
  const slot = ensureString(rawBanner.slot, "banners[].slot");
  if (!["event", "standard", "kernel"].includes(slot)) {
    throw new Error(`不支持的卡池槽位：${slot}`);
  }

  return {
    slot,
    sourcePoolId: ensureString(rawBanner.sourcePoolId, "banners[].sourcePoolId"),
    name: ensureString(rawBanner.name, "banners[].name"),
    summary: ensureString(rawBanner.summary, "banners[].summary"),
    startsAt: ensureString(rawBanner.startsAt, "banners[].startsAt"),
    endsAt: ensureString(rawBanner.endsAt, "banners[].endsAt"),
    rateUpSixNames: ensureStringArray(
      rawBanner.rateUpSixNames,
      "banners[].rateUpSixNames"
    ),
    rateUpFiveNames: ensureStringArray(
      rawBanner.rateUpFiveNames,
      "banners[].rateUpFiveNames"
    ),
    rateUpFourNames: ensureStringArray(
      rawBanner.rateUpFourNames,
      "banners[].rateUpFourNames"
    ),
  };
}

function normalizePack(rawPack, overrides = {}) {
  if (typeof rawPack !== "object" || rawPack === null || Array.isArray(rawPack)) {
    throw new Error("内容包必须是 JSON 对象");
  }

  const schemaVersion = Number(rawPack.schemaVersion ?? CONTENT_SCHEMA_VERSION);
  if (schemaVersion !== CONTENT_SCHEMA_VERSION) {
    throw new Error(`schemaVersion 必须为 ${CONTENT_SCHEMA_VERSION}`);
  }

  const server = ensureString(
    overrides.server ?? rawPack.server ?? "cn",
    "server"
  ).toLowerCase();
  if (server !== "cn") {
    throw new Error("当前只支持国服内容包");
  }

  if (!Array.isArray(rawPack.banners) || rawPack.banners.length === 0) {
    throw new Error("内容包至少需要一个卡池");
  }

  const banners = rawPack.banners.map(normalizeBanner);
  const seenSlots = new Set();
  for (const banner of banners) {
    if (seenSlots.has(banner.slot)) {
      throw new Error(`同一 slot 只能出现一次：${banner.slot}`);
    }
    seenSlots.add(banner.slot);
  }

  return {
    schemaVersion,
    packVersion: ensureString(
      overrides.version ?? rawPack.packVersion,
      "packVersion"
    ),
    server,
    updatedAt: ensureString(
      overrides.updatedAt ?? rawPack.updatedAt,
      "updatedAt"
    ),
    operatorCount: Number(rawPack.operatorCount ?? 0),
    bannerCount: banners.length,
    sourceLabel: ensureString(
      overrides.sourceLabel ?? rawPack.sourceLabel,
      "sourceLabel"
    ),
    banners,
  };
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(projectRoot, args.input ?? DEFAULT_INPUT);
  const rawText = await readFile(inputPath, "utf8");
  const rawPack = JSON.parse(rawText);

  const normalizedPack = normalizePack(rawPack, {
    version: args.version,
    updatedAt: args["updated-at"],
    sourceLabel: args["source-label"],
    server: args.server,
  });

  const packText = `${JSON.stringify(normalizedPack, null, 2)}\n`;
  const manifest = {
    schemaVersion: CONTENT_SCHEMA_VERSION,
    channel: CONTENT_CHANNEL,
    packVersion: normalizedPack.packVersion,
    publishedAt: new Date().toISOString(),
    operatorCount: normalizedPack.operatorCount,
    bannerCount: normalizedPack.bannerCount,
    assetName: PACK_FILENAME,
    assetSha256: sha256(packText),
    sourceLabel: normalizedPack.sourceLabel,
    notes:
      typeof args.notes === "string" && args.notes.trim().length > 0
        ? args.notes.trim()
        : "Focused Moment 国服内容快照",
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(path.join(OUTPUT_DIR, PACK_FILENAME), packText, "utf8");
  await writeFile(
    path.join(OUTPUT_DIR, MANIFEST_FILENAME),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );

  console.log(`内容包已生成：${path.join(OUTPUT_DIR, PACK_FILENAME)}`);
  console.log(`Manifest 已生成：${path.join(OUTPUT_DIR, MANIFEST_FILENAME)}`);
  console.log(`当前版本：${normalizedPack.packVersion}`);
}

main().catch((error) => {
  console.error(`内容包生成失败：${error.message}`);
  process.exitCode = 1;
});
