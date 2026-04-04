# Implementation Plan: Arknights UI Enhancements

## Overview

This implementation plan enhances the Focused Moment application's Arknights gacha system with operator images from PRTS Wiki, randomized boss names, UI fixes, and a redesigned pet system featuring AI-generated operator stories. The implementation uses TypeScript for frontend logic and integrates with the existing Tauri backend.

## Tasks

- [ ] 1. Implement operator image loading system
  - [x] 1.1 Create image URL generation function
    - Write `getOperatorImageUrl()` function that constructs PRTS Wiki URLs
    - Apply URI encoding to handle Chinese characters and special characters
    - Format: `https://prts.wiki/images/{encodedName}_1.png`
    - _Requirements: 1.1, 1.2, 8.1, 8.2, 8.3, 8.4_
  
  - [x] 1.2 Implement image fallback handler
    - Write `handleImageError()` function for image load failures
    - Generate inline SVG data URI with blue background and "?" placeholder
    - Ensure fallback maintains same dimensions as intended image
    - _Requirements: 1.5, 2.1, 2.2, 2.3, 2.4_
  
  - [x] 1.3 Write unit tests for image URL generation
    - Test ASCII operator names
    - Test Chinese character names
    - Test special characters and spaces
    - Verify URL encoding correctness
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 2. Add operator images to gacha results modal
  - [x] 2.1 Update gacha results component with image display
    - Modify gacha results modal to include operator images
    - Use `getOperatorImageUrl()` for image source
    - Add `onerror` handler with `handleImageError()`
    - Apply lazy loading attribute for performance
    - _Requirements: 1.1, 1.2, 1.5, 11.1_
  
  - [x] 2.2 Write property test for image URL format
    - **Property 1: Image URL Format and Encoding**
    - **Validates: Requirements 1.1, 1.2, 8.4**
    - Test that all generated URLs are valid and properly encoded
  
  - [x] 2.3 Write property test for fallback mechanism
    - **Property 2: Image Fallback Mechanism**
    - **Validates: Requirements 1.5, 2.3, 2.4**
    - Test that fallback SVG is always displayed on image load failure

- [ ] 3. Add operator images to operators list page
  - [x] 3.1 Update operators list component with images
    - Add operator image display to each operator card
    - Use `getOperatorImageUrl()` and `handleImageError()`
    - Apply lazy loading for off-screen images
    - Ensure responsive layout with images
    - _Requirements: 1.3, 11.1, 11.2_

- [ ] 4. Implement boss name randomization system
  - [x] 4.1 Create boss names constant array
    - Define `BOSS_NAMES` array with at least 10 boss names
    - Include both Chinese and English names in format "中文名 EnglishName"
    - Use authentic Arknights boss names (Patriot, Talulah, etc.)
    - Make array immutable
    - _Requirements: 3.2, 10.1, 10.2, 10.3, 10.4_
  
  - [x] 4.2 Implement random boss name selection
    - Write `selectRandomBoss()` function
    - Use uniform random distribution (Math.random())
    - Return one boss name from BOSS_NAMES array
    - Add fallback for empty array case
    - _Requirements: 3.1, 3.4, 3.5, 10.5_
  
  - [x] 4.3 Integrate boss name display in timer component
    - Update boss round UI to display selected boss name
    - Call `selectRandomBoss()` when boss round begins
    - Display boss name prominently in timer widget
    - _Requirements: 3.3_
  
  - [x] 4.4 Write property tests for boss name selection
    - **Property 3: Boss Name Selection from List**
    - **Validates: Requirements 3.1**
    - Test that selected boss name is always from BOSS_NAMES array
    - **Property 5: Boss Name Format Consistency**
    - **Validates: Requirements 10.3**
    - Test that all boss names match the required format

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Fix todo widget visibility issues
  - [x] 6.1 Apply z-index and positioning fixes
    - Update todo widget component styles
    - Set z-index to 1000 or higher
    - Set position to "fixed"
    - Ensure display property is not "none"
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [x] 6.2 Write integration test for widget visibility
    - Test that widget is visible after mounting
    - Verify z-index is correctly applied
    - Test that widget doesn't overlap critical UI elements

- [ ] 7. Update version display in settings
  - [ ] 7.1 Update settings page with v0.9.0 version
    - Modify settings component to display "v0.9.0"
    - Verify version matches package.json
    - Verify version matches tauri.conf.json
    - _Requirements: 5.1, 5.2, 5.3_

