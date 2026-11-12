import { NextRequest, NextResponse } from "next/server";
import { FALLBACK_LOCATION, type WeatherSnapshot } from "@/lib/weather";

export const dynamic = "force-dynamic";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

type Coordinates = { latitude: number; longitude: number };

function parseCoordinate(value: string | null, limit: number): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || Math.abs(parsed) > limit) return null;
  return parsed;
}

function coordinatesFromQuery(request: NextRequest): Coordinates | null {
  const latitude = parseCoordinate(
    request.nextUrl.searchParams.get("lat"),
    90,
  );
  const longitude = parseCoordinate(
    request.nextUrl.searchParams.get("lon"),
    180,
  );
  if (latitude === null || longitude === null) return null;
  return { latitude, longitude };
}

function decodeHeader(value: string | null): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Vercel adds coarse IP-based geolocation headers to every request.
 * They're absent in local development, which is fine — we fall back.
 */
function coordinatesFromHeaders(request: NextRequest): {
  coordinates: Coordinates;
  label: string;
} | null {
  const latitude = parseCoordinate(
    request.headers.get("x-vercel-ip-latitude"),
    90,
  );
  const longitude = parseCoordinate(
    request.headers.get("x-vercel-ip-longitude"),
    180,
  );
  if (latitude === null || longitude === null) return null;

  const city = request.headers.get("x-vercel-ip-city");
  const region = request.headers.get("x-vercel-ip-country-region");
  const country = request.headers.get("x-vercel-ip-country");

  const parts = [
    decodeHeader(city),
    decodeHeader(region),
    decodeHeader(country),
  ].filter((part): part is string => Boolean(part));

  return {
    coordinates: { latitude, longitude },
    label: parts.length > 0 ? parts.join(", ") : "Your area",
  };
}

/** "America/New_York" -> "EST"; falls back to the API's "GMT-5" style value. */
function timezoneAbbreviation(timeZone: string, fallback: string): string {
  try {
    return (
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        timeZoneName: "short",
      })
        .formatToParts(new Date())
        .find((part) => part.type === "timeZoneName")?.value ?? fallback
    );
  } catch {
    return fallback;
  }
}

export async function GET(request: NextRequest) {
  const fromQuery = coordinatesFromQuery(request);
  const fromHeaders = fromQuery ? null : coordinatesFromHeaders(request);

  const coordinates =
    fromQuery ?? fromHeaders?.coordinates ?? FALLBACK_LOCATION;
  const label = fromQuery
    ? "Your location"
    : (fromHeaders?.label ?? FALLBACK_LOCATION.label);
  const source = fromQuery ? "client" : fromHeaders ? "ip" : "default";

  const upstream = new URL(OPEN_METEO_URL);
  upstream.search = new URLSearchParams({
    latitude: coordinates.latitude.toFixed(4),
    longitude: coordinates.longitude.toFixed(4),
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code",
    temperature_unit: "fahrenheit",
    timezone: "auto",
    forecast_days: "1",
  }).toString();

  let payload: {
    current?: Record<string, number | string>;
    current_units?: Record<string, string>;
    timezone?: string;
    timezone_abbreviation?: string;
  };

  try {
    const response = await fetch(upstream, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "The weather service is unavailable right now." },
        { status: 502 },
      );
    }

    payload = await response.json();
  } catch {
    return NextResponse.json(
      { error: "Could not reach the weather service." },
      { status: 504 },
    );
  }

  const current = payload.current;
  if (
    !current ||
    typeof current.temperature_2m !== "number" ||
    typeof current.relative_humidity_2m !== "number"
  ) {
    return NextResponse.json(
      { error: "The weather service returned an unexpected response." },
      { status: 502 },
    );
  }

  const snapshot: WeatherSnapshot = {
    temperature: current.temperature_2m,
    humidity: current.relative_humidity_2m,
    apparentTemperature:
      typeof current.apparent_temperature === "number"
        ? current.apparent_temperature
        : current.temperature_2m,
    weatherCode:
      typeof current.weather_code === "number" ? current.weather_code : 2,
    temperatureUnit: payload.current_units?.temperature_2m ?? "°F",
    observedAt: String(current.time ?? ""),
    timezone: payload.timezone ?? "UTC",
    timezoneAbbreviation: timezoneAbbreviation(
      payload.timezone ?? "UTC",
      payload.timezone_abbreviation ?? "",
    ),
    location: {
      label,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      source,
    },
  };

  return NextResponse.json(snapshot, {
    headers: { "Cache-Control": "no-store" },
  });
}
