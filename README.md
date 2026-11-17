# MOJON — AI Workout Tracker + Live ERG Competition Platform

**MOJON** is a two-in-one fitness platform built by [Luca Spinelli](https://github.com/lucaspinelli):

| Module | What it does |
|--------|-------------|
| **MOJON Workout Tracker** | Browser-based AI rep counter — MediaPipe pose detection, 20 exercises, body composition scan |
| **MOJON COMP ERGS** | Live rowing competition dashboard — ANT+ Concept2 ERG integration, real-time leaderboard, admin panel |

Both modules run from a single Node.js server.

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Download the MediaPipe pose model (~9 MB)

```bash
mkdir -p public/models
curl -L -o public/models/pose_landmarker_full.task \
  https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task
```

### 3. Start the server

```bash
node server.js
```

| URL | Page |
|-----|------|
| `http://localhost:3000/` | MOJON Workout Tracker |
| `http://localhost:3000/competition.html` | ERG Live Race Dashboard |
| `http://localhost:3000/admin.html` | ERG Admin Panel |

> **Camera required** for the workout tracker. Stand back so your full body is visible.

---

## MOJON Workout Tracker

AI-powered rep counting via your webcam — no wearables needed.

**Features**
- Real-time rep counting for 20 exercises
- Three workout modalities: **EMOM**, **AMRAP**, **FOR TIME**
- Drag-and-drop circuit builder
- Live coaching cues on-screen
- 3-pose body composition scan (front / side / back) with BF% estimate
- Workout history saved to localStorage

**Exercises:** Squats · Pushups · Lunges · Burpees · High Knees · Mountain Climbers · Shoulder Taps · Jumping Jacks · Calf Raises · Reverse Lunges · Side Lunges · Jump Squats · Skaters · Lateral Raises · Overhead Press · Sumo Squat · Wall Sit · Step Ups · Cross-Body Mountain Climbers · Plank

**Tech:** MediaPipe Tasks Vision (WebAssembly, runs fully in-browser) · Quaternion joint angle math · SortableJS

### Adding a new exercise

Create `public/movements/<name>.js`:

```js
export const name = "My Exercise";
export const defaultReps = 10;
import { isValid, angleBetween3D } from './utils.js';

export function detector(pose, rep, phase) {
  const kp = pose.keypoints ?? pose;
  // kp — 33 landmarks, normalized 0–1 coords. y=0 = top of frame.
  // Return { phase, counted, cue }
  const angle = angleBetween3D(kp[23], kp[25], kp[27]); // hip→knee→ankle
  if (isNaN(angle)) return { phase, counted: false, cue: "Show full body" };
  if (phase === 'up'   && angle < 100) return { phase: 'down', counted: false, cue: "Deeper!" };
  if (phase === 'down' && angle > 160) return { phase: 'up',   counted: true,  cue: "Drive up!" };
  return { phase, counted: false, cue: "Keep going" };
}
```

Add `"<name>"` to `public/movements/index.json`.

---

## MOJON COMP ERGS

Live race dashboard for rowing machine competitions using ANT+ protocol.

**Features**
- Real-time leaderboard: distance, watts, SPM, pace, finish order
- ANT+ USB stick support (Garmin Stick2 / Stick3) — auto-detects FE-C devices (Concept2 PM5, etc.)
- Demo simulation mode — no hardware needed to test
- Admin panel: add/remove participants, link ANT+ device IDs, start/pause/reset race
- WebSocket push to all connected browsers (zero polling)

### ANT+ Setup (Windows)

ANT+ requires the WinUSB driver (one-time setup):

1. Download [Zadig](https://zadig.akeo.ie)
2. Plug in your ANT+ USB stick
3. Options → List All Devices → select your ANT device
4. Choose **WinUSB** → click **Replace Driver**
5. Run `node server.js` as Administrator

If the stick isn't available the server still runs — use **Admin → Add Demo rower** to simulate participants.

### Race flow

1. Open `admin.html` → add participants, link each to an ANT+ device ID
2. Set target distance (default 2000 m)
3. Click **Start Race**
4. Display `competition.html` on a large screen — it auto-updates via WebSocket

---

## Project Structure

```
MOJON_COMP_ERGS/
├── public/
│   ├── index.html              ← MOJON Workout Tracker (main entry)
│   ├── competition.html        ← ERG Live Race Dashboard
│   ├── admin.html              ← ERG Admin Panel
│   ├── script.js               ← Workout tracker app logic
│   ├── workout_engine.js       ← EMOM / AMRAP / FOR TIME rep-counting engines
│   ├── limbSegments.js         ← MediaPipe landmark → limb definitions
│   ├── style.css               ← All workout tracker styles
│   ├── logo.png
│   ├── movements/              ← One JS file per exercise + index.json
│   ├── utils/
│   │   ├── history.js          ← localStorage session persistence
│   │   ├── quaternion.js       ← Quaternion class + joint angle math
│   │   └── stats.js            ← Statistical helpers
│   └── models/                 ← (gitignored) MediaPipe .task model files
├── server.js                   ← Express + WebSocket + ANT+ server
├── package.json
├── LICENSE
└── README.md
```

---

## Live Demo

[**ignitx-labs.github.io/MOJON_COMP_ERGS**](https://ignitx-labs.github.io/MOJON_COMP_ERGS/) — workout tracker runs fully in-browser. ERG live features require the Node.js server locally.

---

## License

MIT — see [LICENSE](LICENSE).

Built by **Ignite Strategies LLC** · [Ignitx Labs](https://github.com/Ignitx-Labs)
