# Changelog

## v1.1 — Shared Nexus experience

- Standardized all public booking CTAs to **Book a Ride**.
- Added one reusable React `BookRideButton` component.
- Routed every homepage booking CTA through the same booking dialog.
- Preserved service context when booking from a hero slide or service card.
- Added `/?book=1` and optional `service` query support for cross-module booking entry.
- Updated LiveCare navigation and hero with the shared Book a Ride CTA.
- Added a Nexus-branded Operations header and module hero.
- Applied the homepage navy, cyan-glow, typography, spacing, and CTA language to Operations.
- Retained Section 508-oriented focus, keyboard, contrast, and reduced-motion behavior.

## 1.0.1 - Footer logo correction
- Replaced the footer logo with the supplied long Nexus Medical Transit logo.
- Removed the white background treatment and footer inversion filter.
- Added a dedicated transparent footer asset without changing the header logo or other platform content.

## 1.1.0 — Fleet photography integration
- Added five supplied Nexus fleet and ambulance photographs.
- Replaced illustrated homepage carousel slides with optimized real fleet imagery.
- Added relevant vehicle photography to LiveCare, Patient, Facility, Dispatch, Fleet, Driver, QA, Billing and Admin module heroes.
- Added a responsive fleet gallery.
- Converted source PNG files to optimized WebP assets for faster loading.

## Google Maps Booking Integration
- Added Google Places address autocomplete for pickup and destination.
- Added route map display inside the existing Book a Ride workflow.
- Added driving distance and traffic-aware ETA calculation.
- Added service-based fare estimates and included route details in booking submissions.
- Added responsive and accessible route-estimator states.

## Complete Payments + Google Maps Build

- Preserved Google Maps address autocomplete, route map, mileage, traffic-aware ETA, and fare estimation.
- Added Stripe hosted checkout to booking confirmation, Patient, and Billing.
- Added PayPal Hosted Buttons with Venmo eligibility and a direct PayPal fallback link.
- Kept TrustedSite, fleet imagery, LiveCare, platform modules, footer fix, and accessibility remediation in the same app.

## Build 004 — Driver & Fleet Operations
- Added functional driver shift, inspection, manifest and trip status workflow.
- Added fleet readiness management and an illustrative live location board.
- Added shared operational state service at `public/build4-operations.js`.

## Build 006 — Patient Portal 2.0 + LiveCare 2.0
- Added connected patient ride dashboard, profile, caregiver contacts, documents and notifications.
- Added time-limited caregiver sharing and LiveCare 2.0 trip status experience.
- Connected Patient and LiveCare pages to shared trip records.


## v1.0.6 — Stripe Checkout Sessions
- Replaced the broken fixed Stripe Payment Link with server-created Checkout Sessions.
- Added signed webhook processing and payment reconciliation.
- Added booking checkout tokens, payment status, fare persistence, and payment audit records.
- Added server-side idempotency and checkout rate limiting.
- Removed the visible “Select language” title from the language control.
- Redirected the Patient Portal payment action into the verified booking/payment flow.

## v1.0.7 — Windows dependency startup repair
- Updated Windows launch scripts to verify the Stripe SDK itself rather than only checking whether `node_modules` exists.
- Automatically runs `npm install` when `node_modules/stripe/package.json` is missing.
- Added clearer startup errors for Node, dependency, and build failures.
