import { neon } from "@neondatabase/serverless";
import type { SensorReading } from "@/lib/sensor";

type Sql = ReturnType<typeof neon>;

type ReadingRow = {
  temperature_c: number;
  humidity: number;
  recorded_at: string | Date;
  received_at: string | Date;
};

const globalForReadings = globalThis as typeof globalThis & {
  __weatherSql?: Sql;
  __weatherSchema?: Promise<void>;
  __weatherLocal?: { latest: SensorReading | null };
};

const localStore = (globalForReadings.__weatherLocal ??= { latest: null });

function connectionString(): string | null {
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.NEON_DATABASE_URL ??
    null
  );
}

function database(): Sql {
  const url = connectionString();
  if (!url) throw new Error("DATABASE_URL is not set.");
  return (globalForReadings.__weatherSql ??= neon(url));
}

async function createSchema(sql: Sql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS readings (
      id BIGSERIAL PRIMARY KEY,
      temperature_c DOUBLE PRECISION NOT NULL,
      humidity DOUBLE PRECISION NOT NULL,
      recorded_at TIMESTAMPTZ NOT NULL,
      received_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS readings_received_at_idx
    ON readings (received_at DESC)
  `;
}

async function ensureSchema(): Promise<Sql> {
  const sql = database();
  if (!globalForReadings.__weatherSchema) {
    globalForReadings.__weatherSchema = createSchema(sql).catch((cause) => {
      globalForReadings.__weatherSchema = undefined;
      throw cause;
    });
  }
  await globalForReadings.__weatherSchema;
  return sql;
}

function mapRow(row: ReadingRow): SensorReading {
  return {
    temperatureC: Number(row.temperature_c),
    humidity: Number(row.humidity),
    recordedAt: new Date(row.recorded_at).toISOString(),
    receivedAt: new Date(row.received_at).toISOString(),
  };
}

export function sensorStorageConfigured(): boolean {
  return connectionString() !== null || !process.env.VERCEL;
}

export async function saveReading(
  input: Omit<SensorReading, "receivedAt">,
): Promise<SensorReading> {
  if (!connectionString()) {
    if (process.env.VERCEL) {
      throw new Error("DATABASE_URL is not set.");
    }

    const reading: SensorReading = {
      ...input,
      receivedAt: new Date().toISOString(),
    };
    localStore.latest = reading;
    return reading;
  }

  const sql = await ensureSchema();
  const rows = (await sql`
    INSERT INTO readings (temperature_c, humidity, recorded_at)
    VALUES (${input.temperatureC}, ${input.humidity}, ${input.recordedAt})
    RETURNING temperature_c, humidity, recorded_at, received_at
  `) as ReadingRow[];

  return mapRow(rows[0]);
}

export async function getLatestReading(): Promise<SensorReading | null> {
  if (!connectionString()) {
    return process.env.VERCEL ? null : localStore.latest;
  }

  const sql = await ensureSchema();
  const rows = (await sql`
    SELECT temperature_c, humidity, recorded_at, received_at
    FROM readings
    ORDER BY received_at DESC
    LIMIT 1
  `) as ReadingRow[];

  return rows.length > 0 ? mapRow(rows[0]) : null;
}
