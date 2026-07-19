# Build 022 — Personalized Map-Only Livecare

- Reworked Livecare to match the existing Nexus dark-blue design system.
- Replaced the expandable operations list with one large moving map.
- Keeps only compact fleet counts so the page does not grow as vehicles increase.
- Public visitors see anonymized system movement.
- Patient verification changes the experience to the verified ride.
- Facility, driver, dispatcher, and administrator sessions request role-scoped fleet data.
- Staff login now returns to Livecare so the map can immediately personalize for the authenticated role.
- No Leaflet dependency or additional npm map package.
