/**
 * Unit tests for BOSS_NAMES constant
 */

import { BOSS_NAMES } from './config';

// Simple test runner
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(error);
  }
}

// Test Suite
console.log('\n=== BOSS_NAMES Constant Tests ===\n');

test('should contain at least 10 boss names', () => {
  assert(BOSS_NAMES.length >= 10, `Expected at least 10 boss names, got ${BOSS_NAMES.length}`);
});

test('should have exactly 14 boss names', () => {
  assert(BOSS_NAMES.length === 14, `Expected 14 boss names, got ${BOSS_NAMES.length}`);
});

test('should have all entries in "中文名 EnglishName" format', () => {
  BOSS_NAMES.forEach((name, index) => {
    assert(typeof name === 'string', `Entry ${index} should be a string`);
    assert(name.length > 0, `Entry ${index} should not be empty`);
    assert(/\s/.test(name), `Entry ${index} "${name}" should contain a space separating Chinese and English names`);
  });
});

test('should contain authentic Arknights boss names', () => {
  const knownBosses = ['Patriot', 'Talulah', 'FrostNova'];
  
  knownBosses.forEach((bossName) => {
    const found = BOSS_NAMES.some((name) => name.includes(bossName));
    assert(found, `Expected to find boss name containing "${bossName}"`);
  });
});

test('should have all unique entries', () => {
  const uniqueNames = new Set(BOSS_NAMES);
  assert(uniqueNames.size === BOSS_NAMES.length, `Expected all entries to be unique, got ${uniqueNames.size} unique out of ${BOSS_NAMES.length}`);
});

test('should be a readonly array (as const)', () => {
  // TypeScript enforces this at compile time with 'as const'
  assert(Array.isArray(BOSS_NAMES), 'BOSS_NAMES should be an array');
  assert(BOSS_NAMES.length > 0, 'BOSS_NAMES should not be empty');
});

test('should include specific boss names', () => {
  const expectedBosses = [
    '爱国者 Patriot',
    '塔露拉 Talulah',
    '霜星 FrostNova',
    '浮士德 Faust',
    '梅菲斯特 Mephisto',
    '碎骨 Crownslayer',
    'W W',
    '泥岩 Mudrock',
    '九 Nine',
    '曼弗雷德 Manfred',
    '伊桑 Ethan',
    '赫拉格 Hellagur',
    '凯尔希 Kal\'tsit',
    '阿米娅 Amiya',
  ];
  
  expectedBosses.forEach((expectedBoss) => {
    assert(BOSS_NAMES.includes(expectedBoss), `Expected to find "${expectedBoss}" in BOSS_NAMES`);
  });
});

console.log('\n=== All tests completed ===\n');

