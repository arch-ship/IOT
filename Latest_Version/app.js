// ═══════════════════════════════════════════════════════════════
// BLOOM WELLNESS — Main Application
// Requires: sensors.js and auth.js to be loaded first
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────
// STATE — localStorage persistence
// ─────────────────────────────────────────
const STORE_KEY = 'bloom_v5';
let S = loadState();

function defaultState() {
  return {
    userName:      '',
    steps:         0,
    stepGoal:      8000,
    stepDate:      today(),
    water:         0,
    waterGoal:     8,
    meals:         [],
    weights:       [],
    notifGranted:  false,
    sensorOn:      false,
    gpsOn:         false,
    calTarget:     1500,
    biometricEnabled: false,
    biometricCredId:  null,
    hrLog:         [],
    planMeals: [
      { id: 1, icon: '🌅', label: 'Breakfast', labelColor: '#fbbf24', time: '7–8 AM',   name: 'Oatmeal + boiled egg + green tea',               kcal: 350 },
      { id: 2, icon: '🍎', label: 'Snack',     labelColor: '#34d399', time: '10 AM',    name: 'Seasonal fruit or a handful of nuts',             kcal: 150 },
      { id: 3, icon: '☀️', label: 'Lunch',     labelColor: '#ff6b9d', time: '12:30 PM', name: 'Brown rice + dal + salad + curd',                 kcal: 500 },
      { id: 4, icon: '🌿', label: 'Snack',     labelColor: '#38bdf8', time: '4 PM',     name: 'Buttermilk or fruit',                             kcal: 150 },
      { id: 5, icon: '🌙', label: 'Dinner',    labelColor: '#a855f7', time: '7–7:30 PM', name: 'Grilled paneer/chicken + veggies + soup',        kcal: 450 },
    ],
    schedule: [
      { id:1,  time:'6:00 AM',  title:'Wake up & drink water',   sub:'500ml warm lemon water',                    e:'🌅', c:'#38bdf8', done:false },
      { id:2,  time:'6:30 AM',  title:'Morning walk / yoga',     sub:'30 mins light movement',                    e:'🧘‍♀️', c:'#34d399', done:false },
      { id:3,  time:'7:30 AM',  title:'Healthy breakfast',       sub:'Oatmeal + egg + green tea',                 e:'🥣', c:'#fbbf24', done:false },
      { id:4,  time:'10:00 AM', title:'Morning snack',           sub:'Fruit or nuts (~150 kcal)',                 e:'🍎', c:'#f97316', done:false },
      { id:5,  time:'10:30 AM', title:'Water break',             sub:'Drink 1 full glass (250ml)',                e:'💧', c:'#38bdf8', done:false },
      { id:6,  time:'12:30 PM', title:'Lunch time',              sub:'Brown rice + dal + salad',                  e:'🍽️', c:'#fbbf24', done:false },
      { id:7,  time:'2:00 PM',  title:'Post-lunch walk',         sub:'1,000–2,000 steps',                         e:'🚶‍♀️', c:'#34d399', done:false },
      { id:8,  time:'4:00 PM',  title:'Evening snack',           sub:'Buttermilk or fruit',                       e:'🌿', c:'#34d399', done:false },
      { id:9,  time:'5:30 PM',  title:'Main exercise walk',      sub:'Brisk 30-min walk (4,000+ steps)',          e:'🏃‍♀️', c:'#ff6b9d', done:false },
      { id:10, time:'7:00 PM',  title:'Relaxation stretch',      sub:'Light yoga or meditation',                  e:'🧘‍♀️', c:'#a855f7', done:false },
      { id:11, time:'7:30 PM',  title:'Dinner',                  sub:'Protein + veggies + soup',                  e:'🌙', c:'#a855f7', done:false },
      { id:12, time:'9:30 PM',  title:'Final water check',       sub:'Finish 2L goal if needed',                  e:'💧', c:'#38bdf8', done:false },
      { id:13, time:'10:00 PM', title:'Sleep routine',           sub:'7–8 hours beauty sleep 💤',                 e:'😴', c:'#a855f7', done:false },
    ],
    reminders: [
      { title:'💧 Hydration Reminder',  time:'Every 2 hours',            on:true  },
      { title:'👟 Step Goal Alert',      time:'6 PM if goal not reached', on:true  },
      { title:'🥗 Meal Logging',         time:'At meal times',            on:true  },
      { title:'💊 Vitamins Reminder',    time:'After breakfast & dinner', on:true  },
      { title:'⚖️ Morning Weigh-in',    time:'Every Monday 7 AM',        on:false },
      { title:'👩‍⚕️ Doctor Check-in',   time:'Monthly appointment',      on:false },
    ],
  };
}

function loadState() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY));
    return d ? { ...defaultState(), ...d } : defaultState();
  } catch (e) { return defaultState(); }
}

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) {}
}

function today() { return new Date().toDateString(); }

function checkDayReset() {
  if (S.stepDate !== today()) {
    S.steps = 0;
    S.stepDate = today();
    S.water = 0;
    S.meals = [];
    S.schedule.forEach(s => s.done = false);
    save();
  }
}

// ─────────────────────────────────────────
// SENSOR CALLBACKS (called by sensors.js)
// ─────────────────────────────────────────
window.onSensorStep = () => {
  S.steps++;
  save();
  updateAll();
  handleStepMilestone();
  BloomSensors.tapBuzz();
};

window.onGPSUpdate = (data) => {
  txt('gps-km',   data.km + ' km');
  txt('gps-pace', data.pace + ' min/km');
  txt('gps-time', data.elapsedMin + ' min');
};

window.onBatteryUpdate = (bat) => {
  if (!bat.supported) return;
  txt('bat-level', bat.level + '%');
  txt('bat-status', bat.charging ? '⚡ Charging' : '🔋 On battery');
  const advice = bat.level < 20 ? '⚠️ Low battery — plug in soon!' :
                 bat.level < 50 ? '📱 Moderate battery' :
                 '✅ Good battery level';
  txt('bat-advice', advice);
};

