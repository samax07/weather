export type LocationSource = "client" | "ip" | "default";

export type WeatherSnapshot = {
  temperature: number;
  humidity: number;
  apparentTemperature: number;
  weatherCode: number;
  temperatureUnit: string;
  observedAt: string;
  timezone: string;
  timezoneAbbreviation: string;
  location: {
    label: string;
    latitude: number;
    longitude: number;
    source: LocationSource;
  };
};

export const FALLBACK_LOCATION = {
  label: "Medford, Massachusetts",
  latitude: 42.4184,
  longitude: -71.1062,
} as const;

/** WMO weather interpretation codes used by Open-Meteo. */
export function describeWeatherCode(code: number): {
  label: string;
  icon: string;
} {
  if (code === 0) return { label: "Clear sky", icon: "☀️" };
  if (code === 1) return { label: "Mainly clear", icon: "🌤️" };
  if (code === 2) return { label: "Partly cloudy", icon: "⛅" };
  if (code === 3) return { label: "Overcast", icon: "☁️" };
  if (code === 45 || code === 48) return { label: "Fog", icon: "🌫️" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", icon: "🌦️" };
  if (code >= 61 && code <= 67) return { label: "Rain", icon: "🌧️" };
  if (code >= 71 && code <= 77) return { label: "Snow", icon: "🌨️" };
  if (code >= 80 && code <= 82) return { label: "Rain showers", icon: "🌧️" };
  if (code === 85 || code === 86) return { label: "Snow showers", icon: "🌨️" };
  if (code >= 95) return { label: "Thunderstorm", icon: "⛈️" };
  return { label: "Mixed conditions", icon: "🌡️" };
}

export function humidityLabel(humidity: number): string {
  if (humidity < 30) return "Dry air";
  if (humidity <= 60) return "Comfortable";
  if (humidity <= 75) return "Humid";
  return "Very humid";
}

/** "2026-11-12T15:30" -> "3:30 PM" */
export function formatObservedTime(observedAt: string): string {
  const match = /T(\d{2}):(\d{2})/.exec(observedAt);
  if (!match) return observedAt;

  const hours = Number(match[1]);
  const minutes = match[2];
  const suffix = hours >= 12 ? "PM" : "AM";
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${minutes} ${suffix}`;
}
