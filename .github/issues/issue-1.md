# [ENHANCEMENT] Refine Codegen Locator Generation, Checkbox Action Mapping, and Cross-Strategy Reuse

- **Labels**: `enhancement`
- **Project**: `PW-Core Roadmap`
- **Status**: `Backlog`
- **Area**: `CLI`
- **Priority**: `Medium`

## Description

This ticket consolidates a series of refinements made to the Playwright codegen engine to ensure high-quality locators, correct action generation on checkbox elements, class filtering, select element text normalization, and duplicate locator reuse.

## Current Behavior vs Proposed Behavior

### 1. Partial Text Locator Validation
- **Current**: The generator could decide on a locator (like a class or CSS selector) that did not contain any partial text matching the target element.
- **Proposed**: Before finalizing the locator, verify that the candidate contains a partial/word from the target element's text. If not, fallback to using the text strategy locator instead.

### 2. Checkbox Action Normalization
- **Current**: The check/uncheck action was generated for non-checkbox elements (like buttons or sorting links).
- **Proposed**: Restrict `check`/`uncheck` to only target `<input type="checkbox">` elements. If the target is not a checkbox, normalize the action to `click`.

### 3. Exclude Bad CSS Classes
- **Current**: Long, automatically generated class names or classes containing styling/borders (like `.search-doodle__tag-item-border`) were used as locators.
- **Proposed**: Exclude any class candidate from generation that contains the word `"border"` (case-insensitive) or exceeds 50 characters in length.

### 4. Checkbox Array Mapping
- **Current**: Checkbox click actions mapped to long class selectors.
- **Proposed**: Ensure checkbox elements map to the page registry's `checkbox` array using their clean text values.

### 5. Exclude Long Candidate Values
- **Current**: Candidates with extremely long accessible names or texts (> 50 chars) were added as keys to the registry.
- **Proposed**: Discard any candidate with a `valueToScore` length greater than 50 characters.

### 6. Cross-Strategy Locator Reuse
- **Current**: Clicking/interacting with an element under a different strategy type (e.g. clicking a button using a text selector) created duplicate keys and registry entries.
- **Proposed**: In `findElementKey`, search across all strategies (arrays and objects) in the page config to reuse existing locator keys, avoiding duplicate entries.

### 7. Select Element Text Normalization
- **Current**: Select element accessible names concatenated all options text, exceeding character limits and causing selector resolution to fallback to tag-only selectors.
- **Proposed**: Retrieve only the first `<option>` text for `<select>` elements rather than the entire text content.