window.onLightUpdate = (light) => {
  if (!light.supported) return;
  const a = BloomSensors.getLightAdvice(light.level);
  txt('light-val',    light.level + ' lux');
  txt('light-advice', a.emoji + ' ' + a.text);
};

window.onHRUpdate = (data) => {
  txt('hr-bpm',     data.bpm + ' BPM');
  txt('hr-quality', 'Signal: ' + data.quality + '%');
  if (data.quality >= 60) {
    const entry = { bpm: data.bpm, t: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) };
    S.hrLog.unshift(entry);
    if (S.hrLog.length > 10) S.hrLog.pop();
    save();
    renderHRLog();
  }
};

// ─────────────────────────────────────────
// SERVICE WORKER
// ─────────────────────────────────────────
let swReg = null;
async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    swReg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    setInterval(() => { if (swReg?.active) swReg.active.postMessage({ type: 'PING' }); }, 25000);
  } catch (e) { console.warn('SW registration failed:', e); }
}

// ─────────────────────────────────────────
// BIOMETRIC AUTH
// ─────────────────────────────────────────
async function tryBiometricLock() {
  if (!S.biometricEnabled || !S.biometricCredId) return true;
  const lock = document.getElementById('bioLock');
  if (!lock) return true;

  lock.style.display = 'flex';
  txt('bioLockName', S.userName || 'Mama');

  try {
    const ok = await BloomAuth.authenticate(S.biometricCredId);
    if (ok) {
      BloomSensors.successBuzz();
      lock.classList.add('unlocked');
      setTimeout(() => { lock.style.display = 'none'; lock.classList.remove('unlocked'); }, 500);
      return true;
    } else {
      showToast('Authentication failed 🔐');
      return false;
    }
  } catch (e) {
    showToast('Biometric error: ' + e.message);
    lock.style.display = 'none';
    return true; // Fail open — don't lock user out of their health app
  }
}

async function toggleBiometric() {
  const toggle = document.getElementById('bioToggle');
  if (!BloomAuth.isSupported()) {
    showToast('WebAuthn not supported on this browser');
    return;
  }
  if (!S.biometricEnabled) {
    // Check if biometric is available on this device
    const available = await BloomAuth.biometricAvailable();
    if (!available) {
      showToast('No biometric sensor found on this device');
      return;
    }
    try {
      showToast('Follow the prompt to register your biometric…');
      const credId = await BloomAuth.register(S.userName);
      S.biometricEnabled  = true;
      S.biometricCredId   = credId;
      save();
      if (toggle) toggle.classList.add('on');
      BloomSensors.successBuzz();
      showToast('🔐 Biometric lock enabled! ✅');
    } catch (e) {
      showToast('Registration failed: ' + e.message);
    }
  } else {
    // Disable
    S.biometricEnabled = false;
    S.biometricCredId  = null;
    save();
    if (toggle) toggle.classList.remove('on');
    showToast('Biometric lock disabled');
  }
}

// ─────────────────────────────────────────
// ONBOARDING
// ─────────────────────────────────────────
async function startApp() {
  const name = document.getElementById('obName').value.trim();
  if (!name) { showToast('Please enter your name 🌸'); return; }
  S.userName = name;
  save();
  await launchApp();
  await requestNotif();
  if (S.notifGranted) {
    document.getElementById('ndot')?.classList.add('on');
    startReminderLoop();
    sendNotif('🌸 Welcome to Bloom, ' + name + '!', 'Your wellness journey starts now. Let\'s go! 💪');
  }
  const result = await BloomSensors.startSteps();
  if (result.ok) {
    S.sensorOn = true; save();
    setSensorUI('active');
    document.getElementById('livePill').style.display = 'flex';
    showToast('✅ Step counting started! 🚶‍♀️');
  } else {
    showToast('Motion sensor: ' + result.msg);
  }
}

async function skipOnboard() {
  const name = document.getElementById('obName').value.trim() || 'Mama';
  S.userName = name;
  save();
  await launchApp();
}

async function launchApp() {
  document.getElementById('onboard')?.classList.add('gone');
  const mainApp = document.getElementById('mainApp');
  if (mainApp) mainApp.style.display = '';
  txt('hdrName', S.userName || 'Mama');
  await registerSW();
  checkDayReset();
  updateAll();
  renderSchedule();
  renderPlan();
  renderSensorsPage();
  BloomSensors.initBattery();
  BloomSensors.initAmbientLight();
}

// ─────────────────────────────────────────
// PAGE NAVIGATION
// ─────────────────────────────────────────
function goPage(name, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  document.getElementById('pg-' + name)?.classList.add('active');
  el?.classList.add('active');
  updateAll();
  if (name === 'sensors') renderSensorsPage();
  // Stop live speed test when leaving sensors tab to save data
  if (name !== 'sensors' && BloomSensors.netSpeedIsOn()) {
    BloomSensors.stopNetSpeed();
    const btn   = document.getElementById('btnNetSpeed');
    const pulse = document.getElementById('netSpeedPulse');
    if (btn)   { btn.textContent = 'Start'; btn.style.background = 'rgba(168,85,247,.12)'; }
    if (pulse) pulse.style.display = 'none';
  }
}

// ─────────────────────────────────────────
// STEP ACTIONS
// ─────────────────────────────────────────
async function toggleSensor() {
  if (BloomSensors.stepIsOn()) {
    BloomSensors.stopSteps();
    S.sensorOn = false; save();
    setSensorUI('idle');
    document.getElementById('livePill').style.display = 'none';
    showToast('Step tracking paused');
  } else {
    const result = await BloomSensors.startSteps();
    if (result.ok) {
      S.sensorOn = true; save();
      setSensorUI('active');
      document.getElementById('livePill').style.display = 'flex';
      showToast('✅ Step counting started!');
    } else {
      setSensorUI('denied');
      showToast('Motion permission: ' + result.msg);
    }
  }
}

function setGoal() {
  const v = parseInt(document.getElementById('goalIn').value);
  if (v >= 100) {
    S.stepGoal = v;
    document.getElementById('goalIn').value = '';
    save(); updateAll();
    showToast('Goal set to ' + v.toLocaleString() + ' steps! 🎯');
  } else {
    showToast('Please enter a valid goal (100+)');
  }
}

