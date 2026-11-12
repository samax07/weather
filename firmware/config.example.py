# Copy this file to config.py on the ESP32 and fill in your own values.
# config.py is git-ignored so your Wi-Fi password never lands in the repo.

WIFI_SSID = "your-wifi-name"
WIFI_PASSWORD = "your-wifi-password"

# Local development: your computer's LAN address (not localhost) plus port.
# Deployed: your Vercel URL.
API_URL = "http://YOUR-COMPUTER-IP:3000/api/readings"

# Must match SENSOR_TOKEN in the server environment. Leave empty for local
# development when SENSOR_TOKEN is unset on the server.
SENSOR_TOKEN = "change-me"

# GPIO the DHT22 data line is wired to. 27 avoids the Simon Says buttons;
# use 33 if the sensor is still on that pin.
SENSOR_PIN = 27

# The DHT22 needs at least 2 seconds between reads; the board posts every
# 5 seconds.
READ_INTERVAL_SECONDS = 5
