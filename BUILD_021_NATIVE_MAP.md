# Build 021 — Native Live Fleet Map

- Removed Leaflet from npm dependencies.
- Deleted the generated package lock containing internal registry URLs.
- Added a native JavaScript moving fleet map with OpenStreetMap tiles.
- Added pan, wheel zoom, zoom controls, fit-all control, animated markers, routes, and vehicle detail popups.
- The fleet animation and fallback map continue functioning even if map tiles cannot load.
