# NEXUS ONE Build 005 — Facility Portal Enterprise

## Added
- Enterprise facility command board connected to the shared `nexusTrips` data model.
- Facility account summary with billing terms and credit-limit display.
- Patient transportation roster with mobility, payer and operational notes.
- Facility ride request workflow that creates Dispatch/Billing-ready trip records.
- Recurring transportation scheduling for dialysis, therapy and routine appointments.
- Pause/reactivate controls for recurring schedules.
- Facility transportation CSV reporting.
- Browser-persisted facility profile, patient roster and recurring schedules.

## New files
- `public/facility-service.js`
- `public/build5-facility.js`
- `BUILD_005_CHANGELOG.md`

## Modified
- `public/facility.html`
- `public/platform.css`

## Production note
Build 005 uses local browser persistence to demonstrate integrated workflow behavior. Production deployment should replace it with authenticated server storage, encryption, tenant isolation and HIPAA-aligned access controls.
