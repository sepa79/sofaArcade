const uploadForm = document.querySelector('#upload-form');
const trackInput = document.querySelector('#track-input');
const compileButton = document.querySelector('#compile-btn');
const statusLabel = document.querySelector('#status');
const metaLabel = document.querySelector('#meta');
const player = document.querySelector('#player');
const downloadSyncLink = document.querySelector('#download-sync');
const downloadAudioLink = document.querySelector('#download-audio');
const canvas = document.querySelector('#preview');
const classicCanvas = document.querySelector('#classic-preview');

const lowGainInput = document.querySelector('#low-gain');
const midGainInput = document.querySelector('#mid-gain');
const highGainInput = document.querySelector('#high-gain');
const beatGainInput = document.querySelector('#beat-gain');
const midChaosInput = document.querySelector('#mid-chaos');
const midSpeedInput = document.querySelector('#mid-speed');

const lowGainValue = document.querySelector('#low-gain-value');
const midGainValue = document.querySelector('#mid-gain-value');
const highGainValue = document.querySelector('#high-gain-value');
const beatGainValue = document.querySelector('#beat-gain-value');
const midChaosValue = document.querySelector('#mid-chaos-value');
const midSpeedValue = document.querySelector('#mid-speed-value');

const showClassicInput = document.querySelector('#show-classic');

if (!(uploadForm instanceof HTMLFormElement)) {
  throw new Error('Missing #upload-form element.');
}
if (!(trackInput instanceof HTMLInputElement)) {
  throw new Error('Missing #track-input element.');
}
if (!(compileButton instanceof HTMLButtonElement)) {
  throw new Error('Missing #compile-btn element.');
}
if (!(statusLabel instanceof HTMLDivElement)) {
  throw new Error('Missing #status element.');
}
if (!(metaLabel instanceof HTMLDivElement)) {
  throw new Error('Missing #meta element.');
}
if (!(player instanceof HTMLAudioElement)) {
  throw new Error('Missing #player element.');
}
if (!(downloadSyncLink instanceof HTMLAnchorElement)) {
  throw new Error('Missing #download-sync element.');
}
if (!(downloadAudioLink instanceof HTMLAnchorElement)) {
  throw new Error('Missing #download-audio element.');
}
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Missing #preview element.');
}
if (!(classicCanvas instanceof HTMLCanvasElement)) {
  throw new Error('Missing #classic-preview element.');
}
if (!(lowGainInput instanceof HTMLInputElement)) {
  throw new Error('Missing #low-gain element.');
}
if (!(midGainInput instanceof HTMLInputElement)) {
  throw new Error('Missing #mid-gain element.');
}
if (!(highGainInput instanceof HTMLInputElement)) {
  throw new Error('Missing #high-gain element.');
}
if (!(beatGainInput instanceof HTMLInputElement)) {
  throw new Error('Missing #beat-gain element.');
}
if (!(midChaosInput instanceof HTMLInputElement)) {
  throw new Error('Missing #mid-chaos element.');
}
if (!(midSpeedInput instanceof HTMLInputElement)) {
  throw new Error('Missing #mid-speed element.');
}
if (!(lowGainValue instanceof HTMLOutputElement)) {
  throw new Error('Missing #low-gain-value element.');
}
if (!(midGainValue instanceof HTMLOutputElement)) {
  throw new Error('Missing #mid-gain-value element.');
}
if (!(highGainValue instanceof HTMLOutputElement)) {
  throw new Error('Missing #high-gain-value element.');
}
if (!(beatGainValue instanceof HTMLOutputElement)) {
  throw new Error('Missing #beat-gain-value element.');
}
if (!(midChaosValue instanceof HTMLOutputElement)) {
  throw new Error('Missing #mid-chaos-value element.');
}
if (!(midSpeedValue instanceof HTMLOutputElement)) {
  throw new Error('Missing #mid-speed-value element.');
}
if (!(showClassicInput instanceof HTMLInputElement)) {
  throw new Error('Missing #show-classic element.');
}

const context = canvas.getContext('2d');
if (context === null) {
  throw new Error('Canvas 2D context is unavailable.');
}

const classicContext = classicCanvas.getContext('2d');
if (classicContext === null) {
  throw new Error('Classic Canvas 2D context is unavailable.');
}

const STAR_COUNT = 120;
const PERSPECTIVE_TOP_SPACING = 28;
const PERSPECTIVE_BOTTOM_SPREAD = 8.8;
const HORIZON_LINE_COUNT = 16;

