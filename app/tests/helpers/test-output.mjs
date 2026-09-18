import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { test } from "@playwright/test";

export function testOutputPath(...segments) {
  const outputPath = test.info().outputPath(...segments);
  mkdirSync(dirname(outputPath), { recursive: true });
  return outputPath;
}
