"""Read a DHT22 and post each reading to the Weather Now API.

Wiring: DHT22 VCC -> 3V3, DATA -> SENSOR_PIN, GND -> GND.
Copy config.example.py to config.py on the board and fill it in first.
"""

import time

import dht
import machine
import network
import ujson
import urequests

try:
    import config
except ImportError:
    raise SystemExit(
        "config.py is missing - copy config.example.py to the board as config.py"
    )

WIFI_SSID = config.WIFI_SSID
WIFI_PASSWORD = config.WIFI_PASSWORD
API_URL = config.API_URL
SENSOR_TOKEN = getattr(config, "SENSOR_TOKEN", "")
READ_INTERVAL_SECONDS = getattr(config, "READ_INTERVAL_SECONDS", 5)
SENSOR_PIN = getattr(config, "SENSOR_PIN", 27)

sensor = dht.DHT22(machine.Pin(SENSOR_PIN))
wlan = network.WLAN(network.STA_IF)
wlan.active(True)


def connect_wifi():
    if wlan.isconnected():
        return True

    print("Connecting to Wi-Fi:", WIFI_SSID)
    wlan.connect(WIFI_SSID, WIFI_PASSWORD)

    for _ in range(40):
        if wlan.isconnected():
            break
        time.sleep(0.5)

    if wlan.isconnected():
        print("Wi-Fi connected:", wlan.ifconfig()[0])
        return True

    print("Wi-Fi connection failed")
    return False


def send_reading(temperature_c, humidity):
    payload = ujson.dumps(
        {"temperatureC": temperature_c, "humidity": humidity}
    )
    headers = {"Content-Type": "application/json"}
    if SENSOR_TOKEN:
        headers["Authorization"] = "Bearer " + SENSOR_TOKEN

    response = urequests.post(API_URL, data=payload, headers=headers)
    print("POST", response.status_code, response.text[:120])
    response.close()


while True:
    try:
        if connect_wifi():
            sensor.measure()
            temperature_c = round(sensor.temperature(), 1)
            humidity = round(sensor.humidity(), 1)
            print("DHT22:", temperature_c, "C", humidity, "%")
            send_reading(temperature_c, humidity)
    except Exception as exc:
        print("Error:", exc)

    time.sleep(READ_INTERVAL_SECONDS)
