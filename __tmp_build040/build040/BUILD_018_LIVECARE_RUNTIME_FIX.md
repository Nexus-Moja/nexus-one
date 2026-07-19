# Build 018 — Livecare Runtime Fix

The Livecare runtime is embedded directly in `public/livecare.html` so fleet initialization cannot fail because `build6-livecare.js` was omitted, cached, or served from the wrong path. The page includes a build marker and versioned platform asset.
