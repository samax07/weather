# Weather Now

A small Next.js app that shows the current temperature and humidity. It prefers
a live DHT22 reading from an ESP32 in the room and falls back to the local
weather feed when the sensor has gone quiet.

![weather](https://img.shields.io/badge/Next.js-16-black) ![weather](https://img.shields.io/badge/deploy-Vercel-black)

## How it works

- `POST /api/readings` accepts a reading from the ESP32, validates it and stores
  it. `GET /api/readings` returns the latest one.
- The dashboard polls that endpoint every minute. A reading younger than five
  minutes wins; otherwise the page falls back to Open-Meteo.
- `app/api/weather/route.ts` proxies [Open-Meteo](https://open-meteo.com), a free
  weather API that needs no key. It accepts optional `lat`/`lon` query params,
  validates them, and otherwise falls back to Vercel's IP geolocation headers.
- The UI is server-rendered and hydrated on the client, with loading, error and
  retry states plus light and dark themes.

## Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Without any sensor traffic the page shows the
weather feed, so it works before the ESP32 is involved.

## ESP32 sensor

The firmware in [`firmware/`](firmware/README.md) reads a DHT22 and posts a
reading every 30 seconds:

```http
POST /api/readings
Authorization: Bearer <SENSOR_TOKEN>
Content-Type: application/json

{ "temperatureC": 24.4, "humidity": 41.8 }
```

`GET /api/readings` answers with:

```json
{ "reading": { "temperatureC": 24.4, "humidity": 41.8, "recordedAt": "…", "receivedAt": "…" }, "storageConfigured": true }
```

### Storage

Local development keeps the latest reading in memory. Vercel runs each request
in a fresh instance, so production needs a shared store — the app uses
[Upstash Redis](https://upstash.com) through its REST API when these are set:

| Variable | Purpose |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` | Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Redis REST token |
| `SENSOR_TOKEN` | Shared secret the ESP32 sends as a bearer token |

Upstash's free tier is enough. Add both variables in Vercel → Project →
Settings → Environment Variables. Without them, `POST /api/readings` returns
`503` in production and the page keeps using Open-Meteo.

## Deploy to Vercel

Import the repository at <https://vercel.com/new> — Vercel detects Next.js and
builds it as-is. Add the storage variables above, then point the ESP32's
`API_URL` at `https://your-project.vercel.app/api/readings`.

## Notes

- Temperatures are stored in Celsius and shown in Fahrenheit. Change the unit
  in `app/WeatherDashboard.tsx` if you prefer °C.
- Local development has no Vercel geo headers, so `/api/weather` uses Medford,
  Massachusetts as the fallback until the browser shares its location.
- Weather data and readings are fetched with `cache: "no-store"`.
