# 🌸 Bloom Wellness — Version 4

> Bug fixes, responsiveness improvements, and final polish. This version became the base for Latest_Version.

---

## 📌 What changed from v3

Version 4 is a **polish and bugfix release**. No new features were added — the focus was on fixing a CSS class conflict, improving layout behaviour on small screens, and general cleanup. All 6 files were updated.

---

## 📂 Files

| File | Changed from v3? | What changed |
|---|---|---|
| `index.html` | ✅ Yes | Onboarding sensor list updated, `bsk` button class on water Complete button |
| `styles.css` | ✅ Yes | **Fixed `.bm` duplicate bug** · Added `.bsk` button class · Sensor card cleanup |
| `app.js` | ✅ Yes | Step confidence badge added to Steps page header · Minor state fixes |
| `sensors.js` | ✅ Yes | `netSpeedIsOn()` exported in public API |
| `auth.js` | ✅ Yes | No logic changes — minor comment cleanup |
| `sw.js` | ❌ No | Unchanged |

---

## 🐛 Bug Fixed: Duplicate `.bm` CSS Class

The most important fix in v4.

In v3, `styles.css` had two conflicting definitions for `.bm`:

```css
/* Line ~855 — button style (gradient mint) */
.bm { background: linear-gradient(135deg, var(--mint), #059669); color: #0a2a18; }

/* Line ~991 — badge style (transparent mint) */
.bm { background: rgba(52,211,153,.13); color: var(--mint); }
```

The second definition silently overrode the first because CSS applies the last matching rule. This meant the GPS "Start GPS" button (which uses `.btn.bm`) was rendering with the transparent badge background instead of the solid mint gradient button — making it nearly invisible against the card background.

**Fix:** Scoped the badge version to `.badge.bm` instead of `.bm`:

```css
/* Button — unchanged, still solid mint gradient */
.bm { background: linear-gradient(135deg, var(--mint), #059669); color: #0a2a18; }

/* Badge — now scoped, only applies when .badge is also present */
.badge.bm { background: rgba(52,211,153,.13); color: var(--mint); }
```

Now:
- `.btn.bm` (GPS button) → solid mint gradient ✅
- `.badge.bm` (water page "Priority" tag) → transparent mint badge ✅

---

## 📱 Responsiveness Improvements

The original layout used `position: fixed` + `height: 100%` + `overflow: hidden` which prevents the native browser scroll and keeps everything within the viewport. This is intentional — it gives the native-app feel.

In v4, edge cases were addressed:

- Sensor cards no longer overflow horizontally on screens narrower than 360px
- The network speed bar chart is now `flex-wrap: nowrap` with min-bar-width so bars don't collapse on small screens
- Modal bottom sheet height capped correctly on short screens (< 568px height)
- The nav pill row horizontal scroll works correctly on all screen widths

---

## ✅ Other Small Changes

| Change | File |
|---|---|
| Step confidence shown as badge in Steps page hero | `app.js`, `index.html` |
| Onboarding sensor list now mentions all 6 sensor types | `index.html` |
| Water "Complete 🎉" button uses `.bsk` class for sky blue | `index.html`, `styles.css` |
| `netSpeedIsOn()` properly exported from `BloomSensors` public API | `sensors.js` |
| `goPage()` auto-stops speed test on tab switch | `app.js` |

---

## 🚀 How to Run

Put all 6 files in the same folder. Open `index.html` in Chrome (Android) or Safari (iOS 14+).

This is the version that became `Latest_Version` with only minor README and metadata differences.

---

*Previous: [version-3](../version-3/) · Latest: [Latest_Version](../../Latest_Version/)*
