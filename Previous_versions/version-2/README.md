# 🌸 Bloom Wellness — Version 2

> Major refactor: split into 6 files. Added sensors tab, biometric lock, GPS, heart rate, and a much better step algorithm.

---

## 📌 What changed from v1

Version 2 is the **first multi-file build**. The single giant `index.html` was split into six separate, maintainable files. Beyond the refactor, this version added an entirely new **Sensors** page with real hardware sensor access.

---

## 📂 Files

| File | Lines | Description |
|---|---|---|
| `index.html` | ~400 | HTML shell — links to external CSS and JS |
| `styles.css` | ~900 | All styling extracted from inline `<style>` + new sensor card styles |
| `app.js` | ~900 | Core logic extracted from inline `<script>` + sensor callbacks |
| `sensors.js` | ~450 | New — all sensor management in one dedicated module |
| `auth.js` | ~130 | New — WebAuthn biometric fingerprint / Face ID |
| `sw.js` | ~32 | New standalone file — service worker (was a blob URL in v1) |
| `README.md` | — | This file |

---

## 🆕 New in v2

### 📡 Sensors Tab (entire new page)
- **GPS Route Tracking** — real distance and pace using `navigator.geolocation.watchPosition`
- **Heart Rate Monitor (rPPG)** — rear camera + torch, red channel peak detection
- **Gyroscope** — live rotation display via `DeviceMotionEvent.rotationRate`
- **Battery Status** — level, charging state via `navigator.getBattery()`
- **Ambient Light** — lux reading via `AmbientLightSensor` API
- **Network & Device** — connection type, data saver, device type

### 🔐 Biometric App Lock
- Fingerprint / Face ID using **Web Authentication API (WebAuthn)**
- Uses `authenticatorAttachment: 'platform'` — device's own sensor only
- Lock screen shown on app open when enabled
- Toggle in Sensors page

### 👟 Improved Step Counter
Two-stage IIR filter cascade replacing v1's single rolling mean:

```
v1:  raw → single rolling mean → peak detect → basic cadence check
v2:  raw → high-pass IIR (β=0.90) → low-pass IIR (α=0.25) → peak detect
          → cadence buffer (5 consecutive intervals) → std-dev check (σ<80ms)
```

Car and bus vibrations are now **properly rejected**:
- Engine vibrations (>6 Hz) removed by low-pass filter
- Slow car acceleration (<0.5 Hz) removed by high-pass filter
- Road bumps rejected by cadence consistency check (they're sporadic, walking isn't)

### Other Additions
- Sensors nav pill added to header
- Biometric lock screen (`#bioLock`) before app loads
- Daily reset now also clears schedule done-states and water
- State key updated to `bloom_v5` (new fields: `biometricEnabled`, `biometricCredId`, `hrLog`)
- Heart rate log stored persistently (`hrLog` array in localStorage)

---

## 🏗 Architecture

```
index.html   ──links──▶  styles.css
             ──loads──▶  auth.js      (BloomAuth)
             ──loads──▶  sensors.js   (BloomSensors)
             ──loads──▶  app.js       (uses BloomAuth + BloomSensors)
sw.js        ──registered by app.js
```

Load order matters: `auth.js` → `sensors.js` → `app.js`

---

## 🚀 How to Run

Put all 6 files in the same folder. Open `index.html` in Chrome (Android) or Safari (iOS 14+).

---

*Previous: [version-1](../version-1/) · Next: [version-3](../version-3/) · Latest: [Latest_Version](../../Latest_Version/)*
