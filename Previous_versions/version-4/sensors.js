// ═══════════════════════════════════════════════════════════════
// BLOOM WELLNESS — Sensor Management Module v3
// ═══════════════════════════════════════════════════════════════
// Sensors handled:
//   1. Accelerometer  → Step counter (dual-IIR, vehicle-resistant, FIXED)
//   2. Gyroscope       → Step confidence fusion
//   3. GPS             → Walk route & accurate distance
//   4. Battery Status  → Wellness tips
//   5. Ambient Light   → Eye health alerts
//   6. Camera rPPG     → Heart rate estimation
//   7. Vibration       → Haptic feedback
//   8. Network Speed   → Real-time Mbps via Cloudflare
// ═══════════════════════════════════════════════════════════════

const BloomSensors = (() => {

  // ─────────────────────────────────────────────────────────────
  // STEP COUNTER — FIXED ALGORITHM
  // ─────────────────────────────────────────────────────────────
  //
  // Two-stage IIR filter cascade:
  //   Stage 1 HIGH-PASS  y[n] = β*(y[n-1] + x[n] - x[n-1])   β=0.90
  //     → removes gravity DC (~9.81 m/s²) and slow car sway (<0.5 Hz)
  //   Stage 2 LOW-PASS   y[n] = α*x[n] + (1-α)*y[n-1]         α=0.50
  //     → removes high-freq engine vibrations (>~8 Hz)
  //     → α=0.50 preserves walking signal amplitude (was 0.25, too aggressive)
  //
  // Peak detection — UPWARD THRESHOLD CROSSING:
  //   Fires when filtered signal rises FROM below PEAK_THRESH TO above it.
  //
  //   ❌ OLD BUG (zero-crossing + amplitude check):
  //      isPeak = (prevLp < 0 && lp >= 0 && lp > 1.8)
  //      At zero-crossing lp ≈ 0. So lp > 1.8 can NEVER be true
  //      at that instant. isPeak was ALWAYS false. Zero steps counted.
  //
  //   ✅ FIX (upward threshold crossing):
  //      isPeak = (prevLp < PEAK_THRESH && lp >= PEAK_THRESH)
  //      Each step pushes lp above 0.5 exactly once — one detection per step.
  //
  // Cadence validation:
  //   - Collect last 4 inter-peak intervals
  //   - Require interval in [250, 1500] ms (0.67–4 steps/sec)
  //   - Require σ(intervals) < 200 ms (walking is rhythmic)
  //   - Require 2 consecutive valid intervals before counting starts
  //   - Gyroscope fusion: walking swings body → adds +1 confidence
  // ─────────────────────────────────────────────────────────────

  const STEP = {
    MIN_INTERVAL:   250,    // ms — max ~4 steps/sec
    MAX_INTERVAL:   1500,   // ms — min ~0.7 steps/sec (very slow stroll)
    PEAK_THRESH:    0.5,    // m/s² — correct for post dual-IIR amplitude (0.3–1.5 m/s²)
    CONFIRM_COUNT:  2,      // consecutive valid intervals before counting
    MAX_STD_DEV:    200,    // ms — natural walking variance is 80–150 ms
    CONFIDENCE_MAX: 4,      // max confidence score
    HP_BETA:        0.90,   // high-pass IIR coefficient
    LP_ALPHA:       0.50,   // low-pass IIR coefficient (was 0.25 — kills signal)
  };

  let stepState = {
    on:            false,
    motionHandler: null,
    // Filter state
    rawPrev:       0,
    hpPrev:        0,
    lpPrev:        0,
    // Peak detection
    prevLp:        0,
    lastPeakMs:    0,
    // Cadence validation
    intervals:     [],
    confidence:    0,
    // Gyro fusion
    gyroY:         0,
  };

  function processMotion(e) {
    const ag = e.accelerationIncludingGravity;
    if (!ag) return;
    const x = ag.x || 0, y = ag.y || 0, z = ag.z || 0;
    const raw = Math.sqrt(x * x + y * y + z * z);

    // ── Stage 1: High-pass filter ─────────────────────────────
    const hp = STEP.HP_BETA * (stepState.hpPrev + raw - stepState.rawPrev);
    stepState.rawPrev = raw;
    stepState.hpPrev  = hp;

    // ── Stage 2: Low-pass filter ──────────────────────────────
    const lp = STEP.LP_ALPHA * hp + (1 - STEP.LP_ALPHA) * stepState.lpPrev;
    stepState.lpPrev = lp;

    const now = Date.now();

    // ── Peak detection: UPWARD THRESHOLD CROSSING ─────────────
    // Fires the moment lp rises from below PEAK_THRESH to above it.
    // This is the critical fix — the old zero-crossing code was broken.
    const isPeak = (stepState.prevLp < STEP.PEAK_THRESH && lp >= STEP.PEAK_THRESH);
    stepState.prevLp = lp;

    if (!isPeak) return;

    const dt = now - stepState.lastPeakMs;

    // ── Cadence validation ────────────────────────────────────
    if (dt >= STEP.MIN_INTERVAL && dt <= STEP.MAX_INTERVAL) {
      stepState.intervals.push(dt);
      if (stepState.intervals.length > 4) stepState.intervals.shift();
      stepState.lastPeakMs = now;

      if (stepState.intervals.length >= STEP.CONFIRM_COUNT) {
        const mean     = stepState.intervals.reduce((a, b) => a + b, 0) / stepState.intervals.length;
        const variance = stepState.intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / stepState.intervals.length;
        const stdDev   = Math.sqrt(variance);

        if (stdDev < STEP.MAX_STD_DEV) {
          // Consistent cadence = walking ✅
          const gyroBonus = stepState.gyroY > 0.15 ? 1 : 0;
          stepState.confidence = Math.min(STEP.CONFIDENCE_MAX, stepState.confidence + 1 + gyroBonus);

          if (stepState.confidence >= STEP.CONFIRM_COUNT) {
            // ✅ COUNT THE STEP
            if (typeof window.onSensorStep === 'function') window.onSensorStep();
            // Also notify SW for background tracking
            _notifySWStep();
          }
        } else {
          // Erratic cadence — car bump or vibration
          stepState.confidence = Math.max(0, stepState.confidence - 2);
          if (stepState.confidence === 0) stepState.intervals = [];
        }
      }

    } else if (dt > STEP.MAX_INTERVAL) {
      // Normal pause (stopped at lights, etc.) — reset buffer
      stepState.intervals    = [];
      stepState.lastPeakMs   = now;
      stepState.confidence   = Math.max(0, stepState.confidence - 1);

    } else {
      // Too fast (<250ms) — engine vibration, hard reset
      stepState.confidence = Math.max(0, stepState.confidence - 3);
      if (stepState.confidence === 0) stepState.intervals = [];
    }
  }

  // Gyroscope fusion — part of DeviceMotionEvent
  function processGyro(e) {
    if (!e.rotationRate) return;
    const gamma = Math.abs(e.rotationRate.gamma || 0);
    const beta  = Math.abs(e.rotationRate.beta  || 0);
    stepState.gyroY = Math.max(gamma, beta) * (Math.PI / 180);
  }

  // ── Notify SW of each step (for background tracking) ─────────
  function _notifySWStep() {
    try {
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'STEP' });
      }
    } catch (e) {}
  }

  async function startSteps() {
    if (stepState.on) return { ok: false, msg: 'Already running' };

    // iOS 13+ needs explicit permission
    if (typeof DeviceMotionEvent !== 'undefined' &&
        typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const perm = await DeviceMotionEvent.requestPermission();
        if (perm !== 'granted') return { ok: false, msg: 'Permission denied' };
      } catch (e) {
        return { ok: false, msg: 'Permission error: ' + e.message };
      }
    } else if (typeof DeviceMotionEvent === 'undefined') {
      return { ok: false, msg: 'Motion sensor not available on this device' };
    }

    // Reset filter state
    Object.assign(stepState, {
      rawPrev: 0, hpPrev: 0, lpPrev: 0, prevLp: 0,
      lastPeakMs: 0, intervals: [], confidence: 0, gyroY: 0,
    });

    stepState.motionHandler = (e) => {
      processMotion(e);
      processGyro(e);
    };

    window.addEventListener('devicemotion', stepState.motionHandler, { passive: true });
    stepState.on = true;

    return { ok: true };
  }

  function stopSteps() {
    if (stepState.motionHandler) {
      window.removeEventListener('devicemotion', stepState.motionHandler);
    }
    stepState.on         = false;
    stepState.confidence = 0;
    stepState.intervals  = [];
  }

  function getStepConfidence() {
    return Math.round((stepState.confidence / STEP.CONFIDENCE_MAX) * 100);
  }

  // ── GPS / Location Tracking ───────────────────────────────────
  let gpsState = {
    on:             false,
    watchId:        null,
    positions:      [],
    totalDistanceM: 0,
    lastPos:        null,
    startTime:      null,
  };

  function haversineM(lat1, lon1, lat2, lon2) {
    const R    = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a    = Math.sin(dLat / 2) ** 2 +
                 Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                 Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async function startGPS() {
    if (gpsState.on) return { ok: false, msg: 'Already running' };
    if (!navigator.geolocation) return { ok: false, msg: 'Geolocation not supported' };

    gpsState.totalDistanceM = 0;
    gpsState.lastPos        = null;
    gpsState.startTime      = Date.now();
    gpsState.positions      = [];

    return new Promise(resolve => {
      gpsState.watchId = navigator.geolocation.watchPosition(
        pos => {
          const { latitude: lat, longitude: lon, accuracy } = pos.coords;
          if (accuracy > 50) return; // ignore low-accuracy fixes

          if (gpsState.lastPos) {
            const dist = haversineM(gpsState.lastPos.lat, gpsState.lastPos.lon, lat, lon);
            // Filter: ignore if < 2m (noise) or > 200m (teleport)
            if (dist >= 2 && dist < 200) {
              gpsState.totalDistanceM += dist;
            }
          }
          gpsState.lastPos = { lat, lon };
          gpsState.positions.push({ lat, lon, t: Date.now() });

          if (!gpsState.on) { gpsState.on = true; resolve({ ok: true }); }

          if (typeof window.onGPSUpdate === 'function') {
            const km         = (gpsState.totalDistanceM / 1000).toFixed(2);
            const elapsedMin = Math.round((Date.now() - gpsState.startTime) / 60000);
            const pace       = (gpsState.totalDistanceM > 100 && elapsedMin > 0)
              ? (elapsedMin / (gpsState.totalDistanceM / 1000)).toFixed(1) + ' min/km'
              : '—';
            window.onGPSUpdate({ km, pace, elapsedMin });
          }
        },
        err => {
          if (!gpsState.on) resolve({ ok: false, msg: err.message });
        },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
      );
      // Timeout if no fix in 10 seconds
      setTimeout(() => { if (!gpsState.on) resolve({ ok: false, msg: 'GPS timeout — are you outdoors?' }); }, 11000);
    });
  }

  function stopGPS() {
    if (gpsState.watchId !== null) navigator.geolocation.clearWatch(gpsState.watchId);
    gpsState.on      = false;
    gpsState.watchId = null;
  }

  function resetGPS() {
    stopGPS();
    gpsState.totalDistanceM = 0;
    gpsState.lastPos        = null;
    gpsState.startTime      = null;
    gpsState.positions      = [];
  }

  function getGPSData() {
    return {
      km:         (gpsState.totalDistanceM / 1000).toFixed(2),
      elapsedMin: gpsState.startTime
        ? Math.round((Date.now() - gpsState.startTime) / 60000)
        : 0,
    };
  }

  // ── Battery ───────────────────────────────────────────────────
  let batteryState = { supported: false, level: 0, charging: false };

  async function initBattery() {
    if (!navigator.getBattery) {
      batteryState.supported = false;
      return;
    }
    try {
      const bat = await navigator.getBattery();
      const update = () => {
        batteryState = {
          supported: true,
          level:     Math.round(bat.level * 100),
          charging:  bat.charging,
        };
        if (typeof window.onBatteryUpdate === 'function') window.onBatteryUpdate(batteryState);
      };
      update();
      bat.addEventListener('levelchange',   update);
      bat.addEventListener('chargingchange', update);
    } catch (e) {
      batteryState.supported = false;
    }
  }

  // ── Ambient Light ─────────────────────────────────────────────
  let lightState = { supported: false, level: 0 };

  function initAmbientLight() {
    if (!('AmbientLightSensor' in window)) {
      lightState.supported = false;
      if (typeof window.onLightUpdate === 'function')
        window.onLightUpdate({ supported: false, level: 0 });
      return;
    }
    try {
      const sensor = new AmbientLightSensor();
      sensor.addEventListener('reading', () => {
        lightState = { supported: true, level: Math.round(sensor.illuminance) };
        if (typeof window.onLightUpdate === 'function') window.onLightUpdate(lightState);
      });
      sensor.addEventListener('error', () => { lightState.supported = false; });
      sensor.start();
    } catch (e) {
      lightState.supported = false;
    }
  }

  function getLightAdvice(lux) {
    if (lux < 50)   return { emoji: '🌙', text: 'Very dim — rest your eyes, avoid screens' };
    if (lux < 200)  return { emoji: '🕯️', text: 'Low light — consider a reading lamp' };
    if (lux < 1000) return { emoji: '✅', text: 'Good indoor lighting' };
    if (lux < 5000) return { emoji: '🌤', text: 'Bright indoor or overcast outdoor' };
    return             { emoji: '☀️', text: 'Bright sunlight — protect your eyes' };
  }

  // ── Heart Rate (Camera rPPG) ───────────────────────────────────
  let hrState = {
    on:         false,
    stream:     null,
    video:      null,
    canvas:     null,
    ctx:        null,
    intervalId: null,
    samples:    [],
    bpm:        0,
    quality:    0,
  };

  async function startHeartRate() {
    if (hrState.on) return { ok: false, msg: 'Already running' };
    if (!navigator.mediaDevices?.getUserMedia)
      return { ok: false, msg: 'Camera API not supported' };

    try {
      hrState.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 160, height: 120 },
      });
    } catch (e) {
      return { ok: false, msg: e.name === 'NotAllowedError'
        ? 'Camera permission denied — tap Allow'
        : 'Camera error: ' + e.message };
    }

    hrState.video  = document.createElement('video');
    hrState.canvas = document.createElement('canvas');
    hrState.ctx    = hrState.canvas.getContext('2d', { willReadFrequently: true });
    hrState.canvas.width  = 40;
    hrState.canvas.height = 30;
    hrState.video.srcObject = hrState.stream;
    hrState.video.playsInline = true;
    await hrState.video.play();
    hrState.on      = true;
    hrState.samples = [];
    hrState.bpm     = 0;

    hrState.intervalId = setInterval(() => {
      if (!hrState.on || !hrState.video) return;
      hrState.ctx.drawImage(hrState.video, 0, 0, 40, 30);
      const px    = hrState.ctx.getImageData(0, 0, 40, 30).data;
      let rSum = 0, count = 0;
      for (let i = 0; i < px.length; i += 4) { rSum += px[i]; count++; }
      const rAvg = rSum / count;
      hrState.samples.push({ r: rAvg, t: Date.now() });
      if (hrState.samples.length > 300) hrState.samples.shift();
      if (hrState.samples.length >= 150) calculateHR();
    }, 1000 / 30); // 30 fps

    return { ok: true };
  }

  function calculateHR() {
    const vals      = hrState.samples.map(s => s.r);
    const mean      = vals.reduce((a, b) => a + b, 0) / vals.length;
    const std       = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
    hrState.quality = Math.min(100, Math.round((std / 5) * 100));

    const threshold = mean + 0.3 * std;
    const peaks     = [];
    let prevV = vals[0];
    for (let i = 1; i < vals.length - 1; i++) {
      const v = vals[i];
      if (v > threshold && v >= vals[i - 1] && v >= vals[i + 1] && prevV < v) {
        const t = hrState.samples[i].t;
        if (peaks.length === 0 || t - peaks[peaks.length - 1] > 200)
          peaks.push(t);
      }
      prevV = v;
    }
    if (peaks.length >= 3) {
      const diffs      = [];
      for (let i = 1; i < peaks.length; i++) diffs.push(peaks[i] - peaks[i - 1]);
      const avgInterval = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      const bpm         = Math.round(60000 / avgInterval);
      if (bpm >= 40 && bpm <= 200) {
        hrState.bpm = bpm;
        if (typeof window.onHRUpdate === 'function')
          window.onHRUpdate({ bpm, quality: hrState.quality });
      }
    }
  }

  function stopHeartRate() {
    if (hrState.intervalId) { clearInterval(hrState.intervalId); hrState.intervalId = null; }
    if (hrState.stream) { hrState.stream.getTracks().forEach(t => t.stop()); hrState.stream = null; }
    if (hrState.video)  { hrState.video.srcObject = null; }
    hrState.on = false; hrState.samples = []; hrState.bpm = 0;
  }

  // ── Haptics ───────────────────────────────────────────────────
  function vibrate(pattern) { if ('vibrate' in navigator) navigator.vibrate(pattern || [100]); }
  function milestoneBuzz() { vibrate([150, 80, 150, 80, 300]); }
  function successBuzz()   { vibrate([100, 50, 100]); }
  function tapBuzz()       { vibrate([30]); }

  // ── Network Speed Monitor ─────────────────────────────────────
  const NET_TEST_URL   = 'https://speed.cloudflare.com/__down?bytes=50000';
  const NET_TEST_BYTES = 50000;

  const netState = {
    on:          false,
    testing:     false,
    intervalId:  null,
    currentMbps: null,
    history:     [],
  };

  async function _doSpeedTest() {
    if (netState.testing) return null;
    netState.testing = true;
    try {
      const t0   = performance.now();
      const resp = await fetch(NET_TEST_URL + '&_=' + Date.now(), { cache: 'no-store', mode: 'cors' });
      await resp.arrayBuffer();
      const secs = (performance.now() - t0) / 1000;
      netState.testing = false;
      return Math.round(((NET_TEST_BYTES * 8) / (secs * 1_000_000)) * 100) / 100;
    } catch (e) {
      netState.testing = false;
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      return (conn && conn.downlink) ? conn.downlink : null;
    }
  }

  async function startNetSpeed() {
    if (netState.on) return;
    netState.on      = true;
    netState.history = [];
    const tick = async () => {
      const mbps = await _doSpeedTest();
      if (mbps !== null) {
        netState.currentMbps = mbps;
        const label = mbps < 1 ? Math.round(mbps * 1000) + 'K' : mbps.toFixed(1) + 'M';
        netState.history.push({ mbps, label });
        if (netState.history.length > 10) netState.history.shift();
      }
      if (typeof window.onNetSpeedUpdate === 'function')
        window.onNetSpeedUpdate(mbps, [...netState.history]);
    };
    await tick();
    netState.intervalId = setInterval(tick, 5000);
  }

  function stopNetSpeed() {
    if (netState.intervalId) clearInterval(netState.intervalId);
    netState.on = false; netState.intervalId = null; netState.testing = false;
  }

  function getNetSpeedState() {
    return { on: netState.on, testing: netState.testing,
             currentMbps: netState.currentMbps, history: [...netState.history] };
  }

  // ── Network Info ──────────────────────────────────────────────
  function getNetworkInfo() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) return null;
    return { type: conn.effectiveType || conn.type || 'unknown',
             downlink: conn.downlink, saveData: conn.saveData };
  }

  // ── Screen Info ───────────────────────────────────────────────
  function getScreenInfo() {
    return { width: window.screen.width, height: window.screen.height,
             dpr: window.devicePixelRatio || 1,
             orientation: screen.orientation ? screen.orientation.type : 'unknown' };
  }

  // ── Public API ────────────────────────────────────────────────
  return {
    startSteps,
    stopSteps,
    stepIsOn:         () => stepState.on,
    getStepConfidence,
    startGPS,
    stopGPS,
    resetGPS,
    getGPSData,
    gpsIsOn:          () => gpsState.on,
    initBattery,
    getBattery:       () => batteryState,
    initAmbientLight,
    getLight:         () => lightState,
    getLightAdvice,
    startHeartRate,
    stopHeartRate,
    getHR:            () => ({ bpm: hrState.bpm, quality: hrState.quality, on: hrState.on }),
    vibrate,
    milestoneBuzz,
    successBuzz,
    tapBuzz,
    startNetSpeed,
    stopNetSpeed,
    getNetSpeedState,
    netSpeedIsOn:     () => netState.on,
    getNetworkInfo,
    getScreenInfo,
  };
})();
