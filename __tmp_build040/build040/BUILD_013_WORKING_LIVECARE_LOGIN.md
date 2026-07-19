# Build 013 — Working Livecare Login

- Replaced the misplaced text Menu control with a mobile-only hamburger control.
- Added working preview facility, dispatch, and driver accounts for local testing.
- Added scoped preview trips tied to the facility and driver profiles.
- Added clear server-not-running errors.
- Added loading and error states to staff sign-in.
- Added authenticated identity and secure sign-out on protected pages.
- Confirmed facility and driver APIs return only their permitted records.

## Run

1. `npm install`
2. `npm run build`
3. `npm start`
4. Open the local address printed by Node.

The preview credentials appear inside Livecare only when not running with `NODE_ENV=production`.
