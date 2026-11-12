# Weather Now

A small Next.js app that shows the current temperature and humidity for the
visitor's location. Built to deploy on Vercel with no API keys or environment
variables.

![weather](https://img.shields.io/badge/Next.js-16-black) ![weather](https://img.shields.io/badge/deploy-Vercel-black)

## How it works

- `app/api/weather/route.ts` proxies [Open-Meteo](https://open-meteo.com), a free
  weather API that needs no key. It accepts optional `lat`/`lon` query params,
  validates them, and otherwise falls back to Vercel's IP geolocation headers.
- The page shows an approximate reading immediately, then refines it with the
  browser's precise location if the visitor grants permission.
- The UI is server-rendered and hydrated on the client, with loading, error and
  retry states plus light and dark themes.

## Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Or import the repository at <https://vercel.com/new>. No configuration is
needed — Vercel detects Next.js and deploys it as-is.

## Notes

- Temperatures are in Fahrenheit (US default). Change `temperature_unit` in
  `app/api/weather/route.ts` to `celsius` if you prefer °C.
- Local development has no Vercel geo headers, so `/api/weather` uses Medford,
  Massachusetts as the fallback until the browser shares its location.
- Weather data is fetched with `cache: "no-store"` so each refresh is current.
