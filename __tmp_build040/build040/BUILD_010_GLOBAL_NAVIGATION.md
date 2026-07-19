# Build 010 — Global Navigation Upgrade

## Homepage navigation
- Patient Experience renamed to Experience.
- Safety & Quality renamed to Assurance.
- NEXUS LiveCare renamed to Livecare.
- Existing section anchors were preserved to avoid breaking deep links.

## Header design
- Expanded the navigation canvas while preserving responsive behavior.
- Added a compact, no-wrap phone contact capsule so (888) 760-4990 fits cleanly.
- Redesigned Book a Ride as the dominant action with a premium gradient, directional icon, hover motion, focus treatment and mobile-shortened label.
- Added a polished Livecare utility link.
- Improved spacing, type scale, active underline behavior and mobile menu presentation.

## Global language selector
- Moved the language selector into the homepage header.
- Updated the shared i18n loader to place its selector inside module headers instead of floating over content.
- Kept locale persistence through localStorage and the existing Nexus locale-change event.
- Retained English US, English UK, French and Spanish.

## Global platform consistency
- Shared platform pages inherit the integrated language control and stronger booking CTA treatment.
- Standalone page references use Livecare and Assurance naming.

## Validation
- Vite production build passed.
- Four-locale integration test passed.
- All 20 accessibility regression checks passed.
