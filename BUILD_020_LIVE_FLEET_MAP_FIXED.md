# Build 020 — Live Fleet Map Fixed

- Bundled Leaflet locally so the map engine no longer depends on unpkg.com.
- Preserved OpenStreetMap road tiles and interactive zoom/pan.
- Expanded Livecare into a full-width fleet command experience.
- Increased the moving map height and made vehicle markers, routes, status and selection prominent.
- Vehicle markers continuously advance along their assigned DMV routes.
- Added responsive fleet cards below the map and cache-busted Build 020 assets.
- Live API telemetry is used when available; simulated routes remain visible when it is not.
