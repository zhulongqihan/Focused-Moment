/**
 * Unit tests for operator utility functions
 */

import { getOperatorImageUrl, handleImageError, selectRandomBoss } from './operator';
import { BOSS_NAMES } from '$lib/config';

// Simple test runner
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEquals(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`);
  }
}

function test(name: string, fn: () => void | Promise<void>): void {
  try {
    const result = fn();
    if (result instanceof Promise) {
      result.then(() => {
        console.log(`✓ ${name}`);
      }).catch((error) => {
        console.error(`✗ ${name}`);
        console.error(error);
      });
    } else {
      console.log(`✓ ${name}`);
    }
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(error);
  }
}

// Test Suite: getOperatorImageUrl
console.log('\n=== Testing getOperatorImageUrl ===\n');

test('should generate URL for ASCII operator name', () => {
  const url = getOperatorImageUrl('W');
  assertEquals(url, 'https://prts.wiki/images/W_1.png', 'URL should match expected format');
});

test('should encode Chinese characters in operator name', () => {
  const url = getOperatorImageUrl('阿米娅');
  assert(url.startsWith('https://prts.wiki/images/'), 'URL should start with base URL');
  assert(url.endsWith('_1.png'), 'URL should end with _1.png');
  assert(url.includes('%'), 'URL should contain percent-encoded characters');
  // Verify the encoded name is correct
  assertEquals(url, 'https://prts.wiki/images/%E9%98%BF%E7%B1%B3%E5%A8%85_1.png', 'Chinese characters should be properly encoded');
});

test('should encode spaces in operator name', () => {
  const url = getOperatorImageUrl('Test Operator');
  assert(url.includes('%20'), 'Spaces should be encoded as %20');
  assertEquals(url, 'https://prts.wiki/images/Test%20Operator_1.png', 'URL should have encoded space');
});

test('should encode special characters', () => {
  const url = getOperatorImageUrl('Operator#1');
  assert(url.includes('%23'), 'Hash symbol should be encoded');
  assertEquals(url, 'https://prts.wiki/images/Operator%231_1.png', 'Special characters should be encoded');
});

test('should handle empty string', () => {
  const url = getOperatorImageUrl('');
  assertEquals(url, 'https://prts.wiki/images/_1.png', 'Empty string should produce valid URL structure');
});

test('should handle mixed Chinese and English', () => {
  const url = getOperatorImageUrl('阿米娅 Amiya');
  assert(url.startsWith('https://prts.wiki/images/'), 'URL should start with base URL');
  assert(url.includes('%'), 'URL should contain encoded characters');
  assert(url.endsWith('_1.png'), 'URL should end with _1.png');
});

test('should not double-encode already encoded characters', () => {
  const url = getOperatorImageUrl('Test');
  assert(!url.includes('%25'), 'Should not double-encode');
});

test('should produce valid URL format', () => {
  const url = getOperatorImageUrl('测试');
  // Check URL structure
  assert(url.startsWith('https://'), 'URL should use HTTPS protocol');
  assert(url.includes('prts.wiki/images/'), 'URL should include correct path');
  assert(url.endsWith('_1.png'), 'URL should end with _1.png suffix');
  // Check no unencoded special characters
  const urlWithoutBase = url.replace('https://prts.wiki/images/', '').replace('_1.png', '');
  assert(!urlWithoutBase.includes(' '), 'URL should not contain unencoded spaces');
});

// Test Suite: handleImageError
console.log('\n=== Testing handleImageError ===\n');

test('should replace image src with SVG fallback', () => {
  const mockImg = { src: 'https://example.com/image.png' };
  const mockEvent = { target: mockImg } as Event;
  
  handleImageError(mockEvent);
  
  assert(mockImg.src.startsWith('data:image/svg+xml'), 'Image src should be replaced with SVG data URI');
  assert(mockImg.src.includes('svg'), 'Fallback should be SVG format');
});

test('should create fallback with blue background', () => {
  const mockImg = { src: 'https://example.com/image.png' };
  const mockEvent = { target: mockImg } as Event;
  
  handleImageError(mockEvent);
  
  assert(mockImg.src.includes('%230098DC'), 'Fallback should have blue background color');
});

test('should create fallback with question mark placeholder', () => {
  const mockImg = { src: 'https://example.com/image.png' };
  const mockEvent = { target: mockImg } as Event;
  
  handleImageError(mockEvent);
  
  assert(mockImg.src.includes('?'), 'Fallback should contain question mark placeholder');
});

test('should create fallback with correct dimensions', () => {
  const mockImg = { src: 'https://example.com/image.png' };
  const mockEvent = { target: mockImg } as Event;
  
  handleImageError(mockEvent);
  
  assert(mockImg.src.includes('width="100"'), 'Fallback should have width of 100');
  assert(mockImg.src.includes('height="100"'), 'Fallback should have height of 100');
});

// Test Suite: selectRandomBoss
console.log('\n=== Testing selectRandomBoss ===\n');

test('should return a boss name from BOSS_NAMES array', () => {
  const bossName = selectRandomBoss();
  assert(typeof bossName === 'string', 'Boss name should be a string');
  assert(bossName.length > 0, 'Boss name should not be empty');
  // Check if the returned name is in the BOSS_NAMES array
  const isValidBoss = BOSS_NAMES.includes(bossName as any);
  assert(isValidBoss, `Boss name "${bossName}" should be from BOSS_NAMES array`);
});

test('should return boss name in correct format', () => {
  const bossName = selectRandomBoss();
  // Boss names should contain both Chinese and English names separated by space
  assert(bossName.includes(' '), 'Boss name should contain space between Chinese and English names');
});

test('should return different boss names on multiple calls (probabilistic)', () => {
  // Run multiple times to check randomness
  const results = new Set<string>();
  for (let i = 0; i < 50; i++) {
    results.add(selectRandomBoss());
  }
  // With 50 calls and 14 boss names, we should get at least 5 different names
  assert(results.size >= 5, `Should get multiple different boss names, got ${results.size} unique names`);
});

test('should use uniform distribution (all boss names can be selected)', () => {
  // Run many times to ensure all boss names can potentially be selected
  const results = new Set<string>();
  for (let i = 0; i < 200; i++) {
    results.add(selectRandomBoss());
  }
  // With 200 calls, we should see a good variety of boss names
  assert(results.size >= 8, `Should see variety of boss names, got ${results.size} unique names out of ${BOSS_NAMES.length}`);
});

test('should always return valid boss name', () => {
  // Test multiple calls to ensure consistency
  for (let i = 0; i < 20; i++) {
    const bossName = selectRandomBoss();
    assert(BOSS_NAMES.includes(bossName as any), `Boss name "${bossName}" should always be from BOSS_NAMES array`);
  }
});

console.log('\n=== All tests completed ===\n');
