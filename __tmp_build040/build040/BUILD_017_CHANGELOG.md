# Build 017 — Resilient Livecare Vehicle Movement

- Fixed Livecare fleet movement appearing blank or frozen when the Node API is unavailable or contains no active movement records.
- Added an interactive system-wide movement fallback with multiple vehicles visibly advancing across the operational network.
- Added automatic upgrade to authenticated `/api/fleet/live` telemetry whenever the backend is available.
- Preserved role-aware server telemetry for dispatch, facility and driver sessions.
- Added explicit simulation/live connection status and retained privacy-safe public presentation.
- Added continuous vehicle position advancement, boundary routing, movement metrics and operational status updates.
