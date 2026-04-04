# Requirements Document: Arknights UI Enhancements

## Introduction

This document specifies the requirements for enhancing the visual appeal and thematic consistency of the Focused Moment application's Arknights gacha system. The enhancements include operator image display, boss name randomization, UI fixes, and a redesigned cyber pet system that showcases obtained operators with AI-generated descriptions.

## Glossary

- **System**: The Focused Moment application
- **Operator**: A character obtained through the gacha system
- **PRTS_Wiki**: The external image source for operator portraits (https://prts.wiki)
- **Boss_Round**: A special focus session that occurs periodically with enhanced rewards
- **Todo_Widget**: The task management widget component
- **Pet_System**: The cyber pet feature that displays operator information
- **AI_Service**: The Qwen API integration for generating operator stories
- **Fallback_Image**: The SVG placeholder displayed when network images fail to load
- **Gacha_State**: The backend state containing user's obtained operators

## Requirements

### Requirement 1: Operator Image Display

**User Story:** As a user, I want to see visual portraits of operators in the gacha system, so that the experience is more engaging and visually appealing.

#### Acceptance Criteria

1. WHEN an operator is displayed in the gacha results modal, THE System SHALL fetch the operator image from PRTS_Wiki using the format `https://prts.wiki/images/{encodedName}_1.png`
2. WHEN constructing the image URL, THE System SHALL encode the operator name using URI encoding to handle special characters
3. WHEN an operator image is displayed on the operators list page, THE System SHALL fetch the image from PRTS_Wiki
4. WHEN an operator is selected in the Pet_System, THE System SHALL display the operator image from PRTS_Wiki
5. IF an operator image fails to load from PRTS_Wiki, THEN THE System SHALL display a Fallback_Image containing a blue background with a "?" placeholder

### Requirement 2: Image Fallback Handling

**User Story:** As a user, I want the application to handle image loading failures gracefully, so that I never see broken image icons.

#### Acceptance Criteria

1. WHEN an image load error occurs, THE System SHALL replace the image source with an inline SVG data URI
2. THE Fallback_Image SHALL contain a blue circular background with a white "?" character centered
3. THE Fallback_Image SHALL be a valid SVG data URI that requires no network request
4. WHEN a Fallback_Image is displayed, THE System SHALL maintain the same dimensions as the intended operator image

### Requirement 3: Boss Name Randomization

**User Story:** As a user, I want to see different boss names during boss rounds, so that the experience feels varied and thematic.

#### Acceptance Criteria

1. WHEN a Boss_Round begins, THE System SHALL select one boss name randomly from a predefined list of boss names
2. THE System SHALL maintain a list of at least 10 distinct boss names from Arknights lore
3. WHEN displaying the boss round, THE System SHALL show the selected boss name to the user
4. THE System SHALL use a uniform random distribution when selecting boss names
5. WHEN a Boss_Round ends and a new Boss_Round begins, THE System SHALL select a new random boss name independently

### Requirement 4: Todo Widget Visibility

**User Story:** As a user, I want the todo widget to be visible and accessible at all times, so that I can manage my tasks without obstruction.

#### Acceptance Criteria

1. WHEN the Todo_Widget is mounted, THE System SHALL set the z-index to a value of 1000 or higher
2. THE Todo_Widget SHALL have a position property set to "fixed"
3. WHEN the Todo_Widget is displayed, THE System SHALL ensure it is not hidden behind other UI elements
4. THE Todo_Widget SHALL remain visible and interactive throughout the user session

### Requirement 5: Version Display

**User Story:** As a user, I want to see the current application version in settings, so that I know which version I am using.

#### Acceptance Criteria

1. WHEN the user views the settings page, THE System SHALL display the version number "v0.9.0"
2. THE displayed version SHALL match the version specified in package.json
3. THE displayed version SHALL match the version specified in tauri.conf.json

### Requirement 6: Pet System Operator Selection

**User Story:** As a user, I want to select and view my obtained operators in the pet system, so that I can interact with my collection.

#### Acceptance Criteria

1. WHEN the user opens the pet tab, THE System SHALL retrieve the list of operators from Gacha_State
2. THE System SHALL display a dropdown selector containing all obtained operators
3. WHEN the operators list is empty, THE System SHALL display an empty state message with a link to the gacha page
4. WHEN the user selects an operator from the dropdown, THE System SHALL display the operator's name, rarity, class, level, and elite status
5. WHEN an operator is selected, THE System SHALL load and display the operator's image with fallback handling

### Requirement 7: AI Story Generation

**User Story:** As a user, I want to generate AI-powered stories about my operators, so that I can enjoy creative narratives about my collection.

#### Acceptance Criteria

1. WHEN an operator is selected in the Pet_System AND the AI API key is configured, THE System SHALL enable the story generation button
2. WHEN the user clicks the generate story button, THE System SHALL set a loading state and display a "AI 正在创作干员故事..." message
3. WHEN generating a story, THE System SHALL call the AI_Service with a prompt containing the operator's name, rarity, class, level, and elite status
4. IF the AI_Service returns a successful response, THEN THE System SHALL display the generated story text
5. IF the AI_Service fails or returns an error, THEN THE System SHALL display an error message and keep the story field empty
6. WHEN story generation completes (success or failure), THE System SHALL clear the loading state
7. THE System SHALL prevent multiple simultaneous story generation requests for the same operator

### Requirement 8: Image URL Encoding

**User Story:** As a developer, I want operator names to be properly encoded in image URLs, so that special characters and Chinese characters are handled correctly.

#### Acceptance Criteria

1. WHEN constructing an image URL, THE System SHALL apply URI encoding to the operator name
2. THE System SHALL handle Chinese characters by encoding them to percent-encoded UTF-8 sequences
3. THE System SHALL handle spaces and special characters through URI encoding
4. THE resulting URL SHALL be a valid HTTP URL with no unencoded special characters

### Requirement 9: Pet System UI Layout

**User Story:** As a user, I want the pet system to have a clean layout that showcases operator information, so that I can easily view and interact with my operators.

#### Acceptance Criteria

1. THE Pet_System SHALL display an operator selector dropdown at the top of the interface
2. WHEN an operator is selected, THE System SHALL display the operator image in a prominent card layout
3. WHEN an operator is selected, THE System SHALL display operator details (name, rarity, class, level, elite) below the image
4. THE Pet_System SHALL display a story generation section with a button and text area for generated stories
5. THE Pet_System SHALL use consistent Arknights theming and styling

### Requirement 10: Boss Name List Management

**User Story:** As a developer, I want to maintain a curated list of boss names, so that the randomization feature uses authentic Arknights lore.

#### Acceptance Criteria

1. THE System SHALL maintain a constant array named BOSS_NAMES containing boss names
2. THE BOSS_NAMES array SHALL contain at least 10 entries
3. EACH entry in BOSS_NAMES SHALL include both Chinese and English names in the format "中文名 EnglishName"
4. THE BOSS_NAMES array SHALL be immutable during runtime
5. IF the BOSS_NAMES array is empty or undefined, THEN THE System SHALL display a fallback text "Boss 回合：开启"

### Requirement 11: Image Loading Performance

**User Story:** As a user, I want operator images to load efficiently, so that the application remains responsive.

#### Acceptance Criteria

1. WHEN displaying operator images, THE System SHALL use the lazy loading attribute to defer off-screen image loading
2. THE System SHALL leverage browser caching for previously loaded images from PRTS_Wiki
3. THE Fallback_Image SHALL be an inline data URI that requires no network request
4. THE System SHALL not block UI rendering while waiting for images to load

### Requirement 12: AI Story Generation State Management

**User Story:** As a developer, I want proper state management during AI story generation, so that the UI remains consistent and prevents race conditions.

#### Acceptance Criteria

1. THE System SHALL maintain a boolean flag `generatingStory` to track generation state
2. WHEN story generation begins, THE System SHALL set `generatingStory` to true
3. WHEN story generation completes or fails, THE System SHALL set `generatingStory` to false
4. WHILE `generatingStory` is true, THE System SHALL disable the story generation button
5. THE System SHALL display appropriate loading indicators while `generatingStory` is true