const controls = {
  lowGain: 1,
  midGain: 1,
  highGain: 1,
  beatGain: 1,
  midChaos: 1,
  midSpeed: 1,
  showClassic: true
};

let syncTrack = null;
let lastPreviewTime = 0;
let lastFrameMs = performance.now();
let beatPulse = 0;
let stars = createStars(STAR_COUNT, canvas.width, canvas.height);

function setStatus(text) {
  statusLabel.textContent = `Status: ${text}`;
}

function disableDownloadLink(link) {
  link.classList.add('disabled');
  link.setAttribute('aria-disabled', 'true');
  link.removeAttribute('href');
  link.removeAttribute('download');
}

function enableDownloadLink(link, href, fileName) {
  link.href = href;
  link.download = fileName;
  link.classList.remove('disabled');
  link.setAttribute('aria-disabled', 'false');
}

function clearResultLinks() {
  disableDownloadLink(downloadSyncLink);
  disableDownloadLink(downloadAudioLink);
}

function assertStringField(value, fieldName) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Expected non-empty string in "${fieldName}".`);
  }

  return value;
}

function syncOutputName(sourceFileName) {
  const dot = sourceFileName.lastIndexOf('.');
  if (dot <= 0) {
    return `${sourceFileName}.sync.json`;
  }

  return `${sourceFileName.slice(0, dot)}.sync.json`;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hash2D(x, y) {
  const raw = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return raw - Math.floor(raw);
}

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function createStars(count, width, height) {
  const rng = createRng(0x5eeda11);
  const starsLocal = [];

  for (let i = 0; i < count; i += 1) {
    starsLocal.push({
      x: rng() * width,
      y: rng() * height * 0.75,
      speed: 8 + rng() * 34,
      size: 1 + rng() * 2.6,
      alpha: 0.25 + rng() * 0.7,
      phase: rng() * Math.PI * 2,
      seed: rng() * 1000
    });
  }

  return starsLocal;
}

function bindSlider(input, output, onChange) {
  const update = () => {
    const value = Number.parseFloat(input.value);
    if (!Number.isFinite(value)) {
      throw new Error(`Slider value must be finite for "${input.id}".`);
    }

    output.value = value.toFixed(2);
    onChange(value);
  };

  input.addEventListener('input', update);
  update();
}

bindSlider(lowGainInput, lowGainValue, (value) => {
  controls.lowGain = value;
});
bindSlider(midGainInput, midGainValue, (value) => {
  controls.midGain = value;
});
bindSlider(highGainInput, highGainValue, (value) => {
  controls.highGain = value;
});
bindSlider(beatGainInput, beatGainValue, (value) => {
  controls.beatGain = value;
});
bindSlider(midChaosInput, midChaosValue, (value) => {
  controls.midChaos = value;
});
bindSlider(midSpeedInput, midSpeedValue, (value) => {
  controls.midSpeed = value;
});

showClassicInput.addEventListener('change', () => {
  controls.showClassic = showClassicInput.checked;
  classicCanvas.classList.toggle('hidden', !controls.showClassic);
});
showClassicInput.dispatchEvent(new Event('change'));

function sampleCurve(track, timeSec) {
  const samples = track.curves.samples;
  if (samples.length === 0) {
    throw new Error('Sync track has no curve samples.');
  }

  const fps = track.curves.fps;
  const frame = timeSec * fps;
  const i0 = Math.max(0, Math.min(samples.length - 1, Math.floor(frame)));
  const i1 = Math.max(0, Math.min(samples.length - 1, i0 + 1));
  const frac = clamp01(frame - i0);

  const a = samples[i0];
  const b = samples[i1];

  return {
    low: a.low + (b.low - a.low) * frac,
    mid: a.mid + (b.mid - a.mid) * frac,
    high: a.high + (b.high - a.high) * frac,
    rms: a.rms + (b.rms - a.rms) * frac
  };
}

function applyControlGains(curve) {
  return {
    low: clamp01(curve.low * controls.lowGain),
    mid: clamp01(curve.mid * controls.midGain),
    high: clamp01(curve.high * controls.highGain),
    rms: clamp01(curve.rms)
  };
}

function hasBeatInRange(track, fromSec, toSec) {
  return track.events.some((event) => event.type === 'beat' && event.t >= fromSec && event.t <= toSec);
}

function updateStars(deltaSec, width, horizonY, highEnergy) {
  for (const star of stars) {
    star.y += star.speed * deltaSec * (0.45 + highEnergy * 0.95);
    if (star.y > horizonY - 2) {
      star.y = -4;
      star.x = Math.random() * width;
    }
  }
}

function starFlashFactor(star, timeMs, highEnergy) {
  const wave = 0.5 + 0.5 * Math.sin(timeMs * 0.009 + star.seed);
  const threshold = 0.982 - highEnergy * 0.06;
  if (wave > threshold) {
    return clamp01((wave - threshold) * 40);
  }

  return 0;
}

function drawClassicPreview(curve) {
  const width = classicCanvas.width;
  const height = classicCanvas.height;
  classicContext.clearRect(0, 0, width, height);

  const background = classicContext.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, 'rgba(18, 26, 44, 0.98)');
  background.addColorStop(1, 'rgba(8, 12, 22, 0.98)');
  classicContext.fillStyle = background;
  classicContext.fillRect(0, 0, width, height);

  const labels = ['LOW', 'MID', 'HIGH', 'RMS'];
  const values = [curve.low, curve.mid, curve.high, curve.rms];
  const colors = ['#4ee5b2', '#62d4ff', '#ff8f5e', '#ffe88a'];
  const slotWidth = width / values.length;

  for (let i = 0; i < values.length; i += 1) {
    const barHeight = Math.floor((height - 52) * clamp01(values[i]));
    const x = Math.floor(i * slotWidth + 28);
    const y = height - 22 - barHeight;

    classicContext.fillStyle = colors[i];
    classicContext.fillRect(x, y, Math.floor(slotWidth - 56), barHeight);

    classicContext.fillStyle = 'rgba(244, 248, 255, 0.92)';
    classicContext.font = '16px Trebuchet MS, Segoe UI, sans-serif';
    classicContext.fillText(`${labels[i]} ${values[i].toFixed(2)}`, x, height - 4);
  }
}

function drawRetroGridScene(timeMs, musicTimeSec, curve) {
  const width = canvas.width;
  const height = canvas.height;
  const lowEnergy = curve.low;
  const midEnergy = curve.mid;
  const highEnergy = curve.high;
  const pulse = clamp01(beatPulse * 0.85);
  const horizonY = Math.floor(height * 0.58);

  const backgroundGradient = context.createLinearGradient(0, 0, 0, height);
  backgroundGradient.addColorStop(
    0,
    `rgb(${Math.floor(5 + lowEnergy * 20 + pulse * 24)}, 8, ${Math.floor(28 + lowEnergy * 65)})`
  );
  backgroundGradient.addColorStop(
    0.55,
    `rgb(${Math.floor(12 + lowEnergy * 33)}, ${Math.floor(10 + lowEnergy * 14)}, ${Math.floor(42 + lowEnergy * 62)})`
  );
  backgroundGradient.addColorStop(1, 'rgb(10, 8, 20)');
  context.fillStyle = backgroundGradient;
  context.fillRect(0, 0, width, height);

  const sunRadius = Math.floor(52 + lowEnergy * 30 + pulse * 28);
  const sunGradient = context.createRadialGradient(width * 0.5, horizonY - 60, 4, width * 0.5, horizonY - 60, sunRadius);
  sunGradient.addColorStop(0, `rgba(255, 164, 110, ${0.22 + lowEnergy * 0.3})`);
  sunGradient.addColorStop(1, 'rgba(255, 164, 110, 0)');
  context.fillStyle = sunGradient;
  context.beginPath();
  context.arc(width * 0.5, horizonY - 60, sunRadius, 0, Math.PI * 2);
  context.fill();

  for (const star of stars) {
    const twinkle = 0.62 + 0.38 * Math.sin(timeMs * 0.003 + star.phase);
    const flash = starFlashFactor(star, timeMs, highEnergy);
    const alpha = clamp01(star.alpha * twinkle + flash * 0.95);
    const size = star.size + flash * (1.5 + highEnergy * 2.4);

    context.fillStyle = `rgba(120, 228, 255, ${alpha})`;
    context.fillRect(
      Math.floor(star.x),
      Math.floor(star.y),
      Math.max(1, Math.floor(size)),
      Math.max(1, Math.floor(size))
    );
  }

  const horizonGlow = context.createLinearGradient(0, horizonY - 3, 0, horizonY + 18);
  horizonGlow.addColorStop(0, `rgba(255, 153, 103, ${0.6 + lowEnergy * 0.25 + pulse * 0.2})`);
  horizonGlow.addColorStop(1, 'rgba(255, 153, 103, 0)');
  context.fillStyle = horizonGlow;
  context.fillRect(0, horizonY - 3, width, 28);

  const travelRange = height - horizonY;
  const centerX = width / 2;

  function gridX(column, y) {
    const t = clamp01((y - horizonY) / travelRange);
    const xTop = centerX + column * PERSPECTIVE_TOP_SPACING;
    const xBottom = centerX + column * PERSPECTIVE_TOP_SPACING * PERSPECTIVE_BOTTOM_SPREAD;
    return lerp(xTop, xBottom, t);
  }

  const perspectiveCount = Math.ceil((width * 0.5) / PERSPECTIVE_TOP_SPACING) + 2;
  for (let column = -perspectiveCount; column <= perspectiveCount; column += 1) {
    const xTop = centerX + column * PERSPECTIVE_TOP_SPACING;
    const xBottom = centerX + column * PERSPECTIVE_TOP_SPACING * PERSPECTIVE_BOTTOM_SPREAD;

    for (let segment = 0; segment < 10; segment += 1) {
      const t0 = segment / 10;
      const t1 = (segment + 1) / 10;
      const y0 = lerp(horizonY, height, t0);
      const y1 = lerp(horizonY, height, t1);
      const sx0 = lerp(xTop, xBottom, t0);
      const sx1 = lerp(xTop, xBottom, t1);
      const depth = (t0 + t1) * 0.5;

      context.strokeStyle = `rgba(100, 67, 255, ${lerp(0.12, 0.7, depth) * (0.55 + midEnergy * 0.9)})`;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(sx0, y0);
      context.lineTo(sx1, y1);
      context.stroke();
    }
  }

  const spacing = travelRange / HORIZON_LINE_COUNT;
  const flowOffset = ((timeMs * (80 + lowEnergy * 145 + controls.midSpeed * 35)) / 1000) % spacing;
  for (let row = -1; row <= HORIZON_LINE_COUNT; row += 1) {
    let y = horizonY + row * spacing + flowOffset;
    if (y < horizonY) {
      y += travelRange;
    }
    if (y > height) {
      y -= travelRange;
    }
    if (y < horizonY || y > height) {
      continue;
    }

    const depth = (y - horizonY) / travelRange;
    context.strokeStyle = `rgba(110, 77, 255, ${lerp(0.14, 0.78, depth) * (0.55 + midEnergy * 0.8)})`;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }

  const glowRows = 12;
  const glowCols = 30;
  const chaos = controls.midChaos;
  const midPhase = timeMs * 0.0018 * (0.8 + controls.midSpeed * 1.4) + musicTimeSec * (1.6 + chaos * 3.1);
  const gateFloor = clamp01(0.22 - chaos * 0.07);

  for (let row = 0; row < glowRows; row += 1) {
    const y0 = lerp(horizonY, height, row / glowRows);
    const y1 = lerp(horizonY, height, (row + 1) / glowRows);
    const rowDepth = (row + 0.5) / glowRows;

    for (let col = -Math.floor(glowCols / 2); col < Math.floor(glowCols / 2); col += 1) {
      const x00 = gridX(col, y0);
      const x10 = gridX(col + 1, y0);
      const x01 = gridX(col, y1);
      const x11 = gridX(col + 1, y1);

      const noise = hash2D(col + 31, row + 17);
      const waveA = 0.5 + 0.5 * Math.sin(midPhase + col * 0.77 + row * 1.13 + noise * 6.283);
      const waveB = 0.5 + 0.5 * Math.sin(midPhase * 0.47 - row * 1.89 + col * 0.31 + noise * 4.1);
      const sweep = 0.5 + 0.5 * Math.sin((rowDepth * 11 - midPhase * 0.9) * Math.PI + noise * 2.8);
      const gate = waveA * 0.45 + waveB * 0.2 + sweep * 0.35;

      const intensity =
        midEnergy *
        gate *
        (0.62 + rowDepth * 0.88) *
        (0.6 + noise * (0.45 + chaos * 0.35)) *
        (0.9 + pulse * 0.2);

      if (intensity <= gateFloor) {
        continue;
      }

      const alpha = (intensity - gateFloor) * (0.45 + rowDepth * 0.8);
      context.fillStyle = `rgba(98, 212, 255, ${clamp01(alpha)})`;
      context.beginPath();
      context.moveTo(x00, y0);
      context.lineTo(x10, y0);
      context.lineTo(x11, y1);
      context.lineTo(x01, y1);
      context.closePath();
      context.fill();

      const sparkWave = 0.5 + 0.5 * Math.sin(midPhase * 2.2 + noise * 21.3 + col * 0.41);
      if (sparkWave > 0.996 - highEnergy * 0.09) {
        context.fillStyle = `rgba(177, 245, 255, ${0.35 + highEnergy * 0.5})`;
        context.beginPath();
        context.moveTo((x00 + x10 + x11 + x01) * 0.25, (y0 + y1) * 0.5);
        context.arc((x00 + x10 + x11 + x01) * 0.25, (y0 + y1) * 0.5, 2 + highEnergy * 3, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  const vignette = context.createRadialGradient(
    width * 0.5,
    height * 0.52,
    height * 0.1,
    width * 0.5,
    height * 0.52,
    height * 0.78
  );
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, `rgba(0, 0, 0, ${0.34 + lowEnergy * 0.2})`);
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);

  context.fillStyle = 'rgba(230, 240, 255, 0.88)';
  context.font = '18px Trebuchet MS, Segoe UI, sans-serif';
  context.fillText(
    `LOW ${curve.low.toFixed(2)}  MID ${curve.mid.toFixed(2)}  HIGH ${curve.high.toFixed(2)}  BPM ${syncTrack?.timing.bpm ?? '--'}`,
    20,
    30
  );
}

function framePreview(timeMs) {
  const deltaSec = Math.max(0.001, (timeMs - lastFrameMs) / 1000);
  lastFrameMs = timeMs;

  let curve = { low: 0, mid: 0, high: 0, rms: 0 };
  let musicTimeSec = 0;

  if (syncTrack !== null) {
    const now = player.currentTime;
    musicTimeSec = now;

    const rawCurve = sampleCurve(syncTrack, now);
    curve = applyControlGains(rawCurve);

    if (hasBeatInRange(syncTrack, Math.max(0, lastPreviewTime), now)) {
      beatPulse = Math.max(beatPulse, 0.7 + controls.beatGain * 0.7);
    }

    lastPreviewTime = now;
  }

  beatPulse = Math.max(0, beatPulse - deltaSec * (2.7 + controls.beatGain * 0.4));

  const horizonY = Math.floor(canvas.height * 0.58);
  updateStars(deltaSec, canvas.width, horizonY, curve.high);
  drawRetroGridScene(timeMs, musicTimeSec, curve);

  if (controls.showClassic) {
    drawClassicPreview(curve);
  }

  requestAnimationFrame(framePreview);
}

async function waitForJob(jobId) {
  for (;;) {
    const response = await fetch(`/api/sync/jobs/${jobId}`);
    if (!response.ok) {
      throw new Error(`Job status request failed: ${response.status}`);
    }

    const payload = await response.json();
    setStatus(payload.status);

    if (payload.status === 'failed') {
      throw new Error(payload.error ?? 'Sync compile job failed.');
    }

    if (payload.status === 'done') {
      return payload;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 900);
    });
  }
}

uploadForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const file = trackInput.files?.[0];
  if (file === undefined) {
    throw new Error('No file selected.');
  }

  compileButton.disabled = true;
  setStatus('uploading');
  metaLabel.textContent = `Plik: ${file.name}`;
  clearResultLinks();

  try {
    const form = new FormData();
    form.set('track', file);

    const createResponse = await fetch('/api/sync/jobs', {
      method: 'POST',
      body: form
    });

    if (!createResponse.ok) {
      const errorBody = await createResponse.text();
      throw new Error(`Upload failed (${createResponse.status}): ${errorBody}`);
    }

    const created = await createResponse.json();
    setStatus('processing');

    const done = await waitForJob(created.jobId);
    const resultUrl = assertStringField(done.resultUrl, 'resultUrl');
    const audioUrl = assertStringField(done.audioUrl, 'audioUrl');
    const sourceFileName = assertStringField(done.sourceFileName, 'sourceFileName');

    const syncResponse = await fetch(resultUrl);
    if (!syncResponse.ok) {
      throw new Error(`Result download failed: ${syncResponse.status}`);
    }

    syncTrack = await syncResponse.json();
    player.src = audioUrl;
    player.currentTime = 0;
    lastPreviewTime = 0;

    enableDownloadLink(downloadSyncLink, resultUrl, syncOutputName(sourceFileName));
    enableDownloadLink(downloadAudioLink, audioUrl, sourceFileName);

    metaLabel.textContent = `BPM ${syncTrack.timing.bpm} | zdarzenia ${syncTrack.events.length} | próbki ${syncTrack.curves.samples.length}`;
    setStatus('done');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown UI error.';
    setStatus(`error: ${message}`);
    metaLabel.textContent = '';
    clearResultLinks();
  } finally {
    compileButton.disabled = false;
  }
});

clearResultLinks();
requestAnimationFrame(framePreview);