function resetSteps() { S.steps = 0; save(); updateAll(); showToast('Steps reset 👟'); }

function setSensorUI(state) {
  const dot = document.getElementById('sdot');
  const txt2 = document.getElementById('stxt');
  const btn  = document.getElementById('sbtn');
  if (!dot) return;
  if (state === 'active') {
    dot.className = 'sdot active';
    txt2.textContent = 'Counting steps (vehicle filter ON)…';
    btn.textContent = 'Pause';
  } else if (state === 'denied') {
    dot.className = 'sdot denied';
    txt2.textContent = 'Permission denied — tap to retry';
    btn.textContent = 'Retry';
  } else {
    dot.className = 'sdot';
    txt2.textContent = 'Tap to start motion tracking';
    btn.textContent = 'Enable';
  }
}

function handleStepMilestone() {
  if (S.steps > 0 && S.steps % 1000 === 0)
    sendNotif(`👟 ${S.steps.toLocaleString()} steps!`, 'You\'re on a roll! 💪');
  if (S.steps === S.stepGoal) {
    BloomSensors.milestoneBuzz();
    showToast('🎉 GOAL REACHED! Amazing, ' + S.userName + '!');
    sendNotif('🎉 Step Goal Reached!', `${S.stepGoal.toLocaleString()} steps — Champion! 🏆`);
  }
}

function maybeResumeSensor() {
  if (S.sensorOn) toggleSensor();
}

// ─────────────────────────────────────────
// GPS ACTIONS
// ─────────────────────────────────────────
async function toggleGPS() {
  const btn = document.getElementById('gpsBtnTxt');
  if (BloomSensors.gpsIsOn()) {
    BloomSensors.stopGPS();
    S.gpsOn = false; save();
    if (btn) btn.textContent = 'Start GPS';
    showToast('GPS route tracking stopped');
  } else {
    showToast('Starting GPS…');
    const result = await BloomSensors.startGPS();
    if (result.ok) {
      S.gpsOn = true; save();
      if (btn) btn.textContent = 'Stop GPS';
      showToast('📍 GPS tracking started!');
    } else {
      showToast('GPS error: ' + result.msg);
    }
  }
}

function resetGPS() {
  BloomSensors.resetGPS();
  ['gps-km', 'gps-pace', 'gps-time'].forEach(id => txt(id, '—'));
  showToast('GPS route reset');
}

// ─────────────────────────────────────────
// HEART RATE ACTIONS
// ─────────────────────────────────────────
async function toggleHR() {
  const btn = document.getElementById('hrBtnTxt');
  if (BloomSensors.getHR().on) {
    BloomSensors.stopHeartRate();
    if (btn) btn.textContent = 'Start Measuring';
    txt('hr-bpm', '— BPM');
    showToast('Heart rate stopped');
  } else {
    showToast('Place finger firmly over rear camera…');
    const result = await BloomSensors.startHeartRate();
    if (result.ok) {
      if (btn) btn.textContent = 'Stop';
      showToast('💓 Measuring… keep finger over camera (20 sec)');
    } else {
      showToast('Camera error: ' + result.msg);
    }
  }
}

function renderHRLog() {
  const el = document.getElementById('hrLog');
  if (!el) return;
  if (!S.hrLog.length) { el.innerHTML = '<div style="text-align:center;padding:12px;color:var(--tsoft);font-size:13px">No readings yet</div>'; return; }
  el.innerHTML = S.hrLog.slice(0, 5).map(h => {
    const zone = h.bpm < 60 ? 'Resting' : h.bpm < 100 ? 'Normal' : h.bpm < 140 ? 'Active' : 'High';
    const col  = h.bpm < 60 ? '#38bdf8' : h.bpm < 100 ? '#34d399' : h.bpm < 140 ? '#fbbf24' : '#ff6b9d';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04)">
      <span style="font-size:12px;color:var(--tsoft)">${h.t}</span>
      <span style="font-size:16px;font-weight:700;color:${col}">${h.bpm} BPM</span>
      <span style="font-size:11px;color:${col}">${zone}</span>
    </div>`;
  }).join('');
}

// ─────────────────────────────────────────
// NETWORK SPEED MONITOR
// ─────────────────────────────────────────
// Callback fired by sensors.js every time a measurement completes
window.onNetSpeedUpdate = (mbps, history) => {
  updateNetSpeedUI(mbps, history);
};

async function toggleNetSpeed() {
  const btn   = document.getElementById('btnNetSpeed');
  const pulse = document.getElementById('netSpeedPulse');

  if (BloomSensors.netSpeedIsOn()) {
    BloomSensors.stopNetSpeed();
    if (btn)   { btn.textContent = 'Start'; btn.style.background = 'rgba(168,85,247,.12)'; }
    if (pulse) pulse.style.display = 'none';
    txt('netSpeedStatus', 'Monitoring stopped — tap Start to resume');
  } else {
    if (btn)   { btn.textContent = 'Stop';  btn.style.background = 'rgba(255,107,157,.18)'; }
    if (pulse) pulse.style.display = 'inline-block';
    txt('netSpeedStatus', 'Connecting to test server…');
    txt('netSpeedVal',    '…');
    txt('netSpeedUnit',   'Mbps');
    txt('netSpeedRating', '');
    await BloomSensors.startNetSpeed();
  }
}

function updateNetSpeedUI(mbps, history) {
  // ── No result ───────────────────────────────────────────────
  if (mbps === null) {
    txt('netSpeedVal',    'ERR');
    txt('netSpeedUnit',   '');
    txt('netSpeedRating', '⚠️ Cannot reach test server');
    txt('netSpeedStatus', 'Check your internet connection and try again');
    return;
  }

  // ── Format display value ────────────────────────────────────
  let valStr, unit;
  if (mbps < 1) {
    valStr = Math.round(mbps * 1000).toString();
    unit   = 'Kbps';
  } else if (mbps >= 100) {
    valStr = Math.round(mbps).toString();
    unit   = 'Mbps';
  } else {
    valStr = mbps.toFixed(1);
    unit   = 'Mbps';
  }

  // ── Speed colour + rating ───────────────────────────────────
  let color, rating;
  if      (mbps < 1)  { color = 'var(--rose)';   rating = '🔴 Slow — streaming may buffer';   }
  else if (mbps < 5)  { color = 'var(--amber)';  rating = '🟡 Moderate — fine for browsing';  }
  else if (mbps < 20) { color = 'var(--gold)';   rating = '🟢 Good — handles HD streaming';   }
  else if (mbps < 50) { color = 'var(--mint)';   rating = '⚡ Fast — excellent connection';    }
  else                { color = 'var(--sky)';    rating = '🚀 Very Fast — 5G / Fibre quality'; }

  const valEl = document.getElementById('netSpeedVal');
  if (valEl) { valEl.textContent = valStr; valEl.style.color = color; }
  txt('netSpeedUnit',   unit);
  txt('netSpeedRating', rating);

  // ── Navigator Connection API extras ────────────────────────
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn) {
    txt('netConnType',  (conn.effectiveType || conn.type || 'unknown').toUpperCase());
    txt('netRTT',       conn.rtt !== undefined ? conn.rtt + ' ms' : '—');
    txt('netSaveData',  conn.saveData ? '🟡 ON' : '🟢 OFF');
  } else {
    txt('netConnType',  'N/A'); txt('netRTT', '—'); txt('netSaveData', '—');
  }

  // ── History bar chart ───────────────────────────────────────
  const barsEl = document.getElementById('netSpeedBars');
  if (barsEl && history.length > 0) {
    const maxMbps = Math.max(...history.map(h => h.mbps), 0.001);
    barsEl.innerHTML = history.map(h => {
      const pct  = Math.max(6, Math.round((h.mbps / maxMbps) * 100));
      let bc;
      if      (h.mbps < 1)  bc = 'var(--rose)';
      else if (h.mbps < 5)  bc = 'var(--amber)';
      else if (h.mbps < 20) bc = 'var(--gold)';
      else                   bc = 'var(--mint)';
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
        <div style="width:100%;height:44px;background:rgba(255,255,255,.05);border-radius:5px;display:flex;align-items:flex-end;overflow:hidden">
          <div style="width:100%;height:${pct}%;background:${bc};border-radius:5px 5px 0 0;transition:height .45s ease;min-height:4px"></div>
        </div>
        <div style="font-size:8px;color:var(--tsoft);text-align:center;line-height:1.2">${h.label}</div>
      </div>`;
    }).join('');
  }

  // ── Status line ─────────────────────────────────────────────
  const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  txt('netSpeedStatus', 'Last: ' + now + ' · Auto-refreshes every 5 s');
}

