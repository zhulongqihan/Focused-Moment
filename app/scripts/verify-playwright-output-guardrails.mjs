import assert from "node:assert/strict";
import { isAbsolute, relative, resolve } from "node:path";

import {
  EXTERNAL_RUN_ID_ENV,
  INVOCATION_RUN_ID_ENV,
  getPlaywrightOutputDir,
  sanitizeRunLabel,
} from "./playwright-output-root.mjs";

const rootDir = resolve(process.cwd());
const outputRoot = resolve(rootDir, "..", "artifacts", "qa", "frontend");

function outputDir(label) {
  return getPlaywrightOutputDir({
    env: label === undefined ? {} : { [EXTERNAL_RUN_ID_ENV]: label },
    rootDir,
    pathExists: () => false,
  });
}

function assertInsideOutputRoot(outputDirPath) {
  const relativePath = relative(outputRoot, outputDirPath);
  assert(relativePath && !isAbsolute(relativePath) && !relativePath.startsWith(".."), `output escaped: ${outputDirPath}`);
}

const defaultFirst = outputDir();
const defaultSecond = outputDir();
assert.notEqual(defaultFirst, defaultSecond, "default runs must not share an output root");

const repeatedLabelFirst = outputDir("same-label");
const repeatedLabelSecond = outputDir("same-label");
assert.notEqual(repeatedLabelFirst, repeatedLabelSecond, "repeated external labels must not share an output root");

const emptyFirst = outputDir("");
const emptySecond = outputDir("");
assert.notEqual(emptyFirst, emptySecond, "empty labels must not fall back to one fixed root");

const invalidFirst = outputDir("../../\\/:*?");
const invalidSecond = outputDir("../../\\/:*?");
assert.notEqual(invalidFirst, invalidSecond, "invalid labels must not share an output root");

const cleanedFirst = outputDir("a/b");
const cleanedSecond = outputDir("a?b");
assert.equal(sanitizeRunLabel("a/b"), sanitizeRunLabel("a?b"), "collision fixture must sanitize to the same label");
assert.notEqual(cleanedFirst, cleanedSecond, "cleaned label collisions must not share an output root");

const firstInvocationEnv = { [EXTERNAL_RUN_ID_ENV]: "worker-shared" };
const mainOutputDir = getPlaywrightOutputDir({ env: firstInvocationEnv, rootDir, pathExists: () => false });
const workerEnv = { ...firstInvocationEnv };
const workerOutputDir = getPlaywrightOutputDir({ env: workerEnv, rootDir, pathExists: () => false });
assert.equal(mainOutputDir, workerOutputDir, "workers must inherit one invocation output root");
assert.equal(firstInvocationEnv[INVOCATION_RUN_ID_ENV], workerEnv[INVOCATION_RUN_ID_ENV]);

let pathChecks = 0;
let firstCollisionCandidate;
const collisionEnv = { [EXTERNAL_RUN_ID_ENV]: "preexisting" };
const collisionOutputDir = getPlaywrightOutputDir({
  env: collisionEnv,
  rootDir,
  pathExists: (candidate) => {
    pathChecks += 1;
    if (pathChecks === 1) firstCollisionCandidate = candidate;
    return pathChecks === 1;
  },
});
assert.equal(pathChecks, 2, "a generated root must be checked before Playwright can clean it");
assert.notEqual(collisionOutputDir, firstCollisionCandidate);

for (const path of [defaultFirst, defaultSecond, repeatedLabelFirst, repeatedLabelSecond, emptyFirst, emptySecond, invalidFirst, invalidSecond, cleanedFirst, cleanedSecond, mainOutputDir, workerOutputDir, collisionOutputDir]) {
  assertInsideOutputRoot(path);
}

console.log(JSON.stringify({
  outputRoot,
  distinctDefaultRuns: defaultFirst !== defaultSecond,
  distinctRepeatedLabels: repeatedLabelFirst !== repeatedLabelSecond,
  distinctInvalidLabels: invalidFirst !== invalidSecond,
  distinctCleanedCollisions: cleanedFirst !== cleanedSecond,
  sharedWorkerRoot: mainOutputDir === workerOutputDir,
  preexistingRootRejected: pathChecks === 2,
}, null, 2));
