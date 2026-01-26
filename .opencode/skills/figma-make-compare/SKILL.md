---
name: figma-make-compare
description: Compare Figma Make design implementation with local dev server
license: MIT
compatibility: opencode
---

## What I do
- Accept a Figma Make URL and compare it against the local dev server implementation
- Treat the Figma Make link as a view-only website (what the browser sees is what you get)
- Compare implementations from both style and functional perspectives
- Extract and compare style tokens (Tailwind CSS classes) from both implementations
- Analyze DOM structure and behavior differences
- Use Playwright browser tools for snapshot and inspection
- Report comprehensive findings with actionable insights

## Input Requirements
You will receive:
- A Figma Make URL (the desired implementation)
- Optionally: specific pages/routes to compare
- Optionally: focus areas (styles only, functionality only, or both)

## Comparison Approach

### 1. Page Setup
1. Open two browser tabs:
   - Tab 1: Figma Make URL (desired implementation)
   - Tab 2: Local dev server
2. Wait for both pages to fully load
3. Take accessibility snapshots of both pages

### 2. Style Comparison

#### DOM Structure Analysis
- Compare the DOM hierarchy of both implementations
- Identify structural differences (missing elements, different nesting, etc.)
- Note any significant rendering differences

#### Style Token Extraction
From Figma Make (desired):
- Extract all Tailwind CSS classes from elements
- Identify color, spacing, typography, layout tokens
- Note any custom styles or inline styles
- Document component-level styling patterns

From Local Dev Server (current):
- Extract all Tailwind CSS classes from matching elements
- Identify color, spacing, typography, layout tokens
- Note custom styles or inline styles
- Document component-level styling patterns

#### Token Comparison
- Match corresponding elements between implementations
- Compare:
  - Colors (background, text, borders, etc.)
  - Spacing (padding, margin, gaps)
  - Typography (font size, weight, family)
  - Layout (flex, grid, positioning)
  - Responsiveness (breakpoints, mobile-first vs desktop)
- Identify:
  - Missing styles in local implementation
  - Inconsistent styling
  - Correctly implemented styles
  - Unnecessary or extra styles

### 3. Functional Comparison

#### Interactive Elements
- Identify all interactive elements in both implementations:
  - Buttons, links, inputs, forms
  - Dropdowns, modals, toggles
  - Navigation elements
  - Any clickable/tappable elements

#### Behavior Analysis
For each interactive element:
1. Test in Figma Make (desired behavior):
   - Click and record the result
   - Check hover states
   - Check focus states
   - Check disabled states (if applicable)
   - Note any animations or transitions

2. Test in Local Dev Server (current behavior):
   - Click and record the result
   - Check hover states
   - Check focus states
   - Check disabled states (if applicable)
   - Note any animations or transitions

3. Compare behaviors:
   - Identify missing functionality
   - Identify incorrect behavior
   - Identify correctly implemented features

### 4. Responsive Design Comparison
- Resize browser window to test responsive breakpoints
- Compare layouts at:
  - Mobile (< 640px)
  - Tablet (640px - 1024px)
  - Desktop (> 1024px)
- Note any responsive differences

## Output Format

### Summary
Provide a high-level summary of the comparison:
- Overall similarity (percentage or qualitative assessment)
- Major categories of differences
- Critical issues that need immediate attention

### Style Differences Report
Organize findings by:
1. **Missing Styles**: Styles present in Figma Make but not in local
2. **Incorrect Styles**: Styles that don't match the desired implementation
3. **Correct Styles**: Properly implemented styles (brief acknowledgment)
4. **Extra Styles**: Styles in local that aren't in Figma Make

For each difference, provide:
- Element identification (path, id, text content)
- Expected style (from Figma Make)
- Current style (from local)
- Location in codebase (if identifiable)
- Severity (critical, high, medium, low)

### Functional Differences Report
Organize findings by:
1. **Missing Features**: Features present in Figma Make but not in local
2. **Broken Features**: Features that don't work as intended
3. **Working Features**: Correctly implemented features (brief acknowledgment)

For each difference, provide:
- Feature description
- Expected behavior (from Figma Make)
- Current behavior (from local)
- Location in codebase (if identifiable)
- Severity (critical, high, medium, low)

### Actionable Recommendations
Prioritized list of actions:
1. **Critical issues** (blocking functionality)
2. **High priority** (significant deviations from design)
3. **Medium priority** (nice-to-have improvements)
4. **Low priority** (minor polish items)

Each recommendation should include:
- What to fix
- How to fix it (implementation hint)
- Where to make changes (file path or component)

## Important Constraints
- **NEVER** use Figma MCP tools - treat Figma Make as a regular website
- **ONLY** view the Figma Make implementation (do not make changes)
- **DO NOT** start the dev server - if not running, ask user to start it with: `cd apps/web-client && rushx start`
- Use Playwright browser tools for all browser interactions
- If pages don't match (different routes/views), ask user to clarify which parts to compare

## Testing Strategy
1. Start with a complete page comparison
2. Zoom into specific sections if needed
3. Take screenshots for visual comparison
4. Record console errors/warnings in both implementations
5. Test keyboard navigation and accessibility if relevant

## Example Usage Flow
When asked: "Compare the customers page with this Figma Make link: https://make.figma.com/..."

1. Open browser to Figma Make URL
2. Take snapshot of customers page
3. Open second tab to `http://localhost:5173/preview/#/customers/`
4. Take snapshot of local customers page
5. Compare DOM structures and style tokens
6. Test interactive elements (buttons, forms, links)
7. Generate comprehensive report with findings
8. Prioritize recommendations based on severity

## Notes
- Figma Make may add wrapper elements or attributes - ignore these in comparison
- Focus on user-perceivable differences, not implementation details
- Tailwind token extraction should handle all standard utilities (colors, spacing, etc.)
- Use element text content, aria-labels, or data-* attributes for element identification
- If multiple pages/views exist in Figma Make, ask user which page to compare
