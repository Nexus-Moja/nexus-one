# NEXUS LiveCare v1

## Patient and caregiver workflow

1. Submit a transportation request and save the confirmation reference.
2. Open `/livecare.html`.
3. Enter the confirmation reference and the phone number used for booking.
4. View the current status, driver and vehicle assignment, trip details, timestamped status history, and dispatch messages.
5. Send a secure operational message to Nexus Dispatch.
6. Create a 24-hour read-only tracking link for an authorized family member or caregiver.

## Operations workflow

1. Open `/operations.html` and enter the administrator key.
2. Load transportation requests.
3. Assign the driver and vehicle, select a status, and enter a client-facing update note.
4. Open LiveCare details to review the full event history and messages.
5. Send a dispatch message to the patient or caregiver.

## API routes

- `GET /api/livecare/:reference?phone=...`
- `POST /api/livecare/:reference?action=message`
- `POST /api/livecare/:reference?action=share`
- `GET /api/shared-trip/:token`
- `GET /api/admin/livecare/:reference`
- `POST /api/admin/livecare/:reference`

## New database tables

- `trip_status_history`
- `trip_messages`
- `tracking_links`

## Security notes

- Public trip lookup requires a confirmation reference and matching phone number.
- Shared links are random, read-only, expire automatically, and can be extended with revocation controls in the next release.
- The current administrator-key mechanism is suitable for controlled testing only. Replace it with authenticated staff accounts and role-based access before production.
- Do not expose sensitive medical or insurance notes in LiveCare.

## Section 508 / WCAG support

The LiveCare page includes skip navigation, visible focus states, keyboard operability, high-contrast and larger-text controls, reduced-motion support, semantic landmarks, live status announcements, and responsive reflow.
