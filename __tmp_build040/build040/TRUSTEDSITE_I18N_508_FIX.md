# NEXUS ONE Production Fix — TrustedSite, Languages and Section 508

## Corrected

- Restored a clearly visible Section 508 accessibility control on the public site and portal pages.
- Prevented the language selector from covering the Section 508 control.
- Reworked language switching so visible text is translated immediately and the preference persists.
- Added partial-phrase translation support for dynamically rendered content.
- Added an accessible live announcement when a locale is selected.
- Installed TrustedSite through a same-origin loader (`/trustedsite.js`) instead of blocked inline code.
- Updated the production Content Security Policy to allow the TrustedSite CDN and service endpoints.
- Added load/error diagnostics through the `data-trustedsite` attribute on the root HTML element.

## TrustedSite production requirement

The TrustedSite trustmark is loaded from `https://cdn.ywxi.net/js/1.js`. TrustedSite may intentionally withhold the visible trustmark on localhost, temporary preview URLs, or domains that have not been verified and activated in the TrustedSite account. Deploy on the verified `nexusmt.com` domain to validate the visible badge.

## Verification

- Vite production build: passed
- Four-locale integration test: passed
- Section 508/WCAG regression checks: 20/20 passed
- Production foundation security test: passed
