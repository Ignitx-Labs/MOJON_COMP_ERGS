'use strict';

const express = require('express');
const http    = require('http');
const WebSocket = require('ws');
const path    = require('path');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ── State ─────────────────────────────────────────────────────────────────────

const MAX_PARTICIPANTS = 10;

const state = {
  raceStatus:     'idle',   // idle | running | paused | finished
  raceStartTime:  null,
  targetDistance: 2000,     // metres
  participants:   {},       // id → participant
  detectedDevices: {},      // antId → { id, type, lastSeen }
};

function makeParticipant(id, name, antDeviceId = null) {
  return {
    id,
    name,
    antDeviceId,
    distance:    0,
    watts:       0,
    spm:         0,
    pace:        0,   // seconds per 500 m
    elapsedTime: 0,
    finished:    false,
    finishTime:  null,
    lastUpdate:  Date.now(),
  };
}

function getPublicState() {
  const sorted = Object.values(state.participants)
    .sort((a, b) => {
      // Finished participants sorted by finish time first
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.distance - a.distance;
    })
    .map((p, i) => ({ ...p, rank: i + 1 }));

  return {
    raceStatus:      state.raceStatus,
    raceStartTime:   state.raceStartTime,
    targetDistance:  state.targetDistance,
    participants:    sorted,
    detectedDevices: Object.values(state.detectedDevices),
    serverTime:      Date.now(),
  };
}

function broadcast(message) {
  const data = JSON.stringify(message);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  });
}

function broadcastState() {
  broadcast({ type: 'state', data: getPublicState() });
}

// ── ANT+ ──────────────────────────────────────────────────────────────────────

let antAvailable = false;

function updateFromAnt(data) {
  const devId = String(data.DeviceID);

  // Track the detected device regardless of registration
  state.detectedDevices[devId] = {
    id:       devId,
    type:     data.EquipmentType || 'Unknown',
    lastSeen: Date.now(),
  };

  // Only update if device is linked to a registered participant
  const p = Object.values(state.participants).find(x => x.antDeviceId === devId);
  if (!p || state.raceStatus !== 'running') {
    // Still broadcast so admin sees new devices
    broadcastState();
    return;
  }

  const speed = typeof data.RealSpeed === 'number' ? data.RealSpeed : 0;

  if (typeof data.Distance           === 'number') p.distance    = data.Distance;
  if (typeof data.InstantaneousPower === 'number') p.watts       = data.InstantaneousPower;
  if (typeof data.Cadence            === 'number') p.spm         = data.Cadence;
  if (typeof data.ElapsedTime        === 'number') p.elapsedTime = data.ElapsedTime;
  p.pace       = speed > 0 ? 500 / speed : p.pace;
  p.lastUpdate = Date.now();

  // Detect finish
  if (!p.finished && p.distance >= state.targetDistance) {
    p.finished   = true;
    p.finishTime = Date.now();
    broadcast({ type: 'finish', participantId: p.id, name: p.name });
  }

  broadcastState();
}

