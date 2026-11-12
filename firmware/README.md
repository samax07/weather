# ESP32 + DHT22 firmware

MicroPython firmware that reads a DHT22 every 30 seconds and posts the result to
the Weather Now API.

## Wiring

| DHT22 module | ESP32 |
| --- | --- |
| VCC / + | 3V3 |
| DATA / OUT / S | GPIO 27 |
| GND / − | GND |

GPIO 27 avoids the pins used by the board's other projects: the Simon Says
buttons are on 32, 33 and 25, the LEDs on 4/18/19, the buzzer on 13, and the RGB
LED on 2/15. Wiring diagram: [`../docs/dht22-wiring.png`](../docs/dht22-wiring.png).

The 3-pin module has a built-in pull-up. For a bare 4-pin sensor, add a
4.7k–10k resistor between 3V3 and DATA.

## Configure

```bash
cp firmware/config.example.py firmware/config.py
```

Set:

- `WIFI_SSID` / `WIFI_PASSWORD` — the board's network (Tufts_Wireless is open).
- `API_URL` — local development uses your computer's LAN address, not
  `localhost`, e.g. `http://192.168.1.50:3000/api/readings`. Deployed, use
  `https://your-project.vercel.app/api/readings`.
- `SENSOR_TOKEN` — must match the server's `SENSOR_TOKEN`. Leave empty when the
  server has no token configured.
- `READ_INTERVAL_SECONDS` — 30 seconds by default.

`config.py` is git-ignored so Wi-Fi passwords stay out of the repository.

## Upload

With the board on USB (`/dev/cu.usbserial-10` here):

```bash
mpremote connect /dev/cu.usbserial-10 cp firmware/config.py :config.py
mpremote connect /dev/cu.usbserial-10 cp firmware/main.py :main.py
mpremote connect /dev/cu.usbserial-10 reset
```

`main.py` runs automatically after reset. If the board already has a `main.py`
you want to keep, back it up first (`mpremote cp :main.py simon_says.py`) or
run this once without installing it:

```bash
mpremote connect /dev/cu.usbserial-10 run firmware/main.py
```

Watch the output with `mpremote connect /dev/cu.usbserial-10 repl`.

## API call

```http
POST /api/readings
Authorization: Bearer <SENSOR_TOKEN>
Content-Type: application/json

{ "temperatureC": 24.4, "humidity": 41.8 }
```

The server stamps `receivedAt`; the page treats a reading as live for five
minutes. A `200` response contains the stored reading, and errors are reported
with `400`, `401`, `503` and a JSON `error` message.

## Troubleshooting

- **Wi-Fi keeps retrying** — Tufts_Wireless may need the board's MAC address
  registered. The firmware prints its MAC on the REPL.
- **`OSError` reading the sensor** — check DATA is on GPIO 27, VCC is 3V3 (not
  5 V if the module is 3.3 V only), and the pull-up is present on a bare
  sensor. The DHT22 needs at least 2 seconds between reads.
- **`POST` fails with 401** — `SENSOR_TOKEN` differs from the server's.
- **`POST` fails with 503** — the server has no storage configured. Locally the
  in-memory store is enough; on Vercel set the Upstash variables.
