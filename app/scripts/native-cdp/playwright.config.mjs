import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPlaywrightOutputDir } from '../playwright-output-root.mjs';

const appRoot = fileURLToPath(new URL('../../', import.meta.url));
const fixture = process.env.FOCUSED_MOMENT_CDP_FIXTURE
  ? JSON.parse(process.env.FOCUSED_MOMENT_CDP_FIXTURE) : null;
const phase = fixture?.phase ?? 'interaction';
if (!['interaction', 'sound-seed', 'sound-restart', 'sound-legacy'].includes(phase)) throw new Error('Invalid native phase');
export default defineConfig({
  testDir: fileURLToPath(new URL('.', import.meta.url)),
  testMatch: phase === 'interaction' ? 'interaction.spec.mjs' : 'sound.spec.mjs',
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: 'list',
  outputDir: fixture
    ? resolve(appRoot, '..', 'artifacts', 'qa', 'frontend', checkedRunId(fixture.runId), phase)
    : getPlaywrightOutputDir({ rootDir: appRoot }),
});

function checkedRunId(value) {
  if (!/^windows-native-\d{8}-\d{6}-[a-f0-9]{10}$/.test(value)) throw new Error('Invalid native run ID');
  return value;
}
