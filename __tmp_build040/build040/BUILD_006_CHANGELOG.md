# NEXUS ONE Build 006 — Patient Portal 2.0 + LiveCare 2.0

## Added
- Patient dashboard connected to shared `nexusTrips` records.
- Upcoming trip, trip history, status, service and fare views.
- Editable transportation profile and mobility preferences.
- Authorized caregiver and emergency-contact management.
- Transportation document metadata workflow.
- Patient notification center and unread counts.
- Time-limited LiveCare caregiver access tokens.
- LiveCare 2.0 trip summary, progress timeline, illustrative map and dispatch messaging.
- Shared `patient-service.js` local prototype data layer.

## Preserved
- Existing Booking, Facility, Dispatch, Fleet, Driver, Billing, QA and Admin modules.
- Stripe, PayPal and Venmo payment links.
- Existing platform navigation and accessibility controls.

## Production requirements
Browser storage is used for this integrated prototype. Production deployment requires authenticated APIs, encrypted storage, tenant isolation, consent controls, audit logging and HIPAA-aligned security review.