function initAnt() {
  let Ant;
  try {
    Ant = require('ant-plus');
  } catch (e) {
    console.warn('[ANT+] ant-plus not found – run: npm install');
    return;
  }

  // Try to list USB devices to give a helpful diagnosis
  let usbDiag = '';
  try {
    const usb = require('usb');
    const devices = usb.getDeviceList();
    const ant = devices.find(d =>
      d.deviceDescriptor.idVendor === 0x0FCF
    );
    if (ant) {
      usbDiag = `  USB: ANT+ stick found (PID 0x${ant.deviceDescriptor.idProduct.toString(16).toUpperCase()}) but driver wrong.`;
    } else {
      usbDiag = '  USB: No ANT+ stick detected (VID 0x0FCF not found). Check USB connection.';
    }
  } catch (e) { /* usb module not directly accessible */ }

  // Try both Stick2 (most common) and Stick3
  let stick = new Ant.GarminStick2();
  let opened = stick.open();

  if (!opened) {
    // Try Stick3
    stick = new Ant.GarminStick3();
    opened = stick.open();
  }

  if (!opened) {
    console.warn('');
    console.warn('  ╔══════════════════════════════════════════════════════════════╗');
    console.warn('  ║  ANT+ USB STICK NOT ACCESSIBLE                               ║');
    console.warn('  ╠══════════════════════════════════════════════════════════════╣');
    if (usbDiag) console.warn(`  ║  ${usbDiag.padEnd(61)}║`);
    console.warn('  ║                                                              ║');
    console.warn('  ║  WINDOWS FIX (required once):                               ║');
    console.warn('  ║  1. Download Zadig: https://zadig.akeo.ie                    ║');
    console.warn('  ║  2. Plug in your ANT+ USB stick                              ║');
    console.warn('  ║  3. In Zadig: Options → List All Devices                     ║');
    console.warn('  ║  4. Select "ANT USB Stick 2" (or similar ANT device)         ║');
    console.warn('  ║  5. Choose driver: WinUSB  → click "Replace Driver"          ║');
    console.warn('  ║  6. Restart this server as Administrator:                    ║');
    console.warn('  ║     Right-click cmd.exe → Run as administrator               ║');
    console.warn('  ║     then: node server.js                                     ║');
    console.warn('  ║                                                              ║');
    console.warn('  ║  The app still works — use Admin panel → Add Demo rowers     ║');
    console.warn('  ╚══════════════════════════════════════════════════════════════╝');
    console.warn('');
    return;
  }

  stick.on('startup', () => {
    console.log('[ANT+] ✓ Stick ready — scanning for FE-C devices (PM5, Bike, etc.)');
    antAvailable = true;
    broadcastState();

    const scanner = new Ant.FitnessEquipmentScanner(stick);
    scanner.on('fitnessData', (data) => {
      // Log first detection of each device so user can see it in console
      if (!state.detectedDevices[String(data.DeviceID)]) {
        console.log(`[ANT+] New device detected: ID=${data.DeviceID} Type=${data.EquipmentType || 'FE'}`);
      }
      updateFromAnt(data);
    });
    scanner.scan();
  });

  stick.on('shutdown', () => {
    console.warn('[ANT+] Stick disconnected');
    antAvailable = false;
    broadcastState();
  });
}

// ── Demo / simulation mode ────────────────────────────────────────────────────

const _demoTimers = {};

function startDemoRower(p) {
  // Each demo rower has slightly different "style" for realistic variation
  const speedBase  = 2.8 + Math.random() * 0.6;  // m/s  (~2:00–2:30/500m)
  const spmBase    = 20  + Math.random() * 8;
  const wattsBase  = 100 + Math.random() * 100;

  let lastTick = Date.now();

  _demoTimers[p.id] = setInterval(() => {
    if (state.raceStatus !== 'running') return;

    const now = Date.now();
    const dt  = (now - lastTick) / 1000;
    lastTick  = now;

    // Small random variation each tick
    const speed = Math.max(0.5, speedBase + (Math.random() - 0.5) * 0.3);

    p.distance    = (p.distance || 0) + speed * dt;
    p.watts       = Math.round(wattsBase + (Math.random() - 0.5) * 20);
    p.spm         = Math.round(spmBase   + (Math.random() - 0.5) * 2);
    p.pace        = 500 / speed;
    p.elapsedTime = (Date.now() - state.raceStartTime) / 1000;
    p.lastUpdate  = Date.now();

    if (!p.finished && p.distance >= state.targetDistance) {
      p.finished   = true;
      p.finishTime = Date.now();
      broadcast({ type: 'finish', participantId: p.id, name: p.name });
    }

    broadcastState();
  }, 250);
}

function stopDemoRower(id) {
  clearInterval(_demoTimers[id]);
  delete _demoTimers[id];
}

