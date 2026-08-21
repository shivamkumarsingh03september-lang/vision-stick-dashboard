/*
  Vision Stick Dashboard Backend
  ------------------------------
  npm init -y
  npm install express ws cors

  Run: node server.js
  - ESP32 POSTs readings to      POST /api/reading
  - Web dashboard connects via   WebSocket ws://<host>:3000
  - Alexa skill polls (or you push proactively) via GET /api/reading
*/

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // serves dashboard.html if placed in ./public

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let latestReading = {
  temp: 0, hum: 0, pres: 0,
  left: 0, front: 0, right: 0,
  depth: 0, baseline: 0,
  status: 'NO DATA',
  timestamp: null
};

const history = []; // rolling buffer for charts
const MAX_HISTORY = 100;

// --- ESP32 posts new sensor readings here ---
app.post('/api/reading', (req, res) => {
  latestReading = { ...req.body, timestamp: Date.now() };

  history.push(latestReading);
  if (history.length > MAX_HISTORY) history.shift();

  // Broadcast to every connected web dashboard instantly
  const message = JSON.stringify({ type: 'reading', data: latestReading });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(message);
  });

  res.sendStatus(200);
});

// --- Latest reading (used by web dashboard on load, and by Alexa skill) ---
app.get('/api/reading', (req, res) => {
  res.json(latestReading);
});

// --- Recent history (for charts/sparklines) ---
app.get('/api/history', (req, res) => {
  res.json(history);
});

// --- WebSocket: send current state immediately on connect ---
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'reading', data: latestReading }));
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Vision Stick backend running on http://localhost:${PORT}`);
});
