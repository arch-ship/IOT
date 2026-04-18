# 🌸 Bloom Wellness — Latest Version (v4)

This is the **current, fully-featured version** of Bloom Wellness. Use this folder for the best experience.

---

## 📂 Files in this Folder

| File | Size | Purpose |
|---|---|---|
| `index.html` | ~30 KB | HTML shell — all pages, navigation, sensor cards, biometric lock screen |
| `styles.css` | ~35 KB | Complete dark-purple theme, responsive layout, all component styles |
| `app.js` | ~49 KB | App state, UI rendering, all user interactions, sensor callbacks |
| `sensors.js` | ~24 KB | Step counter, GPS, heart rate, battery, ambient light, network speed |
| `auth.js` | ~5 KB | WebAuthn biometric authentication (fingerprint / Face ID) |
| `sw.js` | ~1.4 KB | Service worker — background notifications, keep-alive pings |

**All 6 files must be in the same folder to work.**

---

## 🚀 How to Run

### On your phone (recommended)
```
1. Download this folder to your phone
2. Open index.html in Chrome (Android) or Safari (iOS)
3. Grant permissions when asked (motion, location, notifications)
4. Enter your name → tap "Let's Bloom!"
```

### On your computer (for testing)
```
1. Open index.html in any modern browser
   OR
   Run a local server: python -m http.server 8080
   Then open: http://localhost:8080
```

> ⚠️ Some sensor features (step counter, heart rate) require a physical mobile device. They cannot be tested in browser DevTools device emulation because no real sensors are available.

---

## 🧭 App Pages

### 🏠 Home
- Daily greeting with random wellness quote
- Dr. Priya Sharma's tip of the day
- 4-stat dashboard (steps, water, calories, burned)
- Today's goals progress bars
- 7-day streak tracker

### 👟 Steps
- Real-time step counting via accelerometer
- **Vehicle vibration filter** — dual-stage IIR algorithm (high-pass + low-pass) eliminates car/bus false steps
- Circular progress ring with gradient
- Set custom daily goal
- Calories burned + estimated distance

### 💧 Water
- 8-glass tap-to-fill interface (250ml per glass)
- Circular SVG progress arc
- Hydration schedule with priority tags
- Auto water reminders every 2 hours

### 🥗 Diet
- Calorie banner (Consumed / Goal / Remaining)
- Macro tracking bars (Carbs / Protein / Fat / Fiber)
- Full meal log with emoji, time, delete
- Editable Doctor's Meal Plan (add / edit / delete)

### 🗓 Schedule
- Full daily wellness timeline (13 default activities)
- Tap checkboxes to mark activities done
- Add, edit, delete any schedule item
- Smart reminders toggle (water · steps · meals)

### 📡 Sensors
- **📍 GPS Route Tracking** — real distance, pace (min/km), duration
- **💓 Heart Rate** — camera rPPG (finger over rear camera + torch)
- **🔄 Motion Quality** — walking confidence score with history bar
- **🔋 Battery** — level, charging status, wellness tips
- **☀️ Ambient Light** — lux reading with eye health advice
- **📡 Network Speed** — real-time Mbps download via Cloudflare endpoint, 10-reading history chart, auto-stops when leaving tab
- **📶 Network & Device** — connection type, RTT, data saver status
- **🔐 Biometric Lock** — fingerprint / Face ID toggle (WebAuthn)

### 📈 Progress
- Weight log (up to 7 entries with trend arrows)
- BMI calculator with colour-coded scale bar
- 9 achievements (earned/locked with visual states)
- Motivational message from Dr. Priya

---

## 🔑 Key Technical Details

### Step Counter Algorithm
```
Raw accelerometer signal
  → Stage 1: High-pass IIR filter (β=0.90) — removes gravity & slow car sway
  → Stage 2: Low-pass IIR filter (α=0.25) — removes engine vibrations >6 Hz
  → Peak detection on filtered signal (threshold: 1.8 m/s²)
  → Cadence validation: 5 consecutive intervals in [290, 820] ms
  → Standard deviation check: σ < 80 ms (walking is rhythmic; car bumps aren't)
```

### Network Speed Monitor
- Downloads 50 KB from `speed.cloudflare.com` (CORS-open endpoint)
- Measures: `(50,000 bytes × 8 bits) / (elapsed_ms / 1000) / 1,000,000` = Mbps
- Falls back to `navigator.connection.downlink` if fetch fails
- Updates every 5 seconds while active

### Biometric Lock
- Uses **Web Authentication API (WebAuthn)** — built into every modern mobile browser
- `authenticatorAttachment: 'platform'` → uses device's own sensor (not USB keys)
- On Android Chrome → fingerprint scanner
- On iOS Safari → Touch ID or Face ID
- Biometric data never leaves device hardware

### Data Storage
- All data in `localStorage` under key `bloom_v5`
- Automatic daily reset (steps, water, meals, schedule done-states) at midnight

---

## 🐛 Known Limitations

- Heart rate (camera rPPG) works best with rear camera; front camera may give inaccurate results
- Ambient Light Sensor requires `chrome://flags/#enable-generic-sensor-extra-classes` on some Android Chrome versions
- Biometric lock requires the domain to match (works on `localhost` and any real domain; does NOT work from `file://` path on Android)
- Step counting on iOS requires the user to tap "Enable" on the Steps page each session (iOS motion permission is session-based)

---

## 📝 Changelog from v3

- Fixed duplicate `.bm` CSS class conflict (button vs badge now scoped correctly)
- Improved layout clipping on small screens (< 360px width)
- Network speed card auto-stops when navigating away (saves mobile data)
- Step confidence display added to Steps page header

---

*Part of the Bloom Wellness project — [see root README for full overview](../README.md)*
