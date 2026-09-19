// Read-only source inventory; never scans user profiles, backups, artifacts or archive.
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, relative, extname } from 'node:path';
import ts from 'typescript';

const app = fileURLToPath(new URL('../', import.meta.url));
const root = resolve(app, '..');
const read = path => readFileSync(resolve(app, path), 'utf8');
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
const match = (path, pattern) => read(path).match(pattern)?.[1] ?? null;
const versions = {
  package: JSON.parse(read('package.json')).version,
  cargo: match('src-tauri/Cargo.toml', /^version\s*=\s*"([^"]+)"/m),
  cargoLock: match('src-tauri/Cargo.lock', /name = "focused-moment"\r?\nversion = "([^"]+)"/),
  tauri: JSON.parse(read('src-tauri/tauri.conf.json')).version,
  runtime: match('src-tauri/src/runtime.rs', /const APP_VERSION: &str = "([^"]+)"/),
  milestone: match('src-tauri/src/runtime.rs', /const APP_MILESTONE: &str = "v([\d.]+)/),
};
const files = [];
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.isFile()) files.push(path);
  }
}
walk(resolve(app, 'src'));
walk(resolve(app, 'public'));
const references = [];
const missing = [];
const removedAudioReferences = [];
const assetExtension = /\.(?:png|jpe?g|svg|webp|gif|ico|mp3|wav|ogg|woff2?|ttf)(?:[?#].*)?$/i;
function check(importer, specifier) {
  if (/^(?:data:|https?:|#)/.test(specifier) || specifier.includes('${')) return;
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) return;
  const clean = specifier.split(/[?#]/)[0];
  const base = specifier.startsWith('/') ? resolve(app, 'public', clean.slice(1)) : resolve(dirname(importer), clean);
  const candidates = [base, ...['.ts', '.tsx', '.js', '.mjs', '.css', '/index.ts', '/index.tsx'].map(suffix => base + suffix)];
  const target = candidates.find(existsSync);
  const entry = { importer: relative(app, importer).replaceAll('\\', '/'), specifier };
  references.push(entry);
  if (!target) missing.push(entry);
}
for (const path of files) {
  if (!['.ts', '.tsx', '.css', '.js'].includes(extname(path))) continue;
  const content = readFileSync(path, 'utf8');
  if (content.includes('viral-quote-sample.mp3')) removedAudioReferences.push(relative(app, path));
  if (extname(path) === '.css') {
    for (const value of content.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)) check(path, value[1]);
  } else {
    const source = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) check(path, node.moduleSpecifier.text);
      } else if (ts.isStringLiteral(node) && assetExtension.test(node.text)) check(path, node.text);
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}
for (const icon of JSON.parse(read('src-tauri/tauri.conf.json')).bundle.icon) check(resolve(app, 'src-tauri/tauri.conf.json'), `./${icon}`);
const report = {
  capturedAt: new Date().toISOString(), head: git('rev-parse', 'HEAD'), branch: git('branch', '--show-current'),
  mergeBase: git('merge-base', 'HEAD', 'main'), versions,
  versionAligned: Object.values(versions).every(value => value === versions.package),
  checkedReferences: references.length, missing, removedAudioReferences,
  deletedTrackedPaths: git('diff', '--name-only', '--diff-filter=D', 'main...HEAD').split('\n').filter(Boolean),
  committedDiff: git('diff', '--name-status', 'main...HEAD').split('\n'),
  workingTree: git('status', '--short'),
  limits: 'Static imports, CSS url(), asset string literals and Tauri icons only; dynamic paths/runtime asset requests require native execution. Unreferenced assets are not automatically deletion candidates.',
};
console.log(JSON.stringify(report, null, 2));
if (!report.versionAligned || missing.length || removedAudioReferences.length) process.exitCode = 1;