// ─────────────────────────────────────────
// SENSORS PAGE
// ─────────────────────────────────────────
function renderSensorsPage() {
  // Battery
  const bat = BloomSensors.getBattery();
  if (bat.supported) {
    txt('bat-level',  bat.level + '%');
    txt('bat-status', bat.charging ? '⚡ Charging' : '🔋 On battery');
  } else {
    txt('bat-level',  'N/A');
    txt('bat-status', 'Not supported on this browser');
  }

  // Light
  const light = BloomSensors.getLight();
  if (light.supported && light.level !== null) {
    const a = BloomSensors.getLightAdvice(light.level);
    txt('light-val',    light.level + ' lux');
    txt('light-advice', a.emoji + ' ' + a.text);
  } else {
    txt('light-val',    'N/A');
    txt('light-advice', 'Ambient light sensor not available');
  }

  // Network
  const net = BloomSensors.getNetworkInfo();
  txt('net-type', net ? net.type.toUpperCase() : 'Unknown');
  txt('net-save', net?.saveData ? 'Data saver ON' : 'Normal mode');

  // Biometric toggle state
  const bioToggle = document.getElementById('bioToggle');
  if (bioToggle) {
    bioToggle.className = 'tog ' + (S.biometricEnabled ? 'on' : '');
  }
  txt('bioStatus', S.biometricEnabled ? '🔐 Lock enabled' : '🔓 No lock');
  txt('bioDevice', BloomAuth.isMobile() ? '📱 Mobile device detected' : '💻 Desktop device');

  // Step confidence
  txt('stepConf', BloomSensors.getStepConfidence() + '%');

  // GPS
  const gps = BloomSensors.getGPSData();
  txt('gps-km',   gps.km + ' km');
  txt('gps-pace', gps.pace + ' min/km');
  txt('gps-time', gps.elapsedMin + ' min');
  const gpsBtnTxt = document.getElementById('gpsBtnTxt');
  if (gpsBtnTxt) gpsBtnTxt.textContent = gps.on ? 'Stop GPS' : 'Start GPS';

  // HR
  txt('hr-bpm',     (BloomSensors.getHR().bpm || '—') + ' BPM');
  renderHRLog();
}

// ─────────────────────────────────────────
// WATER
// ─────────────────────────────────────────
function renderGlasses() {
  const g = document.getElementById('ggrid');
  if (!g) return;
  g.innerHTML = '';
  for (let i = 0; i < S.waterGoal; i++) {
    const b = document.createElement('div');
    b.className = 'gbtn' + (i < S.water ? ' filled' : '');
    b.innerHTML = `<div class="gfill"></div><div style="position:relative;z-index:1;font-size:22px">${i < S.water ? '💧' : '🫙'}</div><div class="gnum">${(i + 1) * 250}ml</div>`;
    b.onclick = () => tapGlass(i);
    g.appendChild(b);
  }
}

function tapGlass(i) {
  S.water = (i < S.water) ? i : i + 1;
  save(); updateAll();
  BloomSensors.tapBuzz();
  const ml = S.water * 250;
  if (S.water >= S.waterGoal) {
    showToast('🎉 Hydration goal done!');
    BloomSensors.successBuzz();
    sendNotif('💧 Hydration Complete!', S.userName + ', you drank 2L today! ✨');
  } else {
    showToast(ml + 'ml — ' + (S.waterGoal - S.water) + ' glasses left 💧');
  }
}

