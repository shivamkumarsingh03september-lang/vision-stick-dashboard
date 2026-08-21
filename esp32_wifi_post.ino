/*
  WEATHER ADAPTIVE VISION STICK - WiFi Live Dashboard Uplink
  ------------------------------------------------------------
  Add this to your existing sketch. It takes the same variables
  you already print to Serial (temp, hum, pres, leftCm, frontCm,
  rightCm, depthMm, baseline, status) and POSTs them as JSON to
  your backend server every loop cycle, instead of (or in
  addition to) printing to Serial.

  Install library: "ArduinoJson" (by Benoit Blanchon) via Library Manager.
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ---- CONFIG ----
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL    = "http://YOUR_SERVER_IP:3000/api/reading"; // Node backend below
const unsigned long POST_INTERVAL_MS = 1000; // how often to push data

unsigned long lastPostTime = 0;

void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected: " + WiFi.localIP().toString());
}

// Call this once in setup()
void setupWiFiUplink() {
  connectWiFi();
}

/*
  Call this once per loop() with your already-computed sensor values.
  Non-blocking-ish: only actually sends every POST_INTERVAL_MS.
*/
void postReading(float tempC, float humPct, float presHpa,
                  int leftCm, int frontCm, int rightCm,
                  int depthMm, float baseline, const char* status) {

  unsigned long now = millis();
  if (now - lastPostTime < POST_INTERVAL_MS) return;
  lastPostTime = now;

  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    return;
  }

  StaticJsonDocument<256> doc;
  doc["temp"]     = tempC;
  doc["hum"]      = humPct;
  doc["pres"]     = presHpa;
  doc["left"]     = leftCm;
  doc["front"]    = frontCm;
  doc["right"]    = rightCm;
  doc["depth"]    = depthMm;
  doc["baseline"] = baseline;
  doc["status"]   = status;

  String payload;
  serializeJson(doc, payload);

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  int httpCode = http.POST(payload);

  if (httpCode <= 0) {
    Serial.printf("POST failed: %s\n", http.errorToString(httpCode).c_str());
  }
  http.end();
}

/*
  ---- USAGE ----
  In setup():
      Serial.begin(115200);
      setupWiFiUplink();

  In loop(), right after you compute/print your existing block:
      postReading(tempC, humPct, presHpa, leftCm, frontCm, rightCm,
                   depthMm, baselineVal, statusStr);
*/