// ── REST API ──────────────────────────────────────────────────────────────────

// Add participant
app.post('/api/participants', (req, res) => {
  const { name, antDeviceId, demo } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (Object.keys(state.participants).length >= MAX_PARTICIPANTS) {
    return res.status(400).json({ error: `Maximum ${MAX_PARTICIPANTS} participants` });
  }

  const id = `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const p  = makeParticipant(id, name.trim(), antDeviceId || null);
  p.demo   = !!demo;

  state.participants[id] = p;

  if (demo && state.raceStatus === 'running') startDemoRower(p);

  broadcastState();
  res.json({ success: true, id });
});

// Remove participant
app.delete('/api/participants/:id', (req, res) => {
  const { id } = req.params;
  if (!state.participants[id]) return res.status(404).json({ error: 'not found' });
  stopDemoRower(id);
  delete state.participants[id];
  broadcastState();
  res.json({ success: true });
});

// Update participant (rename or re-link ANT+ device)
app.patch('/api/participants/:id', (req, res) => {
  const p = state.participants[req.params.id];
  if (!p) return res.status(404).json({ error: 'not found' });
  if (req.body.name)                        p.name        = req.body.name.trim();
  if (req.body.antDeviceId !== undefined)   p.antDeviceId = req.body.antDeviceId || null;
  broadcastState();
  res.json({ success: true });
});

// Race: start
app.post('/api/race/start', (req, res) => {
  if (req.body.targetDistance) state.targetDistance = Number(req.body.targetDistance);

  state.raceStatus    = 'running';
  state.raceStartTime = Date.now();

  // Reset distances so a restart is clean
  Object.values(state.participants).forEach(p => {
    p.distance = 0; p.watts = 0; p.spm = 0; p.pace = 0;
    p.elapsedTime = 0; p.finished = false; p.finishTime = null;
    if (p.demo) startDemoRower(p);
  });

  broadcastState();
  res.json({ success: true });
});

// Race: pause
app.post('/api/race/pause', (req, res) => {
  state.raceStatus = 'paused';
  broadcastState();
  res.json({ success: true });
});

// Race: finish / stop early
app.post('/api/race/finish', (req, res) => {
  state.raceStatus = 'finished';
  broadcastState();
  res.json({ success: true });
});

// Race: reset
app.post('/api/race/reset', (req, res) => {
  state.raceStatus    = 'idle';
  state.raceStartTime = null;
  Object.values(state.participants).forEach(p => {
    stopDemoRower(p.id);
    p.distance = 0; p.watts = 0; p.spm = 0; p.pace = 0;
    p.elapsedTime = 0; p.finished = false; p.finishTime = null;
  });
  broadcastState();
  res.json({ success: true });
});

// Current state (for HTTP polling fallback)
app.get('/api/state', (req, res) => res.json(getPublicState()));

// ANT+ status
app.get('/api/ant', (req, res) => {
  let usbFound = false;
  let usbPid   = null;
  try {
    const usb     = require('usb');
    const devices = usb.getDeviceList();
    const ant     = devices.find(d => d.deviceDescriptor.idVendor === 0x0FCF);
    if (ant) { usbFound = true; usbPid = `0x${ant.deviceDescriptor.idProduct.toString(16).toUpperCase()}`; }
  } catch (e) {}
  res.json({ available: antAvailable, usbFound, usbPid, platform: process.platform });
});

// ── WebSocket ─────────────────────────────────────────────────────────────────

wss.on('connection', ws => {
  ws.send(JSON.stringify({ type: 'state', data: getPublicState() }));
});

// ── Boot ──────────────────────────────────────────────────────────────────────

initAnt();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║      MOJON COMP ERGS  v1.0           ║');
  console.log('  ╚══════════════════════════════════════╝');
  console.log(`  Dashboard : http://localhost:${PORT}/`);
  console.log(`  Admin     : http://localhost:${PORT}/admin.html`);
  console.log('');
});
