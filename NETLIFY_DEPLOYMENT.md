# Netlify deployment

The npm lockfile and npm configuration in this package use the public registry:

- `https://registry.npmjs.org/`

Netlify settings:

- Base directory: leave empty (when this folder is the repository root)
- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Node version: `22`

## Important backend limitation

This Netlify configuration deploys the React/Vite frontend only. The current backend uses a persistent Node server and SQLite database (`server.mjs` and `data/`). Netlify's static hosting does not run that server or provide durable SQLite storage.

For the complete current full-stack application, deploy with the included `render.yaml` on Render. To use Netlify for the complete stack, migrate the API to Netlify Functions and use an external managed database such as Neon, Supabase, or another PostgreSQL service.
