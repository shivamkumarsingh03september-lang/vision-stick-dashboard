# Vision Stick — Live Dashboard Pipeline

```
ESP32-S3 (WiFi) --HTTP POST--> Node backend --WebSocket--> Web dashboard (live)
                                     |
                                     +--HTTP GET (polled)--> Alexa skill --> APL on Echo Show
```

## 1. Backend (run this first)
```
cd vision-stick-dashboard
npm init -y
npm install express ws cors
node server.js
```
Runs on `http://<your-machine-ip>:3000`. Keep this machine on the same
network as the ESP32 (or deploy it to a small cloud VM / Render /
Railway if you want it reachable from anywhere, which you'll need for
the Alexa skill anyway since Alexa's cloud must reach it over HTTPS).

## 2. ESP32 firmware
Open `esp32_wifi_post.ino`, fill in:
- `WIFI_SSID` / `WIFI_PASSWORD`
- `SERVER_URL` → `http://<backend-ip>:3000/api/reading`

Install the **ArduinoJson** library, then call `setupWiFiUplink()` in
`setup()` and `postReading(...)` once per `loop()` using the same
variables you're already printing to Serial.

## 3. Web dashboard
Open `dashboard.html` directly in a browser (or drop it in a `public/`
folder next to `server.js` so Express serves it at `/`). It connects
over WebSocket and updates the sonar view, environment readouts, and
depth history the instant a new reading arrives — no refresh needed.

## 4. Alexa / Echo Show
- Upload `apl_document.json` as your skill's APL document.
- Deploy `lambda_handler.js` as your skill's Lambda (needs
  `ask-sdk-core`), pointing `BACKEND_URL` at your **HTTPS-reachable**
  backend (Alexa's cloud can't hit `http://192.168.x.x`, so this piece
  needs to be publicly hosted).
- Read the auto-refresh note at the bottom of `lambda_handler.js` — an
  Echo Show screen has to *ask* for updates on a timer (SendEvent
  loop), since Alexa doesn't support arbitrary server push to an idle
  screen.

## Data shape (used everywhere)
```json
{
  "temp": 29.5, "hum": 57, "pres": 1003,
  "left": 16, "front": 37, "right": 35,
  "depth": 0, "baseline": 0,
  "status": "PATH CLEAR"
}
```
