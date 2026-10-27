# Accessibility

Target: WCAG 2.2 AA.

## What was checked, and how

Automated:

- `@axe-core/playwright` runs on every page (front page, watch, briefing, review, privacy, about, the four section pages and two story pages) with the WCAG 2.0, 2.1 and 2.2 A and AA rule tags. The test fails on any serious or critical violation. Run with `npm run test:e2e`.
- One test loads a story page at 320px width, checks that the page does not scroll horizontally, and runs axe again.
- A keyboard-only Playwright test completes the watch form with Tab, Space, arrow keys and typing, submits with Enter, runs live research against a mocked Worker, and switches story tabs with ArrowLeft, ArrowRight, Home and End.
- `eslint-plugin-jsx-a11y` (strict rules) runs in `npm run lint`. Tab panels and the scrollable trace table are allowed `tabIndex`, as the WAI-ARIA patterns recommend.
- `scripts/check-contrast.ts` reads the CSS variables in `app/globals.css` and checks each text and UI pairing with the WCAG relative-luminance formula: 4.5:1 for text, 3:1 for focus rings and control borders.

Built into the design:

- One `h1` per page, ordered headings, landmarks (header, nav, main, footer) and a "Skip to main content" link.
- Every input has a visible label. Checkboxes and radios are grouped with fieldset and legend. Errors are linked with `aria-describedby` and announced in an `aria-live` region. No placeholder-only labels.
- Focus indicator: a 3px outline in the accent color, never removed.
- Status labels ("Not yet reported by a journalist", "Speculative", "Preprint, not peer reviewed") always use text, with color as a second cue.
- The research step list is a plain list in an `aria-live="polite"` region. No animations; `prefers-reduced-motion` disables transitions anyway.
- Links use descriptive text, such as "Read the original at [outlet]: [title]".
- Layout uses wrapping flex and grid with relative units, so it works at 320px and at 200% zoom.

## Known issues

- Manual testing with screen readers (VoiceOver, NVDA) has not been done yet.
- 200% zoom was checked by layout reasoning and the 320px test, not by a separate automated test.
- "Next questions" links share the prefix "Raised by:" followed by the source title. Titles differ, but some are long.
- The download of a run record uses a generated file link, which some assistive technologies announce inconsistently.
