# Google Maps Setup

The booking workflow reads the browser key from `VITE_GOOGLE_MAPS_API_KEY`.

Enable these APIs for the Google Cloud project:
- Maps JavaScript API
- Places API
- Directions API (Legacy) for the current route implementation

For production, restrict the browser key by HTTP referrer to the Nexus production and approved preview domains. Restrict API access to only the enabled Maps APIs.

Netlify environment variable:
`VITE_GOOGLE_MAPS_API_KEY`

After changing the key or environment variable, trigger a new production build.
