# 🌸 Bloom Wellness

> A personal wellness companion — built entirely with vanilla HTML, CSS, and JavaScript. No frameworks, no installs. Just open it in your mobile browser and it works.

![Bloom Wellness App](https://img.shields.io/badge/Platform-Mobile%20Browser-a855f7?style=for-the-badge)
![Language](https://img.shields.io/badge/Language-Vanilla%20JS-fbbf24?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-34d399?style=for-the-badge)
![Version](https://img.shields.io/badge/Latest-v4.0-ff6b9d?style=for-the-badge)

---

## 📖 What is Bloom?

Bloom is a full-featured mobile wellness tracking app that runs entirely in your phone's browser — no app store, no installation, no account required. It tracks your steps, water intake, meals, weight, and much more, all stored privately on your own device.

---

## ✨ Features at a Glance

| Feature | Description |
|---|---|
| 👟 **Step Counter** | Real-time accelerometer step counting with vehicle vibration filter (dual-stage IIR algorithm) |
| 💧 **Water Tracker** | 8-glass daily hydration tracker with visual tap-to-fill interface |
| 🥗 **Diet Logger** | Meal log with macro tracking (carbs, protein, fat, fiber) + doctor's meal plan |
| 🗓 **Daily Schedule** | Editable wellness timeline with checkboxes and smart reminders |
| 📡 **Sensors Page** | GPS route tracking, camera heart rate (rPPG), gyroscope, battery monitor, ambient light, real-time network speed |
| 🔐 **Biometric Lock** | Fingerprint / Face ID app lock using WebAuthn — works in normal mobile browser |
| 📈 **Progress** | Weight log, BMI calculator, achievements system, 7-day streak tracker |
| 🔔 **Notifications** | Background water, step, and meal reminders via Web Notifications API |

---

## 📁 Repository Structure

```
arch-ship/
│
├── 📂 Latest_Version/          ← Use this — always the most up-to-date build
│   ├── index.html              Main HTML shell
│   ├── styles.css              All styling (dark purple wellness theme)
│   ├── app.js                  Core app logic, state management, UI
│   ├── sensors.js              All sensor code (steps, GPS, HR, battery, network)
│   ├── auth.js                 WebAuthn biometric authentication
│   ├── sw.js                   Service worker (background notifications)
│   └── README.md               Full feature list and usage guide
│
├── 📂 Previous_versions/       ← Development history
│   ├── version-1/              Single-file MVP (index.html only)
│   ├── version-2/              Multi-file split + sensors + biometric
│   ├── version-3/              + Real-time network speed monitor
│   └── version-4/              + Responsiveness fixes, .bm class bug fix
│
└── README.md                   ← You are here
```

---

## 🚀 Quick Start

**Zero setup required.**

1. Download the `Latest_Version` folder
2. Put all 6 files in the same folder on your phone or computer
3. Open `index.html` in Chrome (Android) or Safari (iOS)
4. Enter your name and tap **Let's Bloom!**

> **Works on:** Android Chrome · iOS Safari · Desktop Chrome · Firefox · Edge

---

## 🛠 Tech Stack

- **100% Vanilla** — HTML5, CSS3, plain JavaScript (ES2022)
- **No frameworks** — no React, no Vue, no Node.js, no build step
- **Storage** — `localStorage` (everything stays on your device)
- **Sensors** — `DeviceMotionEvent`, Geolocation API, Camera API, Battery API, WebAuthn
- **Background** — Service Worker for notifications and background step counting

---

## 📱 Browser Compatibility

| Browser | Steps | GPS | Heart Rate | Biometric | Notifications |
|---|---|---|---|---|---|
| Android Chrome | ✅ | ✅ | ✅ | ✅ Fingerprint | ✅ |
| iOS Safari 14+ | ✅ | ✅ | ✅ | ✅ Face ID / Touch ID | ✅ |
| Desktop Chrome | ✅ (limited) | ✅ | ✅ | ✅ Windows Hello | ✅ |
| Firefox | ✅ | ✅ | ⚠️ Partial | ⚠️ Partial | ✅ |

---

## 🔒 Privacy

- **All data stays on your device** — nothing is sent to any server
- The only external network calls are:
  - Google Fonts (loading fonts)
  - Cloudflare speed test endpoint (only when you tap "Start" in Network Speed monitor)
- Biometric credentials are stored in your device's secure hardware — Bloom never sees your fingerprint

---

## 📌 Version History

| Version | Key Addition |
|---|---|
| v1 | Single-file MVP — steps, water, diet, schedule, progress |
| v2 | Split into 6 files · Added sensors tab · Biometric lock · GPS · Heart rate |
| v3 | Real-time network speed monitor (Cloudflare rPPG) |
| v4 | Responsiveness fixes · Duplicate CSS class bug fix · Final polish |

---

## 👩‍💻 Author

Built with 💜 — a personal wellness project.

---

*Keep blooming! 🌸*