function resetWater() { S.water = 0; save(); updateAll(); showToast('Water reset 💧'); }
function fillWater()  {
  S.water = S.waterGoal; save(); updateAll();
  showToast('🎉 Full hydration!');
  sendNotif('💧 Hydration Complete!', S.userName + ', 2L done! ✨');
}

// ─────────────────────────────────────────
// MEALS
// ─────────────────────────────────────────
function toggleMealForm() {
  const f = document.getElementById('addMealForm');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
}

function addMeal() {
  const name  = document.getElementById('mn').value.trim();
  const cals  = parseInt(document.getElementById('mc').value)    || 0;
  const carbs = parseInt(document.getElementById('mcarb').value) || 0;
  const prot  = parseInt(document.getElementById('mprot').value) || 0;
  const fat   = parseInt(document.getElementById('mfat').value)  || 0;
  const fib   = parseInt(document.getElementById('mfib').value)  || 0;
  const emoji = document.getElementById('me').value;
  if (!name || !cals) { showToast('Enter meal name & calories'); return; }
  const t = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  S.meals.push({ name, cals, carbs, prot, fat, fib, emoji, t });
  save();
  ['mn','mc','mcarb','mprot','mfat','mfib'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('addMealForm').style.display = 'none';
  updateAll();
  showToast(name + ' logged! (' + cals + ' kcal) 🥗');
}

function delMeal(i) { S.meals.splice(i, 1); save(); updateAll(); showToast('Meal removed'); }

function renderMeals() {
  const el = document.getElementById('mealLog');
  if (!el) return;
  if (!S.meals.length) {
    el.innerHTML = '<div style="text-align:center;padding:18px;color:var(--tsoft);font-size:13px">No meals yet — tap below to add! 🥗</div>';
    return;
  }
  el.innerHTML = S.meals.map((m, i) =>
    `<div class="meal-item">
      <div class="memi">${m.emoji}</div>
      <div class="minfo"><div class="mname">${m.name}</div><div class="mtime">${m.t}</div></div>
      <div class="mcal">${m.cals}kcal</div>
      <button class="delbtn" onclick="delMeal(${i})">×</button>
    </div>`
  ).join('');
}

// ─────────────────────────────────────────
// DOCTOR PLAN
// ─────────────────────────────────────────
function renderPlan() {
  const el = document.getElementById('planList');
  if (!el) return;
  if (!S.planMeals.length) {
    el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--tsoft);font-size:13px">No plan meals. Tap "+ Add Meal"!</div>';
    return;
  }
  el.innerHTML = S.planMeals.map((m, i) => `
    <div class="plan-item">
      <div class="plan-icon">${m.icon}</div>
      <div class="plan-body">
        <div class="plan-meal" style="color:${m.labelColor}">${m.label.toUpperCase()} · ${m.time}</div>
        <div class="plan-name">${m.name}</div>
        <div class="plan-kcal">~${m.kcal} kcal</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end">
        <button class="plan-edit-btn" onclick="editPlanMeal(${i})">✏️ Edit</button>
        <button class="plan-edit-btn" style="background:rgba(255,107,157,.1);border-color:rgba(255,107,157,.25);color:var(--rose)" onclick="delPlanMeal(${i})">🗑 Del</button>
      </div>
    </div>`).join('');
}

function addPlanMeal() {
  openModal('Add Plan Meal', `
    <div class="modal-label">Meal Type</div>
    <input class="modal-input" id="pm-label" placeholder="e.g. Breakfast, Lunch, Snack">
    <div class="modal-label">Time</div>
    <input class="modal-input" id="pm-time" placeholder="e.g. 7–8 AM">
    <div class="modal-label">Meal Name / Description</div>
    <textarea class="modal-textarea" id="pm-name" placeholder="e.g. Oatmeal + boiled egg + green tea"></textarea>
    <div class="modal-label">Calories (kcal)</div>
    <input class="modal-input" id="pm-kcal" type="number" placeholder="350" inputmode="numeric">
    <div class="modal-label">Icon (emoji)</div>
    <input class="modal-input" id="pm-icon" placeholder="🍽️" maxlength="4" style="font-size:24px;text-align:center">
    <button class="btn bv bfull" onclick="savePlanMeal(-1)">Add to Plan ✓</button>
  `);
}

function editPlanMeal(i) {
  const m = S.planMeals[i];
  openModal('Edit Plan Meal', `
    <div class="modal-label">Meal Type</div>
    <input class="modal-input" id="pm-label" value="${m.label}">
    <div class="modal-label">Time</div>
    <input class="modal-input" id="pm-time" value="${m.time}">
    <div class="modal-label">Meal Name / Description</div>
    <textarea class="modal-textarea" id="pm-name">${m.name}</textarea>
    <div class="modal-label">Calories (kcal)</div>
    <input class="modal-input" id="pm-kcal" type="number" value="${m.kcal}" inputmode="numeric">
    <div class="modal-label">Icon (emoji)</div>
    <input class="modal-input" id="pm-icon" value="${m.icon}" maxlength="4" style="font-size:24px;text-align:center">
    <button class="btn bv bfull" onclick="savePlanMeal(${i})">Save Changes ✓</button>
  `);
}

function savePlanMeal(i) {
  const label = document.getElementById('pm-label').value.trim();
  const time  = document.getElementById('pm-time').value.trim();
  const name  = document.getElementById('pm-name').value.trim();
  const kcal  = parseInt(document.getElementById('pm-kcal').value) || 0;
  const icon  = document.getElementById('pm-icon').value.trim() || '🍽️';
  if (!label || !name) { showToast('Please fill in meal type and name'); return; }
  const COLORS = ['#fbbf24','#34d399','#ff6b9d','#38bdf8','#a855f7','#f97316'];
  const meal = { id: Date.now(), icon, label, labelColor: COLORS[Math.floor(Math.random() * COLORS.length)], time, name, kcal };
  if (i === -1) S.planMeals.push(meal);
  else { meal.labelColor = S.planMeals[i].labelColor; S.planMeals[i] = meal; }
  save(); renderPlan(); closeModalDirect();
  showToast(i === -1 ? 'Meal added to plan! 🥗' : 'Plan meal updated! ✅');
}

