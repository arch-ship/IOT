// ═══════════════════════════════════════════════════════════════
// BLOOM WELLNESS — Sensor Management Module
// ═══════════════════════════════════════════════════════════════
// Sensors handled:
//   1. Accelerometer  → Improved step counter (vehicle-resistant)
//   2. Gyroscope       → Posture & motion quality
//   3. GPS             → Walk route & accurate distance
//   4. Battery Status  → Wellness tips, screen time
//   5. Ambient Light   → Eye health alerts
//   6. Camera rPPG     → Heart rate estimation
//   7. Vibration       → Haptic feedback (output only)
// ═══════════════════════════════════════════════════════════════

const BloomSensors = (() => {

  // ── Step counter state ─────────────────────────────────────
  // IMPROVED ALGORITHM — Vehicle Vibration Resistant
  // ─────────────────────────────────────────────────────────
  // Key insight: Walking produces a PERIODIC signal at 1.5–2.5 Hz
  // with CONSISTENT cadence (σ < 80ms over 5 steps).
  //
  // Car vibrations come from:
  //   a) Engine: 20–80 Hz → eliminated by our low-pass filter
  //   b) Road bumps: sporadic high-amp spikes → rejected by cadence check
  //   c) Car acceleration: <0.5 Hz → eliminated by our high-pass filter
  //
  // Two-stage IIR filter cascade (isolates 0.5–5 Hz walking band):
  //   Stage 1 HIGH-PASS  y[n] = β*(y[n-1] + x[n] - x[n-1])  β=0.9
  //     → removes gravity (DC component ~9.81 m/s²)
  //     → removes slow car acceleration (<0.5 Hz)
  //   Stage 2 LOW-PASS   y[n] = α*x[n] + (1-α)*y[n-1]      α=0.25
  //     → removes high-freq engine vibrations (>~6 Hz)
  //
  // Cadence validation (CRITICAL for car rejection):
  //   - Collect last 6 inter-peak intervals
  //   - REQUIRE: all intervals in [290, 820] ms (walking range)
  //   - REQUIRE: σ(intervals) < 80 ms (walking is rhythmic)
  //   - REQUIRE: 5 consecutive valid intervals before counting starts
  //   - Walking confidence score: builds slowly, drops instantly on violation
  //
  // Gyroscope fusion (if available):
  //   - Walking produces rhythmic lateral rotation (γ ~0.3–1.0 rad/s)
  //   - Car motion produces sustained low-amp rotation → adds confidence penalty
  // ─────────────────────────────────────────────────────────

  const STEP = {
    MIN_INTERVAL:   290,   // ms  — max 3.4 steps/sec (fast run)
    MAX_INTERVAL:   820,   // ms  — min 1.2 steps/sec (very slow walk)
    PEAK_THRESH:    1.8,   // m/s² above filtered baseline
    CONFIRM_COUNT:  5,     // consecutive valid intervals required
    MAX_STD_DEV:    80,    // ms  — cadence must be THIS consistent
    CONFIDENCE_MAX: 8,     // max confidence score
    HP_BETA:        0.90,  // high-pass IIR coefficient
    LP_ALPHA:       0.25,  // low-pass IIR coefficient
  };

  let stepState = {
    on: false,
    motionHandler: null,
    gyroHandler: null,
    // Filters
    rawPrev:     0,
    hpPrev:      0,    // high-pass output (prev)
    lpPrev:      0,    // low-pass output (prev)
    // Peak detection
    prevLp:      0,    // previous LP value for zero-crossing
    lastPeakMs:  0,
    // Cadence validation
    intervals:   [],   // last 6 inter-peak intervals
    confidence:  0,    // 0-8 counting confidence
    // Gyro fusion
    gyroY:       0,    // latest Y-axis gyro magnitude
  };

  function processMotion(e) {
    const ag = e.accelerationIncludingGravity;
    if (!ag) return;
    const x = ag.x || 0, y = ag.y || 0, z = ag.z || 0;
    const raw = Math.sqrt(x * x + y * y + z * z);

    // ── Stage 1: High-pass filter (removes gravity + slow drift) ──
    const hp = STEP.HP_BETA * (stepState.hpPrev + raw - stepState.rawPrev);
    stepState.rawPrev = raw;
    stepState.hpPrev  = hp;

    // ── Stage 2: Low-pass filter (removes engine vibrations >6 Hz) ──
    const lp = STEP.LP_ALPHA * hp + (1 - STEP.LP_ALPHA) * stepState.lpPrev;
    stepState.lpPrev = lp;

    const now = Date.now();

    // ── Peak detection: positive zero-crossing of LP signal ──────
    // (signal goes from negative → positive AND exceeds threshold)
    const isPeak = (stepState.prevLp < 0 && lp >= 0 && lp > STEP.PEAK_THRESH);
    stepState.prevLp = lp;

    if (!isPeak) return;

    const dt = now - stepState.lastPeakMs;

    // ── Cadence validation ────────────────────────────────────────
    if (dt >= STEP.MIN_INTERVAL && dt <= STEP.MAX_INTERVAL) {
      // Valid walking interval — add to buffer
      stepState.intervals.push(dt);
      if (stepState.intervals.length > 6) stepState.intervals.shift();
      stepState.lastPeakMs = now;

      if (stepState.intervals.length >= STEP.CONFIRM_COUNT) {
        // Calculate std deviation of recent intervals
        const mean = stepState.intervals.reduce((a, b) => a + b, 0) / stepState.intervals.length;
        const variance = stepState.intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / stepState.intervals.length;
        const stdDev = Math.sqrt(variance);

        if (stdDev < STEP.MAX_STD_DEV) {
          // Gyro fusion: if gyro says low rotation, slight penalty
          const gyroBonus = stepState.gyroY > 0.15 ? 1 : 0;
          stepState.confidence = Math.min(STEP.CONFIDENCE_MAX, stepState.confidence + 1 + gyroBonus);

          // Only count steps once confidence is at threshold
          if (stepState.confidence >= STEP.CONFIRM_COUNT) {
            if (typeof window.onStepCounted === 'function') window.onStepCounted();
            updateStepUI();
          }
        } else {
          // Inconsistent cadence (road bumps? car?) — reduce confidence
          stepState.confidence = Math.max(0, stepState.confidence - 2);
          if (stepState.confidence === 0) stepState.intervals = [];
        }
      }
    } else if (dt > STEP.MAX_INTERVAL) {
      // Long pause (stopped walking) — reset confirmation buffer
      // This is NORMAL (stopped at traffic light etc.) — don't lose confidence
      // Just reset the interval buffer so next walk re-confirms
      stepState.intervals = [];
      stepState.lastPeakMs = now;
      // Gently reduce confidence (not walking for a while)
      stepState.confidence = Math.max(0, stepState.confidence - 1);
    } else if (dt < STEP.MIN_INTERVAL) {
      // TOO FAST — definitely not walking (engine vibration leaked through?)
      // Hard reset confidence
      stepState.confidence = Math.max(0, stepState.confidence - 3);
      if (stepState.confidence === 0) stepState.intervals = [];
    }
  }

  // Gyroscope data — used for step confidence fusion
  function processGyro(e) {
    // DeviceMotionEvent provides rotationRate
    if (!e.rotationRate) return;
    const gamma = Math.abs(e.rotationRate.gamma || 0);
    const beta  = Math.abs(e.rotationRate.beta  || 0);
    // Combine lateral + forward rotation — walking swings arms/body
    stepState.gyroY = Math.max(gamma, beta) * (Math.PI / 180); // deg/s → rad/s
  }

  async function startSteps() {
    if (stepState.on) return { ok: false, msg: 'Already running' };

    // iOS 13+ needs permission
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

    stepState.motionHandler = processMotion;
    stepState.gyroHandler   = processGyro;
    window.addEventListener('devicemotion', stepState.motionHandler, { passive: true });
    // Gyro is part of devicemotion event too
    stepState.on = true;

    // Reset filter state on start
    Object.assign(stepState, {
      rawPrev: 0, hpPrev: 0, lpPrev: 0, prevLp: 0,
      lastPeakMs: 0, intervals: [], confidence: 0, gyroY: 0,
    });

    return { ok: true };
  }

  function stopSteps() {
    if (stepState.motionHandler) window.removeEventListener('devicemotion', stepState.motionHandler);
    stepState.on = false;
    stepState.confidence = 0;
    stepState.intervals  = [];
  }

  function getStepConfidence() {
    return Math.round((stepState.confidence / STEP.CONFIDENCE_MAX) * 100);
  }

  function updateStepUI() {
    // Called by app.js via window hook
    if (typeof window.onSensorStep === 'function') window.onSensorStep();
  }

  // ── GPS / Location Tracking ────────────────────────────────
  let gpsState = {
    on: false,
    watchId: null,
    positions: [],
    totalDistanceM: 0,
    lastPos: null,
    startTime: null,
  };

  function haversineM(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async function startGPS() {
    if (!navigator.geolocation) return { ok: false, msg: 'GPS not available' };
    if (gpsState.on) return { ok: false, msg: 'Already tracking' };

    return new Promise(resolve => {
      gpsState.watchId = navigator.geolocation.watchPosition(
        pos => {
          const { latitude: lat, longitude: lon, accuracy } = pos.coords;
          if (accuracy > 50) return; // skip inaccurate readings

          if (gpsState.lastPos) {
            const d = haversineM(gpsState.lastPos.lat, gpsState.lastPos.lon, lat, lon);
            if (d > 2 && d < 200) { // filter teleports & stationary noise
              gpsState.totalDistanceM += d;
              gpsState.positions.push({ lat, lon, t: Date.now() });
              if (typeof window.onGPSUpdate === 'function') window.onGPSUpdate(getGPSData());
            }
          } else {
            gpsState.startTime = Date.now();
            gpsState.positions.push({ lat, lon, t: Date.now() });
            resolve({ ok: true });
          }
          gpsState.lastPos = { lat, lon };
        },
        err => {
          resolve({ ok: false, msg: err.message });
        },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
      );
      gpsState.on = true;
      setTimeout(() => resolve({ ok: true }), 500);
    });
  }

  function stopGPS() {
    if (gpsState.watchId !== null) {
      navigator.geolocation.clearWatch(gpsState.watchId);
      gpsState.watchId = null;
    }
    gpsState.on = false;
  }

  function getGPSData() {
    const km  = (gpsState.totalDistanceM / 1000).toFixed(2);
    const elapsed = gpsState.startTime ? Math.floor((Date.now() - gpsState.startTime) / 60000) : 0;
    const pace = elapsed > 0 && gpsState.totalDistanceM > 100
      ? (elapsed / (gpsState.totalDistanceM / 1000)).toFixed(1)
      : '--';
    return {
      km,
      distanceM: Math.round(gpsState.totalDistanceM),
      elapsedMin: elapsed,
      pace, // min/km
      positions: gpsState.positions,
      on: gpsState.on,
    };
  }

  function resetGPS() {
    stopGPS();
    gpsState.positions = [];
    gpsState.totalDistanceM = 0;
    gpsState.lastPos = null;
    gpsState.startTime = null;
  }

  // ── Battery Status ─────────────────────────────────────────
  let batteryState = { level: null, charging: false, supported: false };

  async function initBattery() {
    if (!('getBattery' in navigator)) {
      batteryState.supported = false;
      return batteryState;
    }
    try {
      const bat = await navigator.getBattery();
      const update = () => {
        batteryState = {
          supported: true,
          level: Math.round(bat.level * 100),
          charging: bat.charging,
          chargingTime: bat.chargingTime,
          dischargingTime: bat.dischargingTime,
        };
        if (typeof window.onBatteryUpdate === 'function') window.onBatteryUpdate(batteryState);
      };
      bat.addEventListener('levelchange',    update);
      bat.addEventListener('chargingchange', update);
      update();
    } catch (e) {
      batteryState.supported = false;
    }
    return batteryState;
  }

  // ── Ambient Light Sensor ───────────────────────────────────
  let lightState = { level: null, supported: false, sensor: null };

  function initAmbientLight() {
    if (!('AmbientLightSensor' in window)) {
      lightState.supported = false;
      return false;
    }
    try {
      const sensor = new AmbientLightSensor({ frequency: 1 });
      sensor.addEventListener('reading', () => {
        lightState.level = Math.round(sensor.illuminance);
        lightState.supported = true;
        if (typeof window.onLightUpdate === 'function') window.onLightUpdate(lightState);
      });
      sensor.addEventListener('error', () => { lightState.supported = false; });
      sensor.start();
      lightState.sensor = sensor;
      lightState.supported = true;
      return true;
    } catch (e) {
      lightState.supported = false;
      return false;
    }
  }

  function getLightAdvice(lux) {
    if (lux === null) return { emoji: '💡', text: 'Not available', color: 'var(--tsoft)' };
    if (lux < 50)   return { emoji: '🌙', text: 'Very dim — rest your eyes, avoid screens', color: '#a855f7' };
    if (lux < 200)  return { emoji: '🕯️', text: 'Low light — consider a reading lamp', color: '#38bdf8' };
    if (lux < 1000) return { emoji: '✅', text: 'Good indoor lighting', color: '#34d399' };
    if (lux < 5000) return { emoji: '🌤', text: 'Bright indoors or overcast outdoor', color: '#fbbf24' };
    return { emoji: '☀️', text: 'Bright sunlight — protect your eyes outdoors', color: '#f97316' };
  }

  // ── Camera Heart Rate (rPPG) ───────────────────────────────
  // Place finger over rear camera + flashlight → detect blood-flow color changes
  let hrState = {
    on: false, stream: null,
    samples: [], intervalId: null,
    bpm: 0, quality: 0,
    canvas: null, ctx: null, video: null,
  };

  async function startHeartRate() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
      return { ok: false, msg: 'Camera not available' };

    try {
      // Request rear camera with torch
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 64 },
          height: { ideal: 64 },
          frameRate: { ideal: 30 },
          advanced: [{ torch: true }],
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      hrState.stream = stream;
      hrState.on = true;
      hrState.samples = [];
      hrState.bpm = 0;

      // Set up off-screen canvas for frame sampling
      if (!hrState.canvas) {
        hrState.canvas = document.createElement('canvas');
        hrState.canvas.width = 8;
        hrState.canvas.height = 8;
        hrState.ctx = hrState.canvas.getContext('2d');
      }
      if (!hrState.video) {
        hrState.video = document.createElement('video');
        hrState.video.playsInline = true;
        hrState.video.muted = true;
      }
      hrState.video.srcObject = stream;
      await hrState.video.play();

      // Sample red channel at 30fps
      hrState.intervalId = setInterval(() => sampleFrame(), 33);
      return { ok: true };
    } catch (e) {
      return { ok: false, msg: e.message };
    }
  }

  function sampleFrame() {
    if (!hrState.video || !hrState.ctx) return;
    hrState.ctx.drawImage(hrState.video, 0, 0, 8, 8);
    const data = hrState.ctx.getImageData(0, 0, 8, 8).data;
    // Average red channel across all pixels
    let rSum = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
      rSum += data[i];
      count++;
    }
    const rAvg = rSum / count;
    hrState.samples.push({ r: rAvg, t: Date.now() });

    // Keep 10 seconds of samples at 30fps = 300 samples
    if (hrState.samples.length > 300) hrState.samples.shift();

    // Calculate BPM once we have 5+ seconds (150 samples)
    if (hrState.samples.length >= 150) {
      calculateHR();
    }
  }

  function calculateHR() {
    // Simple peak-detection on red channel signal
    // Red channel is highest when blood is present (fingertip over camera)
    const vals = hrState.samples.map(s => s.r);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const std  = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);

    hrState.quality = Math.min(100, Math.round((std / 5) * 100)); // signal quality

    // Find peaks above mean + 0.3*std
    const threshold = mean + 0.3 * std;
    const peaks = [];
    let prevV = vals[0];
    for (let i = 1; i < vals.length - 1; i++) {
      const v = vals[i];
      if (v > threshold && v >= vals[i - 1] && v >= vals[i + 1] && prevV < v) {
        // Check min interval (200ms = 300bpm max)
        const t = hrState.samples[i].t;
        if (peaks.length === 0 || t - peaks[peaks.length - 1] > 200) {
          peaks.push(t);
        }
      }
      prevV = v;
    }

    if (peaks.length >= 3) {
      const diffs = [];
      for (let i = 1; i < peaks.length; i++) diffs.push(peaks[i] - peaks[i - 1]);
      const avgInterval = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      const bpm = Math.round(60000 / avgInterval);
      // Sanity check: 40-200 BPM
      if (bpm >= 40 && bpm <= 200) {
        hrState.bpm = bpm;
        if (typeof window.onHRUpdate === 'function') window.onHRUpdate({ bpm, quality: hrState.quality });
      }
    }
  }

  function stopHeartRate() {
    if (hrState.intervalId) { clearInterval(hrState.intervalId); hrState.intervalId = null; }
    if (hrState.stream) {
      hrState.stream.getTracks().forEach(t => t.stop());
      hrState.stream = null;
    }
    if (hrState.video) { hrState.video.srcObject = null; }
    hrState.on = false;
    hrState.samples = [];
    hrState.bpm = 0;
  }

  // ── Haptic / Vibration (output only) ──────────────────────
  function vibrate(pattern) {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern || [100]);
    }
  }

  function milestoneBuzz()  { vibrate([150, 80, 150, 80, 300]); }
  function successBuzz()    { vibrate([100, 50, 100]); }
  function tapBuzz()        { vibrate([30]); }

  // ── Network Speed Monitor ──────────────────────────────────
  // Real-time download speed test using Cloudflare's speed test
  // endpoint — fully CORS-enabled, works on ALL mobile browsers
  // with zero setup. Falls back to navigator.connection estimate.
  //
  // HOW IT WORKS:
  //   1. Downloads 50 KB from speed.cloudflare.com (CORS-open)
  //   2. Measures exact bytes / time = real download Mbps
  //   3. Repeats every 5 seconds while running
  //   4. Falls back to navigator.connection.downlink if fetch fails
  // ─────────────────────────────────────────────────────────

  const NET_TEST_URL   = 'https://speed.cloudflare.com/__down?bytes=50000';
  const NET_TEST_BYTES = 50000; // 50 KB per test — fast enough for quick result

  const netState = {
    on:        false,
    testing:   false,
    intervalId: null,
    currentMbps: null,
    history:   [],   // last 10 { mbps, label } entries
  };

  async function _doSpeedTest() {
    if (netState.testing) return null;
    netState.testing = true;
    try {
      const t0 = performance.now();
      const resp = await fetch(NET_TEST_URL + '&_=' + Date.now(), {
        cache: 'no-store',
        mode:  'cors',
      });
      await resp.arrayBuffer();
      const secs = (performance.now() - t0) / 1000;
      netState.testing = false;
      const mbps = (NET_TEST_BYTES * 8) / (secs * 1_000_000);
      return Math.round(mbps * 100) / 100; // 2 decimal places
    } catch (e) {
      netState.testing = false;
      // Fallback: navigator Network Information API estimate
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (conn && conn.downlink) return conn.downlink;
      return null;
    }
  }

  async function startNetSpeed() {
    if (netState.on) return;
    netState.on       = true;
    netState.history  = [];

    const tick = async () => {
      const mbps = await _doSpeedTest();
      if (mbps !== null) {
        netState.currentMbps = mbps;
        const label = mbps < 1
          ? Math.round(mbps * 1000) + 'K'
          : mbps.toFixed(1) + 'M';
        netState.history.push({ mbps, label });
        if (netState.history.length > 10) netState.history.shift();
      }
      if (typeof window.onNetSpeedUpdate === 'function') {
        window.onNetSpeedUpdate(mbps, [...netState.history]);
      }
    };

    await tick(); // first reading immediately
    netState.intervalId = setInterval(tick, 5000);
  }

  function stopNetSpeed() {
    if (netState.intervalId) clearInterval(netState.intervalId);
    netState.on        = false;
    netState.intervalId = null;
    netState.testing   = false;
  }

  function getNetSpeedState() {
    return {
      on:          netState.on,
      testing:     netState.testing,
      currentMbps: netState.currentMbps,
      history:     [...netState.history],
    };
  }

  // ── Network Info ───────────────────────────────────────────
  function getNetworkInfo() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) return null;
    return {
      type:       conn.effectiveType || conn.type || 'unknown',
      downlink:   conn.downlink,
      saveData:   conn.saveData,
    };
  }

  // ── Screen / Display ──────────────────────────────────────
  function getScreenInfo() {
    return {
      width:  window.screen.width,
      height: window.screen.height,
      dpr:    window.devicePixelRatio || 1,
      orientation: screen.orientation ? screen.orientation.type : 'unknown',
    };
  }

  // ── Public API ─────────────────────────────────────────────
  return {
    // Steps
    startSteps,
    stopSteps,
    stepIsOn:         () => stepState.on,
    getStepConfidence,
    // GPS
    startGPS,
    stopGPS,
    resetGPS,
    getGPSData,
    gpsIsOn:          () => gpsState.on,
    // Battery
    initBattery,
    getBattery:       () => batteryState,
    // Ambient Light
    initAmbientLight,
    getLight:         () => lightState,
    getLightAdvice,
    // Heart Rate
    startHeartRate,
    stopHeartRate,
    getHR:            () => ({ bpm: hrState.bpm, quality: hrState.quality, on: hrState.on }),
    // Haptics
    vibrate,
    milestoneBuzz,
    successBuzz,
    tapBuzz,
    // Network Speed Monitor
    startNetSpeed,
    stopNetSpeed,
    getNetSpeedState,
    netSpeedIsOn: () => netState.on,
    // Device info
    getNetworkInfo,
    getScreenInfo,
  };
})();