// movements/body_scan.js
// 3-scan body composition: Front → Side → Back

const L = {
  NOSE: 0,
  L_SHOULDER: 11, R_SHOULDER: 12,
  L_ELBOW: 13,    R_ELBOW: 14,
  L_WRIST: 15,    R_WRIST: 16,
  L_HIP: 23,      R_HIP: 24,
  L_KNEE: 25,     R_KNEE: 26,
  L_ANKLE: 27,    R_ANKLE: 28
};

const STEPS = [
  { key: 'front', label: 'Front', hint: 'Face the camera — arms slightly out, full body visible', btn: '📸 Scan Front' },
  { key: 'side',  label: 'Side',  hint: 'Turn 90° to your RIGHT — left shoulder toward camera, arms at sides', btn: '📸 Scan Side' },
  { key: 'back',  label: 'Back',  hint: 'Turn 180° — back to camera, feet shoulder-width apart', btn: '📸 Scan Back' },
];

let _raf = null;

export function initBodyScanUI(container, poseDetector, onBack) {
  if (_raf) { cancelAnimationFrame(_raf); _raf = null; }

  container.innerHTML = `
    <div class="scan-screen">
      <div class="scan-camera-wrap" id="scan-camera-wrap">
        <canvas id="scan-canvas" class="scan-canvas"></canvas>

        <!-- Form overlay (step 0) -->
        <div id="scan-form-overlay" class="scan-form-overlay">
          <h2 class="scan-form-title">Body Composition Scan</h2>
          <p class="scan-form-sub">3 poses · ~30 seconds · accurate BF% estimate</p>
          <div class="scan-form-grid">
            <div class="scan-field">
              <label class="scan-label">Height (cm)</label>
              <input type="number" id="sf-height" class="scan-input" placeholder="175" min="100" max="250" />
            </div>
            <div class="scan-field">
              <label class="scan-label">Weight (kg)</label>
              <input type="number" id="sf-weight" class="scan-input" placeholder="75" min="30" max="300" />
            </div>
            <div class="scan-field">
              <label class="scan-label">Age</label>
              <input type="number" id="sf-age" class="scan-input" placeholder="30" min="10" max="100" />
            </div>
            <div class="scan-field">
              <label class="scan-label">Sex</label>
              <select id="sf-sex" class="scan-select">
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>
          <button id="openCameraBtn" class="btn-scan-ready">Open Camera →</button>
        </div>

        <!-- Step indicator (shown during scanning) -->
        <div id="scan-step-bar" class="scan-step-bar hidden">
          ${STEPS.map((s,i) => `<div class="scan-step-pill" id="step-pill-${i}">${s.label}</div>`).join('')}
        </div>

        <!-- Hint + countdown -->
        <div id="scan-hint" class="scan-hint hidden"></div>
        <div id="scan-big-count" class="scan-big-count hidden"></div>
      </div>

      <div class="scan-footer">
        <p id="scan-status" class="scan-status-text"></p>
        <div class="scan-actions">
          <button id="startScanBtn" class="btn-scan-start hidden">📸 Start Scan</button>
          <button id="backFromScanBtn" class="btn-scan-back">← Back</button>
        </div>
        <div id="scan-metrics-row" class="scan-metrics-row hidden"></div>
      </div>
    </div>
  `;

  const canvas = document.getElementById('scan-canvas');
  const wrap   = document.getElementById('scan-camera-wrap');
  const ctx    = canvas.getContext('2d');
  const video  = window.video;

  let liveActive = false;
  let stepIndex  = -1; // -1 = form, 0=front, 1=side, 2=back, 3=done
  let userData   = null;
  const captures = []; // [{photo, kp}] — one per step

  function syncSize() {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
      canvas.width = w; canvas.height = h;
    }
  }

  function liveLoop() {
    if (!liveActive) return;
    syncSize();
    const W = canvas.width, H = canvas.height;
    if (video?.readyState >= 2 && video.videoWidth) {
      const { dx, dy, dw, dh } = letterbox(video.videoWidth, video.videoHeight, W, H);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(video, dx, dy, dw, dh);
      try {
        const r = poseDetector.detectForVideo(video, performance.now());
        if (r?.landmarks?.[0]) drawSkeletonOnCtx(ctx, r.landmarks[0], dx, dy, dw, dh);
      } catch {}
    } else {
      ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W || 640, H || 480);
    }
    _raf = requestAnimationFrame(liveLoop);
  }

  function updateStepUI(idx) {
    const step = STEPS[idx];
    document.getElementById('scan-hint').textContent = step.hint;
    document.getElementById('startScanBtn').textContent = step.btn;
    document.getElementById('startScanBtn').disabled = false;
    // Step pills
    STEPS.forEach((_, i) => {
      const pill = document.getElementById(`step-pill-${i}`);
      pill.classList.toggle('done',   i < idx);
      pill.classList.toggle('active', i === idx);
    });
    document.getElementById('scan-status').textContent =
      `Step ${idx + 1} of 3 — ${step.hint.split('—')[0].trim()}`;
  }

  // ── Form submit ───────────────────────────────────────────────
  document.getElementById('openCameraBtn').addEventListener('click', () => {
    const h   = parseFloat(document.getElementById('sf-height').value);
    const w   = parseFloat(document.getElementById('sf-weight').value);
    const age = parseFloat(document.getElementById('sf-age').value);
    const sex = document.getElementById('sf-sex').value;
    const sub = document.querySelector('.scan-form-sub');

    if (!h || !w || !age || h < 100 || h > 250 || w < 30 || w > 300 || age < 10 || age > 100) {
      sub.textContent = '⚠ Fill in all fields correctly.';
      sub.style.color = '#ff7a00';
      return;
    }
    userData = { height_cm: h, weight_kg: w, age, sex };

    document.getElementById('scan-form-overlay').classList.add('hidden');
    document.getElementById('scan-step-bar').classList.remove('hidden');
    document.getElementById('scan-hint').classList.remove('hidden');
    document.getElementById('startScanBtn').classList.remove('hidden');

    stepIndex = 0;
    updateStepUI(0);
    liveActive = true;
    liveLoop();
  });

  // ── Back button ───────────────────────────────────────────────
  document.getElementById('backFromScanBtn').addEventListener('click', () => {
    liveActive = false;
    cancelAnimationFrame(_raf); _raf = null;
    if (onBack) onBack();
  });

  // ── Scan button ───────────────────────────────────────────────
  document.getElementById('startScanBtn').addEventListener('click', async () => {
    const startBtn = document.getElementById('startScanBtn');
    const statusEl = document.getElementById('scan-status');
    const bigCount = document.getElementById('scan-big-count');
    const hint     = document.getElementById('scan-hint');

    startBtn.disabled = true;
    hint.classList.add('hidden');
    bigCount.classList.remove('hidden');

    for (let i = 5; i > 0; i--) {
      bigCount.textContent = i;
      statusEl.textContent = `${STEPS[stepIndex].label} scan in ${i}s…`;
      await new Promise(r => setTimeout(r, 1000));
    }
    bigCount.textContent = '📸';
    statusEl.textContent = 'Analysing…';
    await new Promise(r => setTimeout(r, 300));

    try {
      const photo = captureFrame(video);
      const kp    = await capturePose(poseDetector);

      captures[stepIndex] = { photo, kp };
      bigCount.classList.add('hidden');

      if (stepIndex < STEPS.length - 1) {
        // Advance to next step
        stepIndex++;
        updateStepUI(stepIndex);
        hint.classList.remove('hidden');
      } else {
        // All 3 done
        liveActive = false;
        cancelAnimationFrame(_raf); _raf = null;

        hint.classList.add('hidden');
        startBtn.classList.add('hidden');

        syncSize();
        const result = computeResults(captures, userData);
        drawResults(canvas, result, captures);

        const metricsRow = document.getElementById('scan-metrics-row');
        metricsRow.innerHTML = buildMetricsHTML(result);
        metricsRow.classList.remove('hidden');

        statusEl.textContent = 'Scan complete ✓';
        saveScan(result);

        const againBtn = document.createElement('button');
        againBtn.className = 'btn-scan-start';
        againBtn.textContent = '🔄 Scan Again';
        againBtn.addEventListener('click', () => initBodyScanUI(container, poseDetector, onBack));
        document.querySelector('.scan-actions').prepend(againBtn);
      }
    } catch (err) {
      bigCount.classList.add('hidden');
      hint.classList.remove('hidden');
      statusEl.textContent = `❌ ${err.message}`;
      startBtn.disabled = false;
    }
  });
}

