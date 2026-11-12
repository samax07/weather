"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  celsiusToFahrenheit,
  formatAge,
  isSensorFresh,
  sensorAgeMs,
  type SensorReading,
} from "@/lib/sensor";
import {
  describeWeatherCode,
  formatObservedTime,
  humidityLabel,
  type WeatherSnapshot,
} from "@/lib/weather";

type Coordinates = { latitude: number; longitude: number };

type CardView = {
  temperature: number;
  unit: string;
  humidity: number;
  icon: string;
  headline: string;
  detail: string;
  location: string;
  note: string;
  badge: string;
  footerLeft: string;
  footerRight: React.ReactNode;
  source: "sensor" | "weather";
};

export default function WeatherDashboard() {
  const [data, setData] = useState<WeatherSnapshot | null>(null);
  const [sensor, setSensor] = useState<SensorReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [detecting, setDetecting] = useState(true);
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const latestWeatherRequest = useRef(0);

  const loadWeather = useCallback(async (nextCoords: Coordinates | null) => {
    const requestId = ++latestWeatherRequest.current;
    setBusy(true);
    setError(null);

    try {
      const query = nextCoords
        ? `?lat=${nextCoords.latitude.toFixed(3)}&lon=${nextCoords.longitude.toFixed(3)}`
        : "";
      const response = await fetch(`/api/weather${query}`, {
        cache: "no-store",
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          typeof body?.error === "string"
            ? body.error
            : "Could not load the weather.",
        );
      }

      if (requestId !== latestWeatherRequest.current) return;
      setData(body as WeatherSnapshot);
    } catch (cause) {
      if (requestId !== latestWeatherRequest.current) return;
      setError(
        cause instanceof Error ? cause.message : "Could not load the weather.",
      );
    } finally {
      if (requestId === latestWeatherRequest.current) setBusy(false);
    }
  }, []);

  const loadSensor = useCallback(async () => {
    try {
      const response = await fetch("/api/readings", { cache: "no-store" });
      if (!response.ok) return;
      const body = await response.json().catch(() => null);
      setSensor((body?.reading as SensorReading | null) ?? null);
    } catch {
      // Keep the last known reading; the next poll may succeed.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Show the public weather feed right away. The page then switches to the
    // ESP32 reading as soon as one is available.
    loadWeather(null);
    loadSensor();

    const pollSensor = setInterval(loadSensor, 5_000);

    if (!("geolocation" in navigator)) {
      setDetecting(false);
      return () => {
        cancelled = true;
        clearInterval(pollSensor);
      };
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        const precise = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setCoords(precise);
        setDetecting(false);
        loadWeather(precise);
      },
      () => {
        if (!cancelled) setDetecting(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );

    return () => {
      cancelled = true;
      clearInterval(pollSensor);
    };
  }, [loadWeather, loadSensor]);

  const refresh = () => {
    loadWeather(coords);
    loadSensor();
  };

  const sensorFresh = isSensorFresh(sensor);
  const view: CardView | null =
    sensorFresh && sensor
      ? sensorView(sensor)
      : data
        ? weatherView(data, detecting)
        : null;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-dot" aria-hidden="true" />
          Weather Now
        </div>
        <button
          type="button"
          className="refresh"
          onClick={refresh}
          disabled={busy}
          data-busy={busy}
          aria-label="Refresh weather"
        >
          <RefreshIcon />
          {busy ? "Refreshing" : "Refresh"}
        </button>
      </header>

      <section className="card" aria-busy={busy || !view}>
        <p className="sr-only" role="status" aria-live="polite">
          {view
            ? `${view.temperature} degrees, ${view.humidity} percent humidity from ${view.location}.`
            : busy
              ? "Loading current weather."
              : "Weather unavailable."}
        </p>

        {!view && error ? (
          <ErrorState error={error} onRetry={refresh} />
        ) : !view ? (
          <Skeleton />
        ) : (
          <CardDetails view={view} />
        )}
      </section>

      {view && error && !sensorFresh ? (
        <p className="inline-error" role="alert">
          Couldn&apos;t refresh — showing the last reading.{" "}
          <button type="button" onClick={refresh}>
            Try again
          </button>
        </p>
      ) : null}

      {view ? (
        <p className="source-note">
          {sensorFresh
            ? "Reading live from the ESP32 in the room."
            : "No recent ESP32 reading — showing the local weather feed."}
        </p>
      ) : null}
    </div>
  );
}

function sensorView(reading: SensorReading): CardView {
  const age = sensorAgeMs(reading);

  return {
    temperature: Math.round(celsiusToFahrenheit(reading.temperatureC)),
    unit: "°F",
    humidity: Math.round(reading.humidity),
    icon: "🌡️",
    headline: "Your ESP32",
    detail: "· DHT22 reading",
    location: "DHT22 sensor",
    note: `Updated ${formatAge(age)}`,
    badge: "Sensor",
    footerLeft: `Reported ${formatAge(age)}`,
    footerRight: "via ESP32",
    source: "sensor",
  };
}

function weatherView(
  data: WeatherSnapshot,
  detecting: boolean,
): CardView {
  const weather = describeWeatherCode(data.weatherCode);
  const note = detecting
    ? "Finding your precise location…"
    : data.location.source === "client"
      ? "Based on your device location"
      : data.location.source === "ip"
        ? "Approximate location based on your network"
        : "Allow location access for your local weather";

  return {
    temperature: Math.round(data.temperature),
    unit: data.temperatureUnit,
    humidity: Math.round(data.humidity),
    icon: weather.icon,
    headline: weather.label,
    detail: `· feels like ${Math.round(data.apparentTemperature)}${data.temperatureUnit}`,
    location: data.location.label,
    note,
    badge: "Live",
    footerLeft: `Observed ${formatObservedTime(data.observedAt)} ${data.timezoneAbbreviation} · Local time`,
    footerRight: (
      <>
        Data from{" "}
        <a href="https://open-meteo.com" target="_blank" rel="noreferrer">
          Open-Meteo
        </a>
      </>
    ),
    source: "weather",
  };
}

function CardDetails({ view }: { view: CardView }) {
  return (
    <>
      <div className="location">
        {view.source === "sensor" ? <SensorIcon /> : <PinIcon />}
        <span className="location-name">{view.location}</span>
        <span className="location-note">{view.note}</span>
        <span className="badge" data-source={view.badge.toLowerCase()}>
          {view.badge}
        </span>
      </div>

      <div className="readings">
        <div className="temperature-block">
          <div className="temperature">
            <span className="weather-icon" aria-hidden="true">
              {view.icon}
            </span>
            <span className="temperature-value">
              {view.temperature}
              <span className="temperature-unit">{view.unit}</span>
            </span>
          </div>
          <p className="condition">
            <strong>{view.headline}</strong> {view.detail}
          </p>
        </div>

        <div className="humidity">
          <div className="stat-label">Humidity</div>
          <div className="humidity-value">
            {view.humidity}
            <span>%</span>
          </div>
          <div
            className="bar"
            role="meter"
            aria-valuenow={view.humidity}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Relative humidity"
          >
            <span
              className="bar-fill"
              style={{
                width: `${Math.min(100, Math.max(0, view.humidity))}%`,
              }}
            />
          </div>
          <div className="humidity-caption">{humidityLabel(view.humidity)}</div>
        </div>
      </div>

      <footer className="card-footer">
        <span>{view.footerLeft}</span>
        <span>{view.footerRight}</span>
      </footer>
    </>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="error-state">
      <h1>Weather unavailable</h1>
      <p>{error}</p>
      <button type="button" className="retry" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

function Skeleton() {
  return (
    <div aria-hidden="true">
      <div className="skeleton" style={{ width: "45%", height: 20 }} />
      <div className="readings">
        <div>
          <div className="skeleton" style={{ width: "70%", height: 84 }} />
          <div
            className="skeleton"
            style={{ width: "55%", height: 16, marginTop: 16 }}
          />
        </div>
        <div>
          <div className="skeleton" style={{ width: "45%", height: 14 }} />
          <div
            className="skeleton"
            style={{ width: "60%", height: 40, margin: "10px 0 14px" }}
          />
          <div className="skeleton" style={{ width: "100%", height: 6 }} />
        </div>
      </div>
      <div className="card-footer">
        <span className="skeleton" style={{ width: "40%", height: 12 }} />
        <span className="skeleton" style={{ width: "25%", height: 12 }} />
      </div>
    </div>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function SensorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="18" r="1.5" fill="currentColor" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
