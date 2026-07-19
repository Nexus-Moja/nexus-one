# Build 012 — Secure Livecare and Role-Based Access

- Livecare now uses the same global navigation language and visual system as the homepage.
- Added global EN-US, EN-UK, French and Spanish selector.
- Patient access requires the booking reference plus the phone number used for booking.
- Removed browser-only demo trip lookup from Livecare; patient data now comes from the protected API.
- Added facility account-number/password, dispatch username/password and driver username/password entry points.
- Added role and scope fields to the user model and facility/driver scope fields to bookings.
- Added server-enforced scoped trip endpoint:
  - Facility: only matching facility_id.
  - Driver: only matching driver_scope_id and minimum necessary contact data.
  - Dispatch/Admin: operational data across trips.
- Added permission discovery endpoint, login lockout, session expiry, audit records and explicit role mismatch rejection.
- Added patient session termination and time-limited caregiver links.

Production note: account provisioning must assign a unique `scope_id` to every facility and driver user and populate matching `facility_id` or `driver_scope_id` on bookings. Use strong individual credentials and enable MFA through the selected production identity provider.
