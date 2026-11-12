"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  describeWeatherCode,
  formatObservedTime,
  humidityLabel,
  type WeatherSnapshot,
} from "@/lib/weather";

type Coordinates = { latitude: number; longitude: number };

export default function WeatherDashboard() {
  const [data, setData] = useState<WeatherSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [detecting, setDetecting] = useState(true);
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const latestRequest = useRef(0);

  const load = useCallback(async (nextCoords: Coordinates | null) => {
    const requestId = ++latestRequest.current;
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

      if (requestId !== latestRequest.current) return;
      setData(body as WeatherSnapshot);
    } catch (cause) {
      if (requestId !== latestRequest.current) return;
      setError(
        cause instanceof Error ? cause.message : "Could not load the weather.",
      );
    } finally {
      if (requestId === latestRequest.current) setBusy(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Show the network-approximate reading right away, then refine it with
    // the device's more precise location if the visitor allows it.
    load(null);

    if (!("geolocation" in navigator)) {
      setDetecting(false);
      return;
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
        load(precise);
      },
      () => {
        if (!cancelled) setDetecting(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );

    return () => {
      cancelled = true;
    };
  }, [load]);

  const refresh = () => load(coords);

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

      <section className="card" aria-busy={busy}>
        <p className="sr-only" role="status" aria-live="polite">
          {data
            ? `${Math.round(data.temperature)} degrees, ${Math.round(data.humidity)} percent humidity in ${data.location.label}.`
            : busy
              ? "Loading current weather."
              : "Weather unavailable."}
        </p>

        {!data && error ? (
          <ErrorState error={error} onRetry={refresh} />
        ) : !data ? (
          <Skeleton />
        ) : (
          <WeatherDetails data={data} detecting={detecting} />
        )}
      </section>

      {data && error ? (
        <p className="inline-error" role="alert">
          Couldn&apos;t refresh — showing the last reading.{" "}
          <button type="button" onClick={refresh}>
            Try again
          </button>
        </p>
      ) : null}
    </div>
  );
}

function WeatherDetails({
  data,
  detecting,
}: {
  data: WeatherSnapshot;
  detecting: boolean;
}) {
  const temperature = Math.round(data.temperature);
  const feelsLike = Math.round(data.apparentTemperature);
  const humidity = Math.round(data.humidity);
  const weather = describeWeatherCode(data.weatherCode);

  const note = detecting
    ? "Finding your precise location…"
    : data.location.source === "client"
      ? "Based on your device location"
      : data.location.source === "ip"
        ? "Approximate location based on your network"
        : "Allow location access for your local weather";

  return (
    <>
      <div className="location">
        <PinIcon />
        <span className="location-name">{data.location.label}</span>
        <span className="location-note">{note}</span>
        <span className="badge">Live</span>
      </div>

      <div className="readings">
        <div className="temperature-block">
          <div className="temperature">
            <span className="weather-icon" aria-hidden="true">
              {weather.icon}
            </span>
            <span className="temperature-value">
              {temperature}
              <span className="temperature-unit">{data.temperatureUnit}</span>
            </span>
          </div>
          <p className="condition">
            <strong>{weather.label}</strong> · feels like {feelsLike}
            {data.temperatureUnit}
          </p>
        </div>

        <div className="humidity">
          <div className="stat-label">Humidity</div>
          <div className="humidity-value">
            {humidity}
            <span>%</span>
          </div>
          <div
            className="bar"
            role="meter"
            aria-valuenow={humidity}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Relative humidity"
          >
            <span
              className="bar-fill"
              style={{ width: `${Math.min(100, Math.max(0, humidity))}%` }}
            />
          </div>
          <div className="humidity-caption">{humidityLabel(humidity)}</div>
        </div>
      </div>

      <footer className="card-footer">
        <span>
          Observed {formatObservedTime(data.observedAt)}{" "}
          {data.timezoneAbbreviation} · Local time
        </span>
        <span>
          Data from{" "}
          <a href="https://open-meteo.com" target="_blank" rel="noreferrer">
            Open-Meteo
          </a>
        </span>
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
