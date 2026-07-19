# Build 037 — Pinned Dependencies

## Completed

- Replaced all `latest` dependency ranges with exact versions.
- Moved Vite, TypeScript and the React Vite plugin to `devDependencies`.
- Added supported Node and npm engine ranges.
- Added the npm package-manager version used to create the lock file.
- Generated `package-lock.json`.
- Verified a clean installation using `npm ci`.
- Ran the complete production verification suite successfully.

## Pinned versions

- React: 19.2.7
- React DOM: 19.2.7
- Framer Motion: 12.42.2
- Lucide React: 1.25.0
- Vite: 8.1.5
- Vite React plugin: 6.0.3
- TypeScript: 7.0.2

## Verification result

`npm ci && npm run verify` completed successfully, including accessibility, production build, smoke, LiveCare, AI Operations, Executive and security foundation tests.

## Remaining build-pipeline task

Add CI configuration that requires `npm ci`, tests and the production build before deployment.