function delPlanMeal(i) { S.planMeals.splice(i, 1); save(); renderPlan(); showToast('Plan meal removed'); }

// ─────────────────────────────────────────
// SCHEDULE
// ─────────────────────────────────────────
function renderSchedule() {
  const sl = document.getElementById('schedList');
  if (!sl) return;
  sl.innerHTML = S.schedule.map((s, i) => `
    <div class="sched-item ${s.done ? 'done' : ''}">
      <div class="stcol"><div class="stime">${s.time}</div></div>
      <div class="sdotc" style="background:${s.c};box-shadow:0 0 6px ${s.c}50"></div>
      <div class="sbody"><div class="stitle">${s.e} ${s.title}</div><div class="ssub">${s.sub}</div></div>
      <div style="display:flex;flex-direction:column;gap:4px;align-items:center">
        <div class="scheck ${s.done ? 'done' : ''}" onclick="toggleSched(${i})">✓</div>
        <button class="sedit-btn" onclick="editSchedItem(${i})">✏️</button>
      </div>
    </div>`).join('');

  const rl = document.getElementById('remList');
  if (!rl) return;
  rl.innerHTML = S.reminders.map((r, i) => `
    <div class="ri">
      <div><div class="rit">${r.title}</div><div class="rim">${r.time}</div></div>
      <div class="tog ${r.on ? 'on' : ''}" onclick="toggleRem(${i})"><div class="tok"></div></div>
    </div>`).join('');
}

function toggleSched(i) {
  S.schedule[i].done = !S.schedule[i].done;
  save(); renderSchedule();
  if (S.schedule[i].done) { BloomSensors.successBuzz(); showToast('✅ ' + S.schedule[i].title); }
}

function toggleRem(i) {
  S.reminders[i].on = !S.reminders[i].on;
  save(); renderSchedule();
  showToast(S.reminders[i].on ? '🔔 Reminder on' : '🔕 Reminder off');
}

function addScheduleItem() {
  openModal('Add Schedule Item', `
    <div class="modal-label">Time</div>
    <input class="modal-input" id="si-time" placeholder="e.g. 8:00 AM">
    <div class="modal-label">Icon (emoji)</div>
    <input class="modal-input" id="si-emoji" placeholder="🌟" maxlength="4" style="font-size:24px;text-align:center">
    <div class="modal-label">Title</div>
    <input class="modal-input" id="si-title" placeholder="Activity title">
    <div class="modal-label">Description</div>
    <textarea class="modal-textarea" id="si-sub" placeholder="Short description"></textarea>
    <button class="btn bv bfull" onclick="saveSchedItem(-1)">Add to Schedule ✓</button>
  `);
}

function editSchedItem(i) {
  const s = S.schedule[i];
  openModal('Edit Schedule Item', `
    <div class="modal-label">Time</div>
    <input class="modal-input" id="si-time" value="${s.time}">
    <div class="modal-label">Icon (emoji)</div>
    <input class="modal-input" id="si-emoji" value="${s.e}" maxlength="4" style="font-size:24px;text-align:center">
    <div class="modal-label">Title</div>
    <input class="modal-input" id="si-title" value="${s.title}">
    <div class="modal-label">Description</div>
    <textarea class="modal-textarea" id="si-sub">${s.sub}</textarea>
    <div style="display:flex;gap:8px;margin-top:4px">
      <button class="btn bv" style="flex:2" onclick="saveSchedItem(${i})">Save ✓</button>
      <button class="btn" style="flex:1;background:rgba(255,107,157,.15);color:var(--rose);border:1px solid rgba(255,107,157,.25)" onclick="deleteSchedItem(${i})">🗑 Del</button>
    </div>
  `);
}

function saveSchedItem(i) {
  const time  = document.getElementById('si-time').value.trim();
  const e     = document.getElementById('si-emoji').value.trim() || '📌';
  const title = document.getElementById('si-title').value.trim();
  const sub   = document.getElementById('si-sub').value.trim();
  if (!time || !title) { showToast('Please fill in time and title'); return; }
  const COLORS = ['#38bdf8','#34d399','#fbbf24','#f97316','#ff6b9d','#a855f7'];
  const item = { id: Date.now(), time, title, sub, e, c: COLORS[Math.floor(Math.random() * COLORS.length)], done: false };
  if (i === -1) S.schedule.push(item);
  else { item.done = S.schedule[i].done; item.c = S.schedule[i].c; S.schedule[i] = item; }
  save(); renderSchedule(); closeModalDirect();
  showToast(i === -1 ? 'Added to schedule! 🗓' : 'Schedule updated! ✅');
}

function deleteSchedItem(i) { S.schedule.splice(i, 1); save(); renderSchedule(); closeModalDirect(); showToast('Schedule item removed'); }

// ─────────────────────────────────────────
// PROGRESS
// ─────────────────────────────────────────
function logWeight() {
  const w = parseFloat(document.getElementById('wIn').value);
  if (!w || w < 20 || w > 300) { showToast('Enter a valid weight'); return; }
  const d = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  S.weights.unshift({ kg: w, d });
  save();
  document.getElementById('wIn').value = '';
  renderWeights();
  showToast('⚖️ ' + w + ' kg logged!');
}

function renderWeights() {
  const el = document.getElementById('wList');
  if (!el) return;
  if (!S.weights.length) {
    el.innerHTML = '<div style="text-align:center;padding:14px;color:var(--tsoft);font-size:13px">No entries yet ⚖️</div>';
    return;
  }
  el.innerHTML = S.weights.slice(0, 7).map((w, i) => {
    const prev = S.weights[i + 1];
    let diff = '';
    if (prev) {
      const d = (w.kg - prev.kg).toFixed(1);
      diff = `<span class="wedi ${d <= 0 ? 'down' : 'up'}">${d <= 0 ? '↓' : '↑'} ${Math.abs(d)}kg</span>`;
    }
    return `<div class="we"><span class="wed">${w.d}</span><span class="wev">${w.kg} kg</span>${diff}</div>`;
  }).join('');
}

