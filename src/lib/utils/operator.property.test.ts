/**
 * Property-based tests for operator utility functions
 * 
 * **Validates: Requirements 1.1, 1.2, 8.1, 8.2, 8.3, 8.4**
 */

import * as fc from 'fast-check';
import { getOperatorImageUrl, handleImageError } from './operator';

console.log('\n=== Property-Based Tests for Operator Utilities ===\n');

/**
 * Property 1: Image URL Format and Encoding
 * 
 * **Validates: Requirements 1.1, 1.2, 8.4**
 * 
 * For any operator name, when constructing an image URL, the system should 
 * generate a valid PRTS Wiki URL with proper URI encoding that contains 
 * no unencoded special characters.
 */
console.log('Testing Property 1: Image URL Format and Encoding');
fc.assert(
  fc.property(fc.string(), (operatorName) => {
    const url = getOperatorImageUrl(operatorName);
    
    // Check URL starts with correct base
    if (!url.startsWith('https://prts.wiki/images/')) {
      return false;
    }
    
    // Check URL ends with correct suffix
    if (!url.endsWith('_1.png')) {
      return false;
    }
    
    // Extract the encoded name part
    const encodedPart = url.replace('https://prts.wiki/images/', '').replace('_1.png', '');
    
    // Check that the encoded part matches what encodeURIComponent would produce
    const expectedEncoded = encodeURIComponent(operatorName);
    if (encodedPart !== expectedEncoded) {
      return false;
    }
    
    // Verify no unencoded special characters (spaces, Chinese characters, etc.)
    // The encoded part should only contain unreserved characters, percent-encoded sequences,
    // and characters that encodeURIComponent doesn't encode (like apostrophe, parentheses, asterisk)
    // RFC 3986 unreserved: A-Z a-z 0-9 - . _ ~
    // encodeURIComponent also doesn't encode: ! ' ( ) *
    const allowedChars = /^[A-Za-z0-9\-_.~%!'()*]*$/;
    if (!allowedChars.test(encodedPart)) {
      return false;
    }
    
    return true;
  }),
  { numRuns: 100 }
);
console.log('✓ Property 1 passed: All URLs are properly formatted and encoded\n');

/**
 * Property 2: URL Encoding Handles Chinese Characters
 * 
 * **Validates: Requirements 8.2**
 * 
 * For any operator name containing Chinese characters, the system should 
 * encode them to percent-encoded UTF-8 sequences.
 */
console.log('Testing Property 2: Chinese Character Encoding');
fc.assert(
  fc.property(
    fc.array(fc.integer({ min: 0x4e00, max: 0x9fa5 }), { minLength: 1, maxLength: 10 }).map(codes => 
      String.fromCharCode(...codes)
    ),
    (chineseName) => {
      const url = getOperatorImageUrl(chineseName);
      
      // Chinese characters should be percent-encoded
      const encodedPart = url.replace('https://prts.wiki/images/', '').replace('_1.png', '');
      
      // Should contain percent signs (indicating encoding)
      if (!encodedPart.includes('%')) {
        return false;
      }
      
      // Should not contain raw Chinese characters
      if (/[\u4e00-\u9fa5]/.test(encodedPart)) {
        return false;
      }
      
      return true;
    }
  ),
  { numRuns: 50 }
);
console.log('✓ Property 2 passed: Chinese characters are properly encoded\n');

/**
 * Property 3: URL Encoding Handles Spaces
 * 
 * **Validates: Requirements 8.3**
 * 
 * For any operator name containing spaces, the system should encode them.
 */
console.log('Testing Property 3: Space Character Encoding');
fc.assert(
  fc.property(
    fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 2, maxLength: 5 }).map(arr => arr.join(' ')),
    (nameWithSpaces) => {
      const url = getOperatorImageUrl(nameWithSpaces);
      const encodedPart = url.replace('https://prts.wiki/images/', '').replace('_1.png', '');
      
      // Should not contain unencoded spaces
      if (encodedPart.includes(' ')) {
        return false;
      }
      
      // If original had spaces, encoded version should have %20
      if (nameWithSpaces.includes(' ') && !encodedPart.includes('%20')) {
        return false;
      }
      
      return true;
    }
  ),
  { numRuns: 50 }
);
console.log('✓ Property 3 passed: Spaces are properly encoded\n');

