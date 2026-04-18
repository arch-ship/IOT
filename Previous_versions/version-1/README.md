# 🌸 Bloom Wellness — Version 1 (MVP)

> The original single-file prototype. Everything in one `index.html`.

---

## 📌 What this version is

Version 1 is the **minimum viable product** — the very first working build of Bloom Wellness. It proved the concept: a full wellness tracker that runs entirely in a mobile browser with zero installation.

This version was deliberately kept as one self-contained file (`index.html`) with all HTML, CSS, and JavaScript inline. No external dependencies except Google Fonts.

---

## 📂 Files

| File | Description |
|---|---|
| `index.html` | Entire app — HTML structure, inline `<style>`, inline `<script>` |
| `README.md` | This file |

---

## ✅ What works in v1

- **Onboarding** — name input, permission guidance
- **Home page** — quote, doctor tip, 4-stat grid, progress bars, streak
- **Steps page** — accelerometer step counter with basic cadence filter, circular ring, goal setter
- **Water page** — 8-glass tap interface, SVG arc progress, hydration schedule
- **Diet page** — calorie banner, macro bars, meal log with add/delete, editable doctor's plan
- **Schedule page** — daily wellness timeline, editable items, reminder toggles
- **Progress page** — weight log, BMI calculator, achievements, Dr. Priya message
- **Notifications** — water, step, meal reminders via Web Notifications API
- **Service worker** — registered as a blob URL (inline in HTML), keeps alive with periodic pings
- **localStorage persistence** — all data saved under key `bloom_v4`
- **Daily reset** — steps and water reset automatically at midnight

---

## ❌ What's NOT in v1

- No sensors tab
- No GPS tracking
- No heart rate monitor
- No battery / ambient light / network speed
- No biometric lock
- No separate CSS or JS files
- Single-stage step filter (more susceptible to vehicle vibrations)

---

## 🏗 Architecture

```
index.html
├── <style>        — All CSS (~700 lines inline)
├── <body>
│   ├── #onboard   — Name input + permission info
│   └── .shell
│       ├── .hdr   — Header with name greeting
│       ├── .nav   — Horizontal pill navigation
│       └── .pages — 6 page divs (home/steps/water/diet/schedule/progress)
└── <script>       — All JS (~600 lines inline)
    ├── State management (localStorage)
    ├── Step counter (single IIR filter)
    ├── Water tracker
    ├── Meal logger
    ├── Schedule editor
    ├── Progress tracker
    └── Notification system
```

---

## 🔍 Step Algorithm in v1

```
Raw accelerometer magnitude
  → Rolling mean subtraction (gravity removal, α=0.95)
  → Zero-crossing peak detection (threshold 1.8 m/s²)
  → Basic cadence check: interval in [280, 820] ms
  → 2 consecutive valid peaks required (low bar — susceptible to car vibrations)
```

> This was improved significantly in v2 and later versions.

---

## 🚀 How to Run

Simply open `index.html` in any modern mobile browser. No server needed.

---

*This version is archived for historical reference. For the full-featured app, see [Latest_Version](../../Latest_Version/).*
