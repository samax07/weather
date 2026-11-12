import { NextRequest, NextResponse } from "next/server";
import {
  getLatestReading,
  saveReading,
  sensorStorageConfigured,
} from "@/lib/readings";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function authorized(request: NextRequest): boolean {
  const expected = process.env.SENSOR_TOKEN;
  if (!expected) return true; // local development; set SENSOR_TOKEN in production

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ")
    ? header.slice("Bearer ".length)
    : request.headers.get("x-sensor-token");

  return provided === expected;
}

export async function GET() {
  try {
    const reading = await getLatestReading();
    return NextResponse.json(
      { reading, storageConfigured: sensorStorageConfigured() },
      { headers: NO_STORE },
    );
  } catch {
    return NextResponse.json(
      { reading: null, storageConfigured: false },
      { headers: NO_STORE },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json(
      { error: "Invalid sensor token." },
      { status: 401, headers: NO_STORE },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON." },
      { status: 400, headers: NO_STORE },
    );
  }

  const payload = body as Record<string, unknown>;
  const temperatureC = Number(payload.temperatureC);
  const humidity = Number(payload.humidity);

  if (!Number.isFinite(temperatureC) || temperatureC < -60 || temperatureC > 80) {
    return NextResponse.json(
      { error: "temperatureC must be a number between -60 and 80." },
      { status: 400, headers: NO_STORE },
    );
  }

  if (!Number.isFinite(humidity) || humidity < 0 || humidity > 100) {
    return NextResponse.json(
      { error: "humidity must be a number between 0 and 100." },
      { status: 400, headers: NO_STORE },
    );
  }

  let recordedAt = new Date().toISOString();
  if (typeof payload.recordedAt === "string") {
    const parsed = new Date(payload.recordedAt);
    if (!Number.isNaN(parsed.getTime())) recordedAt = parsed.toISOString();
  }

  try {
    const reading = await saveReading({ temperatureC, humidity, recordedAt });
    return NextResponse.json({ ok: true, reading }, { headers: NO_STORE });
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Could not store the reading.";
    return NextResponse.json(
      { error: message },
      { status: 503, headers: NO_STORE },
    );
  }
}
