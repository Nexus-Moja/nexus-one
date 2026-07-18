# NEXUS ONE Build 003 — Operations Core

## Integrated
- Central NIPE pricing service in `src/services/pricingService.js`.
- Unified browser trip store in `src/services/tripStore.js`.
- Live fare calculation and breakdown in the existing React booking modal.
- Confirmed booking creates one trip record shared with Dispatch and Billing.
- Admin Configuration Center edits base fare, included mileage, mileage rates and wait-time fees.
- Dispatch loads integrated trips, displays operational totals and advances trip status.
- Billing reads the same trip and quote records and calculates integrated totals.
- Existing Google Maps, payment links, portal pages, branding and accessibility controls preserved.

## Prototype storage
This build uses browser localStorage for cross-module integration. Production deployment should replace it with authenticated server persistence and role-based authorization.