- [ ] 8. Redesign pet system with operator selection
  - [ ] 8.1 Create operator retrieval function
    - Write function to fetch operators from gacha state backend
    - Use Tauri invoke to call `get_gacha_state`
    - Extract operators array from response
    - _Requirements: 6.1_
  
  - [ ] 8.2 Implement operator dropdown selector
    - Create dropdown component with all obtained operators
    - Display operator name and rarity in each option
    - Add empty state message when no operators exist
    - Include link to gacha page in empty state
    - _Requirements: 6.2, 6.3_
  
  - [ ] 8.3 Implement operator details display
    - Create operator card component
    - Display operator image using `getOperatorImageUrl()`
    - Show name, rarity, class, level, and elite status
    - Apply Arknights theming and styling
    - _Requirements: 6.4, 6.5, 9.2, 9.3, 9.5_
  
  - [ ] 8.4 Wire operator selection to display
    - Bind dropdown selection to state variable
    - Update operator card when selection changes
    - Handle image loading with fallback
    - _Requirements: 6.4, 6.5_
  
  - [ ] 8.5 Write property test for operator retrieval
    - **Property 7: Pet System Operator Retrieval**
    - **Validates: Requirements 6.1**
    - Test that operators list is always retrieved when pet tab opens
  
  - [ ] 8.6 Write property test for dropdown population
    - **Property 8: Pet System Dropdown Population**
    - **Validates: Requirements 6.2**
    - Test that all operators appear in dropdown

- [ ] 9. Implement AI story generation feature
  - [ ] 9.1 Create story generation state management
    - Add `generatingStory` boolean flag
    - Add `operatorStory` string state
    - Add `currentTip` string for user feedback
    - _Requirements: 12.1, 12.2, 12.3_
  
  - [ ] 9.2 Implement story prompt builder
    - Write function to build AI prompt from operator data
    - Include operator name, rarity, class, level, elite status
    - Format prompt for Qwen API
    - _Requirements: 7.3_
  
  - [ ] 9.3 Implement story generation function
    - Write `generateOperatorStory()` async function
    - Set loading state and display loading message
    - Call Tauri backend `generate_ai_summary` with prompt
    - Handle success: display generated story
    - Handle failure: display error message, keep story empty
    - Clear loading state on completion
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6_
  
  - [ ] 9.4 Create story generation UI
    - Add generate button (enabled when operator selected and API key configured)
    - Add story display text area
    - Add loading indicator
    - Disable button during generation
    - _Requirements: 7.1, 9.4, 12.4, 12.5_
  
  - [ ] 9.5 Implement request prevention logic
    - Check `generatingStory` flag before starting new request
    - Prevent multiple simultaneous requests
    - _Requirements: 7.7_
  
  - [ ] 9.6 Write property tests for story generation
    - **Property 10: Story Generation Button Enablement**
    - **Validates: Requirements 7.1**
    - Test button is enabled only when operator selected and API key configured
    - **Property 11: Story Generation Loading State**
    - **Validates: Requirements 7.2**
    - Test loading state is set when generation begins
    - **Property 15: Story Generation State Cleanup**
    - **Validates: Requirements 7.6**
    - Test loading state is cleared on completion
    - **Property 16: Story Generation Request Prevention**
    - **Validates: Requirements 7.7**
    - Test multiple simultaneous requests are prevented
  
  - [ ] 9.7 Write unit tests for story generation
    - Mock AI API success response
    - Mock AI API failure response
    - Test prompt formatting
    - Test state transitions
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6_

- [ ] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Final integration and polish
  - [ ] 11.1 Verify image loading performance
    - Test lazy loading is working
    - Verify browser caching is effective
    - Check fallback SVG has no network overhead
    - _Requirements: 11.1, 11.2, 11.3, 11.4_
  
  - [ ] 11.2 Complete pet system layout
    - Verify operator selector is at top
    - Ensure operator card layout is clean
    - Check story section is properly positioned
    - Apply consistent Arknights theming
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  
  - [ ] 11.3 Test all components together
    - Perform gacha pull and verify images in results
    - Navigate to operators page and verify images
    - Complete focus sessions to boss round and verify boss name
    - Open pet tab and test operator selection
    - Generate AI story and verify display
    - Check todo widget visibility
    - Verify version display in settings
  
  - [ ] 11.4 Write integration tests for end-to-end flows
    - Test gacha flow with images
    - Test boss round flow
    - Test pet system flow
    - Test widget visibility flow

- [ ] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All implementation uses TypeScript for type safety
- Image loading uses PRTS Wiki as external source with fallback handling
- Boss names are hardcoded constants from Arknights lore
- AI story generation requires API key configuration
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests verify end-to-end user flows