function calcBMI() {
  const w = parseFloat(document.getElementById('bW').value);
  const h = parseFloat(document.getElementById('bH').value) / 100;
  if (!w || !h || h <= 0) { showToast('Enter valid weight and height'); return; }
  const bmi = (w / (h * h)).toFixed(1);
  let cat, cls;
  if (bmi < 18.5)      { cat = 'Underweight'; cls = 'bvi'; }
  else if (bmi < 25)   { cat = 'Normal ✅';    cls = 'bm';  }
  else if (bmi < 30)   { cat = 'Overweight';  cls = 'bgo'; }
  else                  { cat = 'Obese';       cls = 'bro'; }
  txt('bmiVal', bmi);
  const c = document.getElementById('bmiCat');
  if (c) { c.textContent = cat; c.className = 'badge ' + cls; }
  const out = document.getElementById('bmiOut');
  if (out) out.style.display = 'block';
  showToast('BMI: ' + bmi + ' — ' + cat);
}

function renderAchievements() {
  const tc = S.meals.reduce((s, m) => s + m.cals, 0);
  const achs = [
    { e:'🌸', t:'First Bloom',     d:'Started your wellness journey',     ok: true },
    { e:'💧', t:'Hydration Hero',  d:'Drank 2L of water in a day',        ok: S.water >= S.waterGoal },
    { e:'👟', t:'Step Champion',   d:'Reached your daily step goal',      ok: S.steps >= S.stepGoal },
    { e:'🥗', t:'Mindful Eater',   d:'Logged 3+ meals in a day',          ok: S.meals.length >= 3 },
    { e:'⚖️', t:'Weight Watcher', d:'Logged weight 3 times',             ok: S.weights.length >= 3 },
    { e:'🔥', t:'5K Steps',        d:'Walked 5,000+ steps',               ok: S.steps >= 5000 },
    { e:'⚡', t:'Calorie Aware',   d:'Stayed within 1,500 kcal goal',     ok: tc > 0 && tc <= 1500 },
    { e:'💓', t:'Heart Healthy',   d:'Measured heart rate once',          ok: S.hrLog.length > 0 },
    { e:'🏆', t:'Week Warrior',    d:'7-day perfect streak',              ok: false },
  ];
  const el = document.getElementById('achList');
  if (!el) return;
  el.innerHTML = achs.map(a =>
    `<div class="ach ${a.ok ? 'earned' : ''}">
      <div class="achi">${a.e}</div>
      <div><div class="acht">${a.t}</div><div class="achd">${a.d}</div></div>
      <div style="font-size:18px;margin-left:auto">${a.ok ? '✅' : '🔒'}</div>
    </div>`
  ).join('');
}

function renderStreak() {
  const days = ['M','T','W','T','F','S','S'];
  const d  = new Date().getDay();
  const ti = d === 0 ? 6 : d - 1;
  const el = document.getElementById('streakRow');
  if (!el) return;
  el.innerHTML = days.map((day, i) => {
    const cls = i === ti ? 'today' : i < ti ? 'done' : 'empty';
    return `<div class="sd ${cls}"><div>${i < ti ? '✓' : i === ti ? '★' : ''}</div><div class="dl">${day}</div></div>`;
  }).join('');
}

// ─────────────────────────────────────────
// MASTER UI UPDATE
// ─────────────────────────────────────────
function updateAll() {
  const sp = Math.min(S.steps / S.stepGoal, 1);
  const wp = Math.min(S.water / S.waterGoal, 1);
  const tc   = S.meals.reduce((s, m) => s + m.cals, 0);
  const tcarb = S.meals.reduce((s, m) => s + (m.carbs || 0), 0);
  const tprot = S.meals.reduce((s, m) => s + (m.prot  || 0), 0);
  const tfat  = S.meals.reduce((s, m) => s + (m.fat   || 0), 0);
  const tfib  = S.meals.reduce((s, m) => s + (m.fib   || 0), 0);
  const cp     = Math.min(tc / S.calTarget, 1);
  const burned = Math.round(S.steps * 0.042);
  const dist   = (S.steps * 0.00076).toFixed(1);
  const wml    = S.water * 250;

  // Step ring (r=45, circumference = 2π×45 ≈ 282.7)
  const circ = 282.7;
  sel('sring', 'stroke-dashoffset', (circ - sp * circ).toFixed(1));
  txt('rcnt', S.steps.toLocaleString());
  txt('spct', Math.round(sp * 100) + '%');
  txt('goalLbl', S.stepGoal.toLocaleString());
  txt('smsg',
    sp >= 1    ? '🎉 GOAL COMPLETE! Champion!' :
    sp >= 0.75 ? 'Almost there! Push a little more! 🏃‍♀️' :
    sp >= 0.5  ? 'Halfway! Keep going! 💪' :
    sp >= 0.25 ? 'Great start! Keep moving! 🌸' :
                 'Start moving — vehicle filter ON 🛡️'
  );
  txt('calBurned', burned);
  txt('distEl', dist + 'km');
  txt('stepConfBadge', 'Conf: ' + BloomSensors.getStepConfidence() + '%');

  // Water arc (r=35, circ=219.9)
  const wcirc = 219.9;
  sel('warc', 'stroke-dashoffset', (wcirc - wp * wcirc).toFixed(1));
  txt('wml',  wml);
  txt('wbig', wml + ' ml');
  txt('wpct', Math.round(wp * 100) + '% hydrated 💧');

  // Home stats
  txt('hs-s', S.steps.toLocaleString());
  txt('hs-w', wml + 'ml');
  txt('hs-c', tc);
  txt('hs-b', burned);

  // Progress bars
  pw('pb-s', sp * 100); pw('pb-w', wp * 100); pw('pb-c', cp * 100);
  txt('pl-s', S.steps.toLocaleString() + '/' + S.stepGoal.toLocaleString());
  txt('pl-w', wml + '/2,000ml');
  txt('pl-c', tc + '/1,500kcal');

  // Diet
  txt('dc-in',  tc);
  txt('dc-rem', Math.max(0, S.calTarget - tc));
  ph('mb-c', Math.min(tcarb / 200 * 100, 100));
  ph('mb-p', Math.min(tprot / 120 * 100, 100));
  ph('mb-f', Math.min(tfat  / 60  * 100, 100));
  ph('mb-fi', Math.min(tfib / 30  * 100, 100));
  txt('mv-c', tcarb + 'g'); txt('mv-p', tprot + 'g');
  txt('mv-f', tfat  + 'g'); txt('mv-fi', tfib  + 'g');

  renderGlasses(); renderMeals(); renderWeights();
  renderAchievements(); renderStreak();

  // Sensor UI state
  if (BloomSensors.stepIsOn()) setSensorUI('active');
  else setSensorUI('idle');
}

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function sel(id, attr, val) { const e = document.getElementById(id); if (e) e.setAttribute(attr, val); }
function txt(id, val)       { const e = document.getElementById(id); if (e) e.textContent = val; }
function pw(id, pct)        { const e = document.getElementById(id); if (e) e.style.width  = Math.min(pct, 100) + '%'; }
function ph(id, pct)        { const e = document.getElementById(id); if (e) e.style.height = Math.min(pct, 100) + '%'; }