// ── Live skeleton overlay ─────────────────────────────────────────────────────

function drawSkeletonOnCtx(ctx, kp, dx, dy, dw, dh) {
  const toX = nx => dx + nx * dw;
  const toY = ny => dy + ny * dh;
  const segs = [
    [11,12],[11,23],[12,24],[23,24],
    [11,13],[13,15],[12,14],[14,16],
    [23,25],[25,27],[24,26],[26,28],
    [0,11],[0,12]
  ];
  ctx.strokeStyle = 'rgba(0,255,194,0.85)';
  ctx.lineWidth   = 3;
  segs.forEach(([a,b]) => {
    if (!kp[a] || !kp[b]) return;
    ctx.beginPath();
    ctx.moveTo(toX(kp[a].x), toY(kp[a].y));
    ctx.lineTo(toX(kp[b].x), toY(kp[b].y));
    ctx.stroke();
  });
  ctx.fillStyle = 'rgba(255,165,0,0.9)';
  [0,11,12,13,14,15,16,23,24,25,26,27,28].forEach(i => {
    const p = kp[i]; if (!p) return;
    ctx.beginPath(); ctx.arc(toX(p.x), toY(p.y), 5, 0, Math.PI*2); ctx.fill();
  });
}

// ── Capture ───────────────────────────────────────────────────────────────────

