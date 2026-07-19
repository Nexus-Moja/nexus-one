# NEXUS ONE Accessibility Remediation Report

**Review date:** July 16, 2026  
**Target:** Revised Section 508 Standards and WCAG 2.2 Level AA  
**Scope reviewed:** Public React website, transportation request flow, tracking flow, facility partnership flow, carousel, accessibility controls, and operations workspace.

## Important qualification

This release has been remediated toward Section 508 and WCAG Level AA conformance, but it is **not a formal certification or Accessibility Conformance Report (ACR/VPAT)**. A conformance claim requires comprehensive manual testing, assistive-technology testing, content review, and production-environment validation.

## Code remediations completed

- Added a visible-on-focus skip link and focusable main landmark.
- Added labelled primary navigation and an accessible mobile-menu name, state, and control relationship.
- Added persistent, high-visibility keyboard focus indicators.
- Increased interactive control targets to at least 44 CSS pixels where practical.
- Added reduced-motion behavior based on both operating-system preference and user controls.
- Improved carousel semantics, slide announcements, keyboard arrow controls, pause/play state, and automatic pause during hover or keyboard interaction.
- Added accessible dialogs with `role="dialog"`, `aria-modal`, labelled title/description, Escape handling, focus trapping, and focus restoration.
- Added live regions for asynchronous form errors, request confirmations, copied confirmation references, and trip status results.
- Converted the facility ride preview from visual `div` rows to a semantic table with a caption and scoped column headings.
- Added explicit states to larger-text, high-contrast, and reduced-motion controls.
- Added forced-colors/high-contrast support.
- Darkened key brand colors used for small text to improve contrast.
- Added an accessibility statement and assistance contact information.
- Rebuilt the operations workspace with landmarks, explicit labels, accessible status announcements, keyboard focus styles, semantic sections, and safer output escaping.
- Added an automated accessibility regression script (`npm run a11y:check`).

## Verification completed

- `npm run a11y:check` — static regression checks.
- `npm run build` — Vite production compilation.
- `npm run smoke` — booking creation, retrieval, and operations API smoke test.

## Required manual validation before claiming conformance

1. Complete keyboard-only review at desktop and mobile breakpoints.
2. Test with NVDA + Firefox/Chrome on Windows.
3. Test with JAWS + Chrome/Edge where procurement requires it.
4. Test with VoiceOver + Safari on macOS and iOS.
5. Verify 200% and 400% zoom, reflow at 320 CSS pixels, and landscape/portrait orientation.
6. Run automated tools such as axe, WAVE, Accessibility Insights, and Lighthouse on the deployed production URL.
7. Verify all final photographs, video, captions, transcripts, PDFs, and downloadable documents.
8. Test form validation messages after the final backend and authentication integrations.
9. Conduct usability testing with people who use assistive technologies.
10. Prepare a VPAT/ACR only after comprehensive testing and remediation are complete.

## Ongoing maintenance

Accessibility must be included in the definition of done for every future component and release. Automated checks cannot identify all accessibility barriers; manual testing remains required.
