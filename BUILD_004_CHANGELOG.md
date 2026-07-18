# NEXUS ONE Build 004 — Driver & Fleet Operations

## Added
- Mobile-first Driver Workspace with shift state, assigned vehicle, manifest, active-trip status progression and navigation handoff.
- Required pre-trip safety checklist shared through browser persistence.
- Driver incident reporting routed to the existing QA data store (`nexusIncidents`).
- Fleet Control Center with operational readiness, maintenance, fuel, inspections and assignment status.
- Illustrative live fleet position board with refreshable vehicle coordinates.
- Shared `public/build4-operations.js` state service for fleet, shift and trip workflow data.

## Integrated
- Driver status updates modify the same `nexusTrips` records used by Booking, Dispatch and Billing.
- Vehicle assignments and readiness are shared between Driver and Fleet modules.
- Existing branding, accessibility toolbar, LiveCare, NIPE, payments and Google Maps setup are preserved.

## Prototype boundary
Build 004 persists operational state in `localStorage` for immediate preview. Production use requires authenticated APIs, permission controls, durable database storage and a secured GPS provider.
