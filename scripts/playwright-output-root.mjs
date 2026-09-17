import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

export const EXTERNAL_RUN_ID_ENV = "FOCUSED_MOMENT_TEST_RUN_ID";
export const INVOCATION_RUN_ID_ENV = "FOCUSED_MOMENT_TEST_INVOCATION_ID";

const safeTokenPattern = /^[a-zA-Z0-9_-]+$/;

export function sanitizeRunLabel(value) {
  const label = String(value ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return label || "run";
}

function isSafeInvocationId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 160 && safeTokenPattern.test(value);
}

function createInvocationId() {
  return `inv-${Date.now().toString(36)}-${process.pid}-${randomUUID()}`;
}

function buildOutputDir(rootDir, label, invocationId) {
  return resolve(rootDir, "output", "qa", "frontend", `${label}-${invocationId}`);
}

export function getPlaywrightOutputDir({ env = process.env, rootDir = process.cwd(), pathExists = existsSync } = {}) {
  const label = sanitizeRunLabel(env[EXTERNAL_RUN_ID_ENV]);
  const inheritedInvocationId = isSafeInvocationId(env[INVOCATION_RUN_ID_ENV]) ? env[INVOCATION_RUN_ID_ENV] : null;

  if (inheritedInvocationId) {
    return buildOutputDir(rootDir, label, inheritedInvocationId);
  }

  let invocationId = createInvocationId();
  let outputDir = buildOutputDir(rootDir, label, invocationId);
  while (pathExists(outputDir)) {
    invocationId = createInvocationId();
    outputDir = buildOutputDir(rootDir, label, invocationId);
  }

  env[INVOCATION_RUN_ID_ENV] = invocationId;
  return outputDir;
}