function captureFrame(video) {
  const c = document.createElement('canvas');
  c.width  = video.videoWidth  || 640;
  c.height = video.videoHeight || 480;
  c.getContext('2d').drawImage(video, 0, 0);
  return c;
}

async function capturePose(poseDetector) {
  const video = window.video;
  if (!video || !video.videoWidth) throw new Error('Camera not ready');
  const frames = [];
  for (let i = 0; i < 15; i++) {
    const r = poseDetector.detectForVideo(video, performance.now());
    if (r?.landmarks?.[0]?.length) frames.push(r.landmarks[0]);
    await new Promise(r => setTimeout(r, 80));
  }
  if (frames.length < 5) throw new Error('Not enough pose data — stand further back');
  return avgLandmarks(frames);
}

function avgLandmarks(frames) {
  const n = frames[0].length, c = frames.length;
  return Array.from({ length: n }, (_, i) => ({
    x: frames.reduce((s,f) => s + f[i].x, 0) / c,
    y: frames.reduce((s,f) => s + f[i].y, 0) / c,
    z: frames.reduce((s,f) => s + (f[i].z ?? 0), 0) / c,
  }));
}

// ── Analysis ──────────────────────────────────────────────────────────────────

function computeResults(captures, user) {
  const { height_cm, weight_kg, age, sex } = user;
  const h = height_cm / 100;
  const bmi = weight_kg / (h * h);
  const isMale = sex === 'male' ? 1 : 0;

  // ── Front measurements ──
  const fKp = captures[0]?.kp;
  const ls  = fKp?.[L.L_SHOULDER], rs = fKp?.[L.R_SHOULDER];
  const lh  = fKp?.[L.L_HIP],     rh = fKp?.[L.R_HIP];
  const lk  = fKp?.[L.L_KNEE],    rk = fKp?.[L.R_KNEE];
  const shoulderWidthF = (ls && rs) ? Math.abs(ls.x - rs.x) : 0.25;
  const hipWidthF      = (lh && rh) ? Math.abs(lh.x - rh.x) : 0.20;
  const kneeWidthF     = (lk && rk) ? Math.abs(lk.x - rk.x) : 0.15;
  const shr            = hipWidthF > 0.01 ? shoulderWidthF / hipWidthF : 1.1;
  const shoulderTilt   = (ls && rs && shoulderWidthF > 0) ? Math.abs(ls.y - rs.y) / shoulderWidthF : 0;
  const hipTilt        = (lh && rh && hipWidthF > 0)      ? Math.abs(lh.y - rh.y) / hipWidthF      : 0;
  const symmetry       = Math.max(0, Math.min(100, 100 - (shoulderTilt + hipTilt) * 180));

  // ── Side measurements ──
  const sKp = captures[1]?.kp;
  let bellyRatio = 1.0, shoulderDepth = 0.15, hipDepth = 0.15;
  let headForwardNorm = 0;
  if (sKp) {
    const sls = sKp[L.L_SHOULDER], srs = sKp[L.R_SHOULDER];
    const slh = sKp[L.L_HIP],     srh = sKp[L.R_HIP];
    const snose = sKp[L.NOSE];
    if (sls && srs) shoulderDepth = Math.abs(sls.x - srs.x);
    if (slh && srh) hipDepth      = Math.abs(slh.x - srh.x);
    bellyRatio = shoulderDepth > 0.01 ? hipDepth / shoulderDepth : 1.0;
    if (snose && sls) {
      const frontShoulderX = Math.min(sls.x, sKp[L.R_SHOULDER]?.x ?? sls.x);
      headForwardNorm = Math.max(0, (frontShoulderX - snose.x) / (shoulderDepth || 0.01));
    }
  }

  // ── Back measurements ──
  const bKp = captures[2]?.kp;
  let shoulderWidthB = shoulderWidthF, hipWidthB = hipWidthF, backSymmetry = symmetry;
  if (bKp) {
    const bls = bKp[L.L_SHOULDER], brs = bKp[L.R_SHOULDER];
    const blh = bKp[L.L_HIP],     brh = bKp[L.R_HIP];
    if (bls && brs) shoulderWidthB = Math.abs(bls.x - brs.x);
    if (blh && brh) hipWidthB      = Math.abs(blh.x - brh.x);
    const bShoulderTilt = (bls && brs && shoulderWidthB > 0) ? Math.abs(bls.y - brs.y) / shoulderWidthB : 0;
    const bHipTilt      = (blh && brh && hipWidthB > 0)      ? Math.abs(blh.y - brh.y) / hipWidthB      : 0;
    backSymmetry = Math.max(0, Math.min(100, 100 - (bShoulderTilt + bHipTilt) * 180));
  }

  // ── BF% estimate ──
  // Layer 1: Deurenberg base
  let bf = (1.20 * bmi) + (0.23 * age) - (10.8 * isMale) - 5.4;
  // Layer 2: front V-taper (reference 1.35 = typical fit male SHR)
  bf += (1.35 - shr) * 6;
  // Layer 3: side belly protrusion
  bf += clamp((bellyRatio - 1.0) * 8, -4, 4);
  // Layer 4: back confirmation (high back hip width vs front shoulder → more fat)
  const backFactor = (shoulderWidthF > 0.01) ? (hipWidthB / shoulderWidthF) : 1.0;
  bf += clamp((backFactor - 0.85) * 4, -2, 2);
  bf = Math.max(3, Math.min(50, Math.round(bf * 10) / 10));

  const postureScore = Math.max(0, Math.min(100, 100 - headForwardNorm * 80));
  const overallSymmetry = Math.round((symmetry + backSymmetry) / 2);

  return {
    bf,
    bfCategory:  getBFCategory(bf, sex),
    bmi:         bmi.toFixed(1),
    bmiCategory: getBMICategory(bmi),
    shr:         shr.toFixed(2),
    symmetry:    overallSymmetry,
    postureScore: Math.round(postureScore),
    bellyRatio:  bellyRatio.toFixed(2),
    shoulderWidth: (shoulderWidthF * 100).toFixed(1),
    hipWidth:      (hipWidthF * 100).toFixed(1),
    // raw for heatmap
    _shr: shr, _hipWidthF: hipWidthF, _shoulderWidthF: shoulderWidthF,
    _kneeWidthF: kneeWidthF, _bellyRatio: bellyRatio, _backSymmetry: backSymmetry,
    _headForwardNorm: headForwardNorm, _hipWidthB: hipWidthB, _base: clamp(bf / 30),
    sex,
  };
}