/**
 * Property 4: URL Structure Consistency
 * 
 * **Validates: Requirements 1.1**
 * 
 * For any operator name, the URL structure should always follow the pattern:
 * https://prts.wiki/images/{encodedName}_1.png
 */
console.log('Testing Property 4: URL Structure Consistency');
fc.assert(
  fc.property(fc.string(), (operatorName) => {
    const url = getOperatorImageUrl(operatorName);
    
    // Check protocol
    if (!url.startsWith('https://')) {
      return false;
    }
    
    // Check domain and path
    if (!url.includes('prts.wiki/images/')) {
      return false;
    }
    
    // Check suffix
    if (!url.endsWith('_1.png')) {
      return false;
    }
    
    // Check structure: should have exactly one occurrence of the base URL
    const baseUrl = 'https://prts.wiki/images/';
    const occurrences = (url.match(new RegExp(baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    if (occurrences !== 1) {
      return false;
    }
    
    return true;
  }),
  { numRuns: 100 }
);
console.log('✓ Property 4 passed: URL structure is consistent\n');

/**
 * Property 5: Encoding Idempotency
 * 
 * **Validates: Requirements 8.1**
 * 
 * For any operator name, encoding it once should produce the same result
 * as encoding it multiple times (the function is deterministic).
 */
console.log('Testing Property 5: Encoding Idempotency');
fc.assert(
  fc.property(fc.string(), (operatorName) => {
    const url1 = getOperatorImageUrl(operatorName);
    const url2 = getOperatorImageUrl(operatorName);
    
    // Same input should always produce same output (deterministic)
    return url1 === url2;
  }),
  { numRuns: 100 }
);
console.log('✓ Property 5 passed: Encoding is idempotent\n');

/**
 * Property 6: Image Fallback Mechanism
 * 
 * **Validates: Requirements 1.5, 2.3, 2.4**
 * 
 * For any image error event, the system should replace the image source
 * with a valid SVG data URI containing a blue background with "?" placeholder.
 */
console.log('Testing Property 6: Image Fallback Mechanism');
fc.assert(
  fc.property(fc.string(), (originalSrc) => {
    const mockImg = { src: originalSrc };
    const mockEvent = { target: mockImg } as Event;
    
    handleImageError(mockEvent);
    
    // Check it's a data URI
    if (!mockImg.src.startsWith('data:image/svg+xml')) {
      return false;
    }
    
    // Check it contains SVG elements
    if (!mockImg.src.includes('svg')) {
      return false;
    }
    
    // Check it contains the blue color
    if (!mockImg.src.includes('%230098DC')) {
      return false;
    }
    
    // Check it contains the question mark
    if (!mockImg.src.includes('?')) {
      return false;
    }
    
    // Check dimensions
    if (!mockImg.src.includes('width="100"') || !mockImg.src.includes('height="100"')) {
      return false;
    }
    
    return true;
  }),
  { numRuns: 50 }
);
console.log('✓ Property 6 passed: Image fallback is correctly applied\n');

/**
 * Property 7: Fallback Replaces Any Source
 * 
 * **Validates: Requirements 2.1**
 * 
 * For any original image source, the fallback mechanism should replace it
 * with the SVG data URI (no matter what the original source was).
 */
console.log('Testing Property 7: Fallback Replaces Any Source');
fc.assert(
  fc.property(fc.webUrl(), (originalUrl) => {
    const mockImg = { src: originalUrl };
    const mockEvent = { target: mockImg } as Event;
    
    const originalSrc = mockImg.src;
    handleImageError(mockEvent);
    
    // Source should be changed
    if (mockImg.src === originalSrc) {
      return false;
    }
    
    // New source should be the SVG fallback
    if (!mockImg.src.startsWith('data:image/svg+xml')) {
      return false;
    }
    
    return true;
  }),
  { numRuns: 50 }
);
console.log('✓ Property 7 passed: Fallback replaces any source\n');

console.log('=== All Property-Based Tests Passed ===\n');
