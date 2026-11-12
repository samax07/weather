import type { SensorReading } from "@/lib/sensor";

const LATEST_KEY = "weather:latest";
const HISTORY_KEY = "weather:history";
const HISTORY_LIMIT = 288; // 24 h at one reading every 5 min

type ReadingStore = {
  latest: SensorReading | null;
  history: SensorReading[];
};

/**
 * Local development has no external database, so readings live in this
 * process. On Vercel every request may land on a different instance, which is
 * why production uses Upstash Redis when its env vars are present.
 */
const globalForReadings = globalThis as typeof globalThis & {
  __weatherReadingStore?: ReadingStore;
};

const localStore: ReadingStore = (globalForReadings.__weatherReadingStore ??= {
  latest: null,
  history: [],
});

function upstashConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

async function upstashCommand(
  commands: unknown[][],
): Promise<Array<{ result?: unknown; error?: string }>> {
  const config = upstashConfig();
  if (!config) throw new Error("Upstash is not configured.");

  const response = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Upstash request failed with ${response.status}.`);
  }

  return (await response.json()) as Array<{ result?: unknown; error?: string }>;
}

export function sensorStorageConfigured(): boolean {
  return upstashConfig() !== null || !process.env.VERCEL;
}

export async function saveReading(
  input: Omit<SensorReading, "receivedAt">,
): Promise<SensorReading> {
  const reading: SensorReading = {
    ...input,
    receivedAt: new Date().toISOString(),
  };

  if (upstashConfig()) {
    const json = JSON.stringify(reading);
    const results = await upstashCommand([
      ["SET", LATEST_KEY, json],
      ["LPUSH", HISTORY_KEY, json],
      ["LTRIM", HISTORY_KEY, "0", String(HISTORY_LIMIT - 1)],
    ]);
    const failure = results.find((entry) => entry.error);
    if (failure) throw new Error(failure.error);
    return reading;
  }

  if (process.env.VERCEL) {
    throw new Error("Sensor storage is not configured.");
  }

  localStore.latest = reading;
  localStore.history.unshift(reading);
  localStore.history = localStore.history.slice(0, HISTORY_LIMIT);
  return reading;
}

export async function getLatestReading(): Promise<SensorReading | null> {
  if (upstashConfig()) {
    const [entry] = await upstashCommand([["GET", LATEST_KEY]]);
    if (entry?.error) throw new Error(entry.error);
    const value = entry?.result;
    if (typeof value !== "string") return null;
    try {
      return JSON.parse(value) as SensorReading;
    } catch {
      return null;
    }
  }

  return process.env.VERCEL ? null : localStore.latest;
}
