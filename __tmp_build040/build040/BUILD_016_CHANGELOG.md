# Build 016 — Facility Navigation and Fleet Movement

- Rebuilt the authenticated Facility Portal header using the same global navigation system as Home and Livecare.
- Facility navigation contains Home, Livecare, the unlabeled global language selector, Call Nexus, and Book a Ride.
- Added responsive mobile navigation and preserved secure-session controls.
- Replaced the Livecare ride list with a system-wide vehicle movement command view.
- Added fleet movement metrics, animated vehicle units, route progress, availability, patient-on-board state, operational attention indicators, refresh time, and role-scoped detail.
- Public movement is anonymized. Facility and driver access remains scope restricted. Dispatch and admin receive system-wide operational detail.
- Added `/api/fleet/live` with role-aware fleet telemetry responses.
