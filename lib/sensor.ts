export type SensorReading = {
  /** Degrees Celsius as measured by the DHT22. */
  temperatureC: number;
  /** Relative humidity, 0–100 %. */
  humidity: number;
  /** When the ESP32 says it took the reading (ISO 8601). */
  recordedAt: string;
  /** When the API received it (ISO 8601). */
  receivedAt: string;
};

/** Readings older than this fall back to the public weather feed. */
export const SENSOR_FRESH_MS = 5 * 60 * 1000;

export function sensorAgeMs(
  reading: SensorReading,
  now: number = Date.now(),
): number {
  const received = Date.parse(reading.receivedAt);
  if (Number.isNaN(received)) return Number.POSITIVE_INFINITY;
  return Math.max(0, now - received);
}

export function isSensorFresh(
  reading: SensorReading | null,
  now: number = Date.now(),
): reading is SensorReading {
  return reading !== null && sensorAgeMs(reading, now) <= SENSOR_FRESH_MS;
}

export function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}

export function formatAge(ageMs: number): string {
  if (ageMs < 15_000) return "just now";
  const seconds = Math.round(ageMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}