function getBFCategory(bf, sex) {
  if (sex === 'male') {
    if (bf < 6)  return 'Essential';
    if (bf < 14) return 'Athletic';
    if (bf < 18) return 'Fit';
    if (bf < 25) return 'Average';
    return 'High';
  }
  if (bf < 14) return 'Essential';
  if (bf < 21) return 'Athletic';
  if (bf < 25) return 'Fit';
  if (bf < 32) return 'Average';
  return 'High';
}

function getBMICategory(bmi) {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25)   return 'Normal';
  if (bmi < 30)   return 'Overweight';
  return 'Obese';
}

// ── Results canvas ────────────────────────────────────────────────────────────

function drawResults(canvas, m, captures) {
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  const count  = captures.filter(Boolean).length;
  const colW   = Math.floor(W / count);
  const labels = ['FRONT', 'SIDE', 'BACK'];

  captures.forEach((cap, i) => {
    if (!cap) return;
    const offX = i * colW;
    const lb   = coverfit(cap.photo.width, cap.photo.height, colW, H);

    // Draw photo clipped to column
    ctx.save();
    ctx.beginPath();
    ctx.rect(offX, 0, colW, H);
    ctx.clip();
    ctx.drawImage(cap.photo, offX + lb.dx, lb.dy, lb.dw, lb.dh);
    // Darken overlay
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.fillRect(offX, 0, colW, H);
    ctx.restore();
    // Column label
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.font = `700 ${Math.round(H * 0.018)}px Manrope, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(labels[i], offX + colW / 2, H - 6);

    // Divider
    if (i > 0) {
      ctx.strokeStyle = '#2a2a2a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(offX, 0); ctx.lineTo(offX, H);
      ctx.stroke();
    }

    // Per-view overlays
    const kp = cap.kp;
    if (!kp) return;
    const ox = offX + lb.dx, oy = lb.dy, ow = lb.dw, oh = lb.dh;

    if (i === 0) drawFrontDots(ctx, kp, ox, oy, ow, oh, m);
    if (i === 1) drawSideOverlays(ctx, kp, ox, oy, ow, oh, m);
    if (i === 2) drawBackDots(ctx, kp, ox, oy, ow, oh, m);
  });

  // BF badge (top-left of first column)
  drawBFBadge(ctx, m, colW, H);
}

// ── Front dots ────────────────────────────────────────────────────────────────

function drawFrontDots(ctx, kp, dx, dy, dw, dh, m) {
  const { _shr: shr, _hipWidthF: hWn, _shoulderWidthF: sWn, _kneeWidthF: kWn, _base: base, bf } = m;
  const base2 = clamp(bf / 30);
  const c = {
    shoulders: clamp(base2 * 0.45),
    belly:     clamp(base2 + Math.max(0, 1.1 - shr) * 0.6),
    hips:      clamp(base2 + Math.max(0, 1.0 - shr) * 0.7),
    arms:      clamp(base2 * 0.65),
    thighs:    clamp(base2 * 0.85 + clamp((kWn - 0.09) / 0.09) * 0.3),
    calves:    clamp(base2 * 0.35),
  };
  const zoneBF = concern => Math.round(clamp(bf * (base2 > 0.01 ? concern / base2 : 1), 3, 50));

  const toX = nx => dx + nx * dw;
  const toY = ny => dy + ny * dh;
  const ls = kp[L.L_SHOULDER], rs = kp[L.R_SHOULDER];
  const lh = kp[L.L_HIP],     rh = kp[L.R_HIP];
  const rk = kp[L.R_KNEE],    ra = kp[L.R_ANKLE];
  const re = kp[L.R_ELBOW];
  if (!ls || !rs || !lh || !rh) return;

  const dotR = Math.max(7, dh * 0.015);
  const dot = (cx, cy, concern, lbl) => {
    const col = zoneColor(concern);
    ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 18;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(cx, cy, dotR, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, dotR, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.font = `700 ${Math.round(dh*0.028)}px Manrope, sans-serif`;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = col; ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 8;
    ctx.fillText(lbl, cx + dotR + dw*0.025, cy);
    ctx.restore();
  };

  const sCx = (toX(ls.x)+toX(rs.x))/2, sCy = (toY(ls.y)+toY(rs.y))/2;
  const hCx = (toX(lh.x)+toX(rh.x))/2, hCy = (toY(lh.y)+toY(rh.y))/2;
  dot(sCx, sCy, c.shoulders, `Shoulders ${zoneBF(c.shoulders)}%`);
  dot(hCx, lerp(sCy,hCy,0.55), c.belly, `Belly ${zoneBF(c.belly)}%`);
  dot(hCx, hCy, c.hips, `Hips ${zoneBF(c.hips)}%`);
  if (re) dot((toX(rs.x)+toX(re.x))/2, (toY(rs.y)+toY(re.y))/2, c.arms, `Arms ${zoneBF(c.arms)}%`);
  if (rk) dot((toX(rh.x)+toX(rk.x))/2, (toY(rh.y)+toY(rk.y))/2, c.thighs, `Thighs ${zoneBF(c.thighs)}%`);
  if (rk && ra) dot((toX(rk.x)+toX(ra.x))/2, (toY(rk.y)+toY(ra.y))/2, c.calves, `Calves ${zoneBF(c.calves)}%`);
}

// ── Side overlays ─────────────────────────────────────────────────────────────

function drawSideOverlays(ctx, kp, dx, dy, dw, dh, m) {
  const toX = nx => dx + nx * dw;
  const toY = ny => dy + ny * dh;
  const ls   = kp[L.L_SHOULDER], rs  = kp[L.R_SHOULDER];
  const lh   = kp[L.L_HIP],     rh  = kp[L.R_HIP];
  const la   = kp[L.L_ANKLE],   nose = kp[L.NOSE];
  if (!ls || !rs || !lh || !rh) return;

  const dotR = Math.max(7, dh * 0.015);
  const bRatio = parseFloat(m.bellyRatio);
  const bellyCol = bRatio > 1.15 ? '#ff7a00' : bRatio > 1.05 ? '#ffc700' : '#00e5a0';
  const postCol  = parseFloat(m.postureScore) > 75 ? '#00e5a0' : '#ffc700';

  // Plumb line (ideal posture vertical)
  if (la) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0,255,194,0.3)';
    ctx.setLineDash([5,4]); ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(toX(la.x), toY(nose?.y ?? ls.y) - dh*0.04);
    ctx.lineTo(toX(la.x), toY(la.y));
    ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }

  // Hip depth bracket
  const frontX = toX(Math.min(lh.x, rh.x));
  const backX  = toX(Math.max(lh.x, rh.x));
  const midY   = toY((lh.y + rh.y) / 2);
  ctx.save();
  ctx.strokeStyle = bellyCol; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(frontX, midY); ctx.lineTo(backX, midY); ctx.stroke();
  [frontX, backX].forEach(x => {
    ctx.beginPath(); ctx.moveTo(x, midY-7); ctx.lineTo(x, midY+7); ctx.stroke();
  });
  ctx.restore();
  ctx.save();
  ctx.font = `700 ${Math.round(dh*0.026)}px Manrope, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillStyle = bellyCol; ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 8;
  ctx.fillText(`Belly depth ${m.bellyRatio}×`, (frontX+backX)/2, midY - dh*0.015);
  ctx.restore();

  // Head posture dot
  if (nose) {
    ctx.save();
    ctx.shadowColor = postCol; ctx.shadowBlur = 18;
    ctx.fillStyle = postCol;
    ctx.beginPath(); ctx.arc(toX(nose.x), toY(nose.y), dotR, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.font = `700 ${Math.round(dh*0.026)}px Manrope, sans-serif`;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = postCol; ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 8;
    ctx.fillText(`Posture ${m.postureScore}%`, toX(nose.x) + dotR + dw*0.03, toY(nose.y));
    ctx.restore();
  }
}

// ── Back dots ─────────────────────────────────────────────────────────────────

function drawBackDots(ctx, kp, dx, dy, dw, dh, m) {
  const toX = nx => dx + nx * dw;
  const toY = ny => dy + ny * dh;
  const ls = kp[L.L_SHOULDER], rs = kp[L.R_SHOULDER];
  const lh = kp[L.L_HIP],     rh = kp[L.R_HIP];
  const lk = kp[L.L_KNEE],    rk = kp[L.R_KNEE];
  if (!ls || !rs || !lh || !rh) return;

  const bf   = m.bf;
  const base = clamp(bf / 30);
  const shr  = parseFloat(m.shr);
  const c = {
    upperBack: clamp(base * 0.4),
    lowerBack: clamp(base * 0.55 + Math.max(0, 1.0 - shr) * 0.3),
    glutes:    clamp(base + Math.max(0, 1.0 - shr) * 0.7),
    hamstrings:clamp(base * 0.75),
  };
  const zoneBF = concern => Math.round(clamp(bf * (base > 0.01 ? concern / base : 1), 3, 50));

  const dotR = Math.max(7, dh * 0.015);
  const dot  = (cx, cy, concern, lbl) => {
    const col = zoneColor(concern);
    ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 18;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(cx, cy, dotR, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, dotR, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.font = `700 ${Math.round(dh*0.028)}px Manrope, sans-serif`;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = col; ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 8;
    ctx.fillText(lbl, cx + dotR + dw*0.025, cy);
    ctx.restore();
  };

  const sCx = (toX(ls.x)+toX(rs.x))/2, sCy = (toY(ls.y)+toY(rs.y))/2;
  const hCx = (toX(lh.x)+toX(rh.x))/2, hCy = (toY(lh.y)+toY(rh.y))/2;

  dot(sCx, sCy, c.upperBack, `Upper back ${zoneBF(c.upperBack)}%`);
  dot(hCx, lerp(sCy,hCy,0.6), c.lowerBack, `Lower back ${zoneBF(c.lowerBack)}%`);
  dot(hCx, hCy, c.glutes, `Glutes ${zoneBF(c.glutes)}%`);
  if (lk && rk) {
    dot((toX(lh.x)+toX(lk.x))/2, (toY(lh.y)+toY(lk.y))/2,
        c.hamstrings, `Hamstrings ${zoneBF(c.hamstrings)}%`);
  }

  // Back symmetry score
  ctx.save();
  const symCol = m._backSymmetry > 80 ? '#00e5a0' : '#ffc700';
  ctx.font = `600 ${Math.round(dh*0.022)}px Manrope, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillStyle = symCol; ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 6;
  ctx.fillText(`Back symmetry ${Math.round(m._backSymmetry)}%`, dx + dw/2, dy + dh*0.04);
  ctx.restore();
}

// ── BF Badge ──────────────────────────────────────────────────────────────────

function drawBFBadge(ctx, m, colW, H) {
  const { bf, bfCategory, bmi, bmiCategory } = m;
  const col = bf < 18 ? '#00e5a0' : bf < 25 ? '#ffc700' : '#ff7a00';
  const bx = colW * 0.03, by = H * 0.03;
  const bw = colW * 0.88, bh = H * 0.135;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  roundRect(ctx, bx, by, bw, bh, 10); ctx.fill();
  ctx.strokeStyle = col + '55'; ctx.lineWidth = 1.5;
  roundRect(ctx, bx, by, bw, bh, 10); ctx.stroke();
  ctx.restore();

  ctx.textBaseline = 'middle';
  ctx.fillStyle = col;
  ctx.font = `700 ${Math.round(H*0.044)}px Manrope, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(`${bf}%`, bx + bw*0.08, by + bh*0.38);
  ctx.fillStyle = '#777';
  ctx.font = `600 ${Math.round(H*0.017)}px Manrope, sans-serif`;
  ctx.fillText('BODY FAT', bx + bw*0.08, by + bh*0.68);
  ctx.fillStyle = col;
  ctx.font = `700 ${Math.round(H*0.016)}px Manrope, sans-serif`;
  ctx.fillText(bfCategory.toUpperCase(), bx + bw*0.08, by + bh*0.90);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ccc';
  ctx.font = `700 ${Math.round(H*0.024)}px Manrope, sans-serif`;
  ctx.fillText(`BMI ${bmi}`, bx + bw*0.95, by + bh*0.40);
  ctx.fillStyle = '#555';
  ctx.font = `600 ${Math.round(H*0.015)}px Manrope, sans-serif`;
  ctx.fillText(bmiCategory, bx + bw*0.95, by + bh*0.70);
}

// ── Metrics strip ─────────────────────────────────────────────────────────────

function buildMetricsHTML(m) {
  return [
    { val: `${m.bf}%`,          lbl: 'Body Fat',  hi: true },
    { val: m.bmi,               lbl: 'BMI' },
    { val: m.shr,               lbl: 'S/H Ratio' },
    { val: `${m.symmetry}%`,    lbl: 'Symmetry' },
    { val: `${m.postureScore}%`,lbl: 'Posture' },
    { val: `${m.bellyRatio}×`,  lbl: 'Belly Depth' },
  ].map(({ val, lbl, hi }) => `
    <div class="scan-metric-chip">
      <span class="scan-metric-chip-val${hi ? ' scan-metric-chip-highlight' : ''}">${val}</span>
      <span class="scan-metric-chip-lbl">${lbl}</span>
    </div>`).join('');
}

// ── Persist ───────────────────────────────────────────────────────────────────

function saveScan(result) {
  try {
    const h = JSON.parse(localStorage.getItem('bodyScanHistory') || '[]');
    h.unshift({ bf: result.bf, bmi: result.bmi, symmetry: result.symmetry,
                postureScore: result.postureScore, timestamp: new Date().toISOString() });
    localStorage.setItem('bodyScanHistory', JSON.stringify(h.slice(0, 20)));
  } catch {}
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function letterbox(vw, vh, cw, ch) {
  const vr = vw / vh, cr = cw / ch;
  let dw, dh, dx, dy;
  if (vr > cr) { dw = cw; dh = cw / vr; dx = 0; dy = (ch - dh) / 2; }
  else         { dh = ch; dw = ch * vr; dy = 0; dx = (cw - dw) / 2; }
  return { dx, dy, dw, dh };
}

// Cover-fit: fills container, crops overflow (dx/dy may be negative)
function coverfit(vw, vh, cw, ch) {
  const vr = vw / vh, cr = cw / ch;
  let dw, dh, dx, dy;
  if (vr > cr) { dh = ch; dw = ch * vr; dy = 0; dx = (cw - dw) / 2; }
  else         { dw = cw; dh = cw / vr; dx = 0; dy = (ch - dh) / 2; }
  return { dx, dy, dw, dh };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}

function zoneColor(concern) {
  if (concern < 0.2) return '#00e5a0';
  if (concern < 0.4) return '#8fe000';
  if (concern < 0.6) return '#ffc700';
  if (concern < 0.8) return '#ff7a00';
  return '#ff3333';
}

function clamp(v, lo=0, hi=1) { return Math.max(lo, Math.min(hi, v)); }
function lerp(a, b, t) { return a + (b-a)*t; }
