# Baseline Functionality Revamp

This update was applied directly to `NEXUS_ONE_v1_Production_Language_Switch_Actually_Fixed`.

## Corrections implemented
- Preserved the React/Vite frontend, Node API, SQLite database, LiveCare, portals, maps, payment integrations, accessibility controls, and multilingual architecture.
- Standardized all ride CTAs on the existing `BookingForm` workflow.
- Added a clearly identified WhatsApp contact link for `(202) 315-9253` without replacing the toll-free dispatch number.
- Corrected Facility Portal links to open the real `/facility.html` module.
- Added clear 24/7 dispatch and administrative office hours in the footer.
- Prevented past-date ride requests by setting the booking date minimum to tomorrow.
- Strengthened the confirmation language: a submitted request is not a confirmed ride.
- Added a prominent 911 emergency warning in the booking workflow.
- Retained Stripe, PayPal/Venmo, Google Maps, tracking, and backend submission behavior.

## Deployment
Run `npm install`, then `npm run verify`. For Netlify static deployment, backend API routes require the configured external server; for the complete application use the included Node server deployment instructions.
