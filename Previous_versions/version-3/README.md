# 🌸 Bloom Wellness — Version 3

> Added real-time network speed monitoring to the Sensors tab.

---

## 📌 What changed from v2

Version 3 adds one significant new sensor: a **live download speed monitor** powered by Cloudflare's speed test endpoint. This is a purely additive update — nothing from v2 was removed or broken.

The changes touch exactly 3 files: `sensors.js`, `app.js`, and `index.html`. The other 3 files (`auth.js`, `styles.css`, `sw.js`) are identical to v2.

---

## 📂 Files

| File | Changed from v2? | Description |
|---|---|---|
| `index.html` | ✅ Yes | New network speed card added to sensors page |
| `styles.css` | ❌ No | Unchanged |
| `app.js` | ✅ Yes | `toggleNetSpeed()`, `updateNetSpeedUI()`, `window.onNetSpeedUpdate` callback |
| `sensors.js` | ✅ Yes | `startNetSpeed()`, `stopNetSpeed()`, `getNetSpeedState()`, Cloudflare fetch logic |
| `auth.js` | ❌ No | Unchanged |
| `sw.js` | ❌ No | Unchanged |

---

## 🆕 New in v3: Real-Time Network Speed Monitor

### How it works

```
User taps "Start"
  → startNetSpeed() in sensors.js
  → Fetches 50,000 bytes from speed.cloudflare.com/__down?bytes=50000
     (CORS-open endpoint — no auth, no setup, works on every mobile browser)
  → Measures: (50,000 × 8 bits) / (elapsed_seconds × 1,000,000) = Mbps
  → Fires window.onNetSpeedUpdate(mbps, history)
  → app.js updateNetSpeedUI() updates the display
  → Repeats every 5 seconds
  → Auto-stops when user navigates away from Sensors tab (saves mobile data)
```

### Fallback
If the Cloudflare fetch fails (offline or firewall), it falls back to `navigator.connection.downlink` — the browser's own connection speed estimate (less accurate but always available).

### UI elements added to index.html

```html
📡 Real-Time Network Speed card
├── Big Mbps number (64px Fraunces serif, colour-coded)
│     🔴 < 1 Mbps   — Slow
│     🟡 1–5 Mbps   — Moderate
│     🟢 5–20 Mbps  — Good
│     ⚡ 20–50 Mbps — Fast
│     🚀 > 50 Mbps  — Very Fast
├── Connection info grid (connection type · ping RTT · data saver)
├── Speed history bar chart (last 10 readings, colour-coded bars)
├── "How it works" info box
└── Status line (last reading time, auto-refresh interval)
```

### New functions in sensors.js

```javascript
startNetSpeed()        // begins monitoring — first reading fires immediately
stopNetSpeed()         // clears interval, resets state
getNetSpeedState()     // returns { on, testing, currentMbps, history }
netSpeedIsOn()         // boolean shorthand
```

### New functions in app.js

```javascript
window.onNetSpeedUpdate(mbps, history)  // callback fired by sensors.js
toggleNetSpeed()                         // start/stop from UI button
updateNetSpeedUI(mbps, history)          // updates all display elements
```

### goPage() update in app.js

```javascript
// Auto-stop speed monitor when leaving sensors tab
if (name !== 'sensors' && BloomSensors.netSpeedIsOn()) {
  BloomSensors.stopNetSpeed();
}
```

---

## 🚀 How to Run

Put all 6 files in the same folder. Open `index.html` in any modern mobile browser.

The network speed test requires an active internet connection. It will NOT work completely offline (falls back to navigator.connection estimate).

---

*Previous: [version-2](../version-2/) · Next: [version-4](../version-4/) · Latest: [Latest_Version](../../Latest_Version/)*
