/**
 * Operator utility functions for the Arknights gacha system
 */

import { BOSS_NAMES } from '$lib/config';

/**
 * Generate PRTS Wiki image URL for an operator
 * 
 * @param operatorName - The name of the operator (can include Chinese characters and special characters)
 * @returns A properly encoded URL pointing to the operator's image on PRTS Wiki
 * 
 * @example
 * getOperatorImageUrl("阿米娅") // Returns: "https://prts.wiki/images/%E9%98%BF%E7%B1%B3%E5%A8%85_1.png"
 * getOperatorImageUrl("W") // Returns: "https://prts.wiki/images/W_1.png"
 */
export function getOperatorImageUrl(operatorName: string): string {
  // Apply URI encoding to handle Chinese characters and special characters
  const encodedName = encodeURIComponent(operatorName);
  
  // Construct PRTS Wiki image URL with format: https://prts.wiki/images/{encodedName}_1.png
  return `https://prts.wiki/images/${encodedName}_1.png`;
}

/**
 * Handle image loading errors by replacing with a fallback SVG
 * 
 * @param event - The error event from the image element
 * 
 * @example
 * <img src={url} onerror={handleImageError} />
 */
export function handleImageError(event: Event): void {
  const img = event.target as HTMLImageElement;
  // Replace with inline SVG data URI showing a blue background with "?" placeholder
  img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%230098DC"/><text x="50" y="50" text-anchor="middle" dy=".3em" fill="white" font-size="40">?</text></svg>';
}

/**
 * Select a random boss name from the predefined BOSS_NAMES array
 * 
 * Uses uniform random distribution (Math.random()) to select one boss name.
 * Includes fallback handling for empty array case.
 * 
 * @returns A randomly selected boss name from BOSS_NAMES, or fallback text if array is empty
 * 
 * @example
 * selectRandomBoss() // Returns: "爱国者 Patriot" or "塔露拉 Talulah" or any other boss name
 */
export function selectRandomBoss(): string {
  // Handle empty array case with fallback
  if (!BOSS_NAMES || BOSS_NAMES.length === 0) {
    return "Boss 回合：开启";
  }
  
  // Use uniform random distribution to select index
  const randomIndex = Math.floor(Math.random() * BOSS_NAMES.length);
  
  // Return the selected boss name
  return BOSS_NAMES[randomIndex];
}