// ─────────────────────────────────────────
// MODAL
// ─────────────────────────────────────────
function openModal(title, bodyHTML) {
  txt('modalTitle', title);
  const mb = document.getElementById('modalBody');
  if (mb) mb.innerHTML = bodyHTML;
  document.getElementById('editModal')?.classList.add('open');
  setTimeout(() => { document.querySelector('#modalBody input,#modalBody textarea')?.focus(); }, 350);
}

function closeModal(e)   { if (e.target === document.getElementById('editModal')) closeModalDirect(); }
function closeModalDirect() { document.getElementById('editModal')?.classList.remove('open'); }

// ─────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ─────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────
async function requestNotif() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') { S.notifGranted = true; return true; }
  const r = await Notification.requestPermission();
  S.notifGranted = r === 'granted';
  save();
  return S.notifGranted;
}

function sendNotif(title, body) {
  if (!S.notifGranted || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      vibrate: [200, 80, 200],
      tag: title,
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🌸</text></svg>',
    });
    setTimeout(() => n.close(), 6000);
  } catch (e) {}
}

function testNotif() {
  if (!S.notifGranted) {
    requestNotif().then(ok => {
      if (ok) {
        document.getElementById('ndot')?.classList.add('on');
        sendNotif('🌸 Bloom Notifications Active!', 'Reminders for water, steps & meals enabled!');
      } else {
        showToast('Allow notifications in browser/OS settings 🔔');
      }
    });
  } else {
    sendNotif('🌸 Bloom Reminder', `Keep going, ${S.userName}! Every step counts! 💪`);
    showToast('Test notification sent! 🔔');
  }
}

function startReminderLoop() {
  setInterval(() => {
    if (S.reminders[0]?.on && S.water < S.waterGoal)
      sendNotif('💧 Time to Drink Water!', `${S.userName}, ${S.water * 250}ml so far. Drink one more glass! 🌊`);
  }, 2 * 60 * 60 * 1000);

  setInterval(() => {
    const h = new Date().getHours();
    if (h === 18 && S.reminders[1]?.on && S.steps < S.stepGoal)
      sendNotif('👟 Step Goal Reminder!', `${(S.stepGoal - S.steps).toLocaleString()} more steps to go, ${S.userName}!`);
    if (h === 7  && S.reminders[2]?.on) sendNotif('🥣 Breakfast Time!', 'Start your day with a healthy breakfast!');
    if (h === 12 && S.reminders[2]?.on) sendNotif('🍽️ Lunch Time!', 'Time for a nourishing lunch!');
    if (h === 19 && S.reminders[2]?.on) sendNotif('🌙 Dinner Time!', 'Light and healthy dinner time!');
  }, 60 * 60 * 1000);
}

// ─────────────────────────────────────────
// QUOTES & TIPS
// ─────────────────────────────────────────
const QUOTES = [
  '"Every step you take is a vote for the healthier version of you."',
  '"Small steps every day create extraordinary results."',
  '"Your body is your home — keep it healthy and it will keep you strong."',
  '"Progress, not perfection. You are doing amazing! 💪"',
  '"Drink water, move your body, nourish your soul."',
  '"You didn\'t come this far to only come this far. 🦋"',
  '"A journey of a thousand miles begins with a single step."',
];
const TIPS = [
  '"Hit 8,000 steps and drink 2L water today. You\'ve got this! 💪"',
  '"Eat slowly — it helps you feel full on less food! 🥗"',
  '"Morning walks before breakfast burn more fat. Try it! 🌅"',
  '"Sleep well tonight — poor sleep increases hunger hormones 😴"',
  '"Protein at every meal keeps you full longer. Add egg or paneer! 🥚"',
  '"Consistency beats perfection every single time 🌸"',
];

// ─────────────────────────────────────────
// INIT
// ─────────────────────────────────────────
async function init() {
  if (S.userName) {
    document.getElementById('onboard')?.classList.add('gone');
    const mainApp = document.getElementById('mainApp');
    if (mainApp) mainApp.style.display = '';
    txt('hdrName', S.userName);
    checkDayReset();
    registerSW();

    // Biometric lock check
    const unlocked = await tryBiometricLock();
    if (!unlocked) return;

    if (S.notifGranted) {
      document.getElementById('ndot')?.classList.add('on');
      startReminderLoop();
    }
    maybeResumeSensor();
    updateAll();
    renderSchedule();
    renderPlan();
    renderSensorsPage();
    BloomSensors.initBattery();
    BloomSensors.initAmbientLight();
  } else {
    document.getElementById('obName')?.focus();
  }

  txt('quoteEl', QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  txt('tipEl',   TIPS[Math.floor(Math.random() * TIPS.length)]);
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { checkDayReset(); updateAll(); }
});

document.body.addEventListener('touchmove',
  e => { if (e.target === document.body) e.preventDefault(); },
  { passive: false }
);

init();