const maxTableSelect = document.getElementById('max-table');
const languageSelect = document.getElementById('language-select');
const startBtn = document.getElementById('start-btn');
const installBtn = document.getElementById('install-btn');
const updateBanner = document.getElementById('update-banner');
const updateBtn = document.getElementById('update-btn');
const dismissUpdateBtn = document.getElementById('dismiss-update-btn');
const loginScreen = document.getElementById('login-screen');
const sessionScreen = document.getElementById('session-screen');
const setupScreen = document.getElementById('setup-screen');
const countdownScreen = document.getElementById('countdown-screen');
const gameScreen = document.getElementById('game-screen');
const resultScreen = document.getElementById('result-screen');
const countdownEl = document.getElementById('countdown');
const timeLeftEl = document.getElementById('time-left');
const scoreEl = document.getElementById('score');
const fuelStatusTextEl = document.getElementById('fuel-status-text');
const fuelMeterFillEl = document.getElementById('fuel-meter-fill');
const turboStatusEl = document.getElementById('turbo-status');
const questionEl = document.getElementById('question');
const answerInput = document.getElementById('answer');
const submitAnswerBtn = document.getElementById('submit-answer');
const voiceRetryBtn = document.getElementById('voice-retry');
const voiceStatusEl = document.getElementById('voice-status');
const finalScoreEl = document.getElementById('final-score');
const celebrationEl = document.getElementById('celebration');
const gameFeedbackEl = document.getElementById('game-feedback');
const resultFeedbackEl = document.getElementById('result-feedback');
const playAgainBtn = document.getElementById('play-again');
const leaderboardTitle = document.getElementById('leaderboard-title');
const leaderboardList = document.getElementById('leaderboard-list');
const loginNameInput = document.getElementById('login-name');
const loginBtn = document.getElementById('login-btn');
const activePlayerNameEl = document.getElementById('active-player-name');
const logoutBtn = document.getElementById('logout-btn');
const vehicleStage = document.getElementById('vehicle-stage');
const vehicleSprite = document.getElementById('vehicle-sprite');
const vehicleVariantSelect = document.getElementById('vehicle-variant');
const vehicleColorInput = document.getElementById('vehicle-color');

const STORAGE_KEYS = {
  language: 'language',
  activeUser: 'activeUser',
  vehiclePrefsPrefix: 'vehiclePrefs:',
};

const LEVEL_SEQUENCE = [{ mode: 'single', maxTable: 2 }];
for (let i = 3; i <= 12; i += 1) {
  LEVEL_SEQUENCE.push({ mode: 'single', maxTable: i });
  LEVEL_SEQUENCE.push({ mode: 'mixed', maxTable: i });
}

let currentLanguage = localStorage.getItem(STORAGE_KEYS.language) || 'en';
if (!TRANSLATIONS[currentLanguage]) currentLanguage = 'en';

function t(key, params = {}) {
  const fallback = TRANSLATIONS.en[key] || key;
  const template = TRANSLATIONS[currentLanguage][key] || fallback;
  return template.replace(/\{(\w+)\}/g, (_, token) => String(params[token] ?? `{${token}}`));
}

Object.entries(TRANSLATIONS).forEach(([code, dict]) => {
  const option = document.createElement('option');
  option.value = code;
  option.textContent = dict.languageName;
  languageSelect.appendChild(option);
});
languageSelect.value = currentLanguage;

let deferredInstallPrompt = null;
let swRegistration = null;
let shouldReloadForUpdate = false;
let activeUser = localStorage.getItem(STORAGE_KEYS.activeUser) || null;

function normalizeName(name) {
  return (name || '').trim().toLowerCase();
}

function progressKey(name) {
  return `progress:${normalizeName(name)}`;
}

function configKey(config) {
  return `${config.mode}-${config.maxTable}`;
}


const DEFAULT_VEHICLE_PREFS = {
  variant: 'pickup',
  color: '#2c7be5',
};

const VEHICLE_VARIANTS = new Set(['pickup', 'buggy']);

function vehiclePrefsKey(name) {
  return `${STORAGE_KEYS.vehiclePrefsPrefix}${normalizeName(name)}`;
}

function sanitizeVehiclePrefs(rawPrefs = {}) {
  const variant = VEHICLE_VARIANTS.has(rawPrefs.variant) ? rawPrefs.variant : DEFAULT_VEHICLE_PREFS.variant;
  const color = /^#[0-9a-f]{6}$/i.test(rawPrefs.color || '') ? rawPrefs.color : DEFAULT_VEHICLE_PREFS.color;
  return { variant, color };
}

function getVehiclePrefs(name) {
  const normalized = normalizeName(name);
  if (!normalized) return { ...DEFAULT_VEHICLE_PREFS };
  const raw = localStorage.getItem(vehiclePrefsKey(normalized));
  if (!raw) return { ...DEFAULT_VEHICLE_PREFS };
  try {
    return sanitizeVehiclePrefs(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_VEHICLE_PREFS };
  }
}

function saveVehiclePrefs(name, prefs) {
  const normalized = normalizeName(name);
  if (!normalized) return;
  localStorage.setItem(vehiclePrefsKey(normalized), JSON.stringify(sanitizeVehiclePrefs(prefs)));
}

function applyVehiclePrefs(prefs) {
  const safePrefs = sanitizeVehiclePrefs(prefs);
  vehicleSprite.classList.remove('is-pickup', 'is-buggy');
  vehicleSprite.classList.add(`is-${safePrefs.variant}`);
  vehicleSprite.style.setProperty('--vehicle-color', safePrefs.color);

  if (vehicleVariantSelect.value !== safePrefs.variant) {
    vehicleVariantSelect.value = safePrefs.variant;
  }
  if (vehicleColorInput.value.toLowerCase() !== safePrefs.color.toLowerCase()) {
    vehicleColorInput.value = safePrefs.color;
  }
}


function getUserProgress(name) {
  const normalized = normalizeName(name);
  if (!normalized) return new Set([configKey({ mode: 'single', maxTable: 2 })]);
  const raw = localStorage.getItem(progressKey(normalized));
  if (!raw) return new Set([configKey({ mode: 'single', maxTable: 2 })]);
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) {
      return new Set([configKey({ mode: 'single', maxTable: 2 })]);
    }
    return new Set(parsed);
  } catch {
    return new Set([configKey({ mode: 'single', maxTable: 2 })]);
  }
}

function saveUserProgress(name, unlockedLevels) {
  const normalized = normalizeName(name);
  if (!normalized) return;
  localStorage.setItem(progressKey(normalized), JSON.stringify([...unlockedLevels]));
}

function unlockNextLevelForScore(config, currentScore) {
  if (!activeUser || currentScore < 20) return null;

  const currentKey = configKey(config);
  const index = LEVEL_SEQUENCE.findIndex((level) => configKey(level) === currentKey);
  if (index === -1) return null;

  const next = LEVEL_SEQUENCE[index + 1];
  if (!next) return null;

  const unlockedLevels = getUserProgress(activeUser);
  const nextKey = configKey(next);
  if (unlockedLevels.has(nextKey)) return null;

  unlockedLevels.add(nextKey);
  saveUserProgress(activeUser, unlockedLevels);
  return next;
}

function getLeaderboard(config) {
  const raw = localStorage.getItem(`leaderboard:${configKey(config)}`);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLeaderboard(config, entries) {
  localStorage.setItem(`leaderboard:${configKey(config)}`, JSON.stringify(entries.slice(0, 5)));
}

function settingLabel(config) {
  return config.mode === 'single'
    ? t('leaderboard.single', { max: config.maxTable })
    : t('leaderboard.mixed', { max: config.maxTable });
}

function renderLeaderboard(config) {
  const rows = getLeaderboard(config);
  leaderboardTitle.textContent = settingLabel(config);
  leaderboardList.innerHTML = '';
  if (!rows.length) {
    const li = document.createElement('li');
    li.textContent = t('leaderboard.empty');
    leaderboardList.appendChild(li);
    return;
  }

  rows.forEach((row) => {
    const li = document.createElement('li');
    li.textContent = `${row.name}: ${row.score}`;
    leaderboardList.appendChild(li);
  });
}

function tablePool(config) {
  const values = [];
  if (config.mode === 'single') return [config.maxTable];
  for (let tVal = 2; tVal <= config.maxTable; tVal += 1) values.push(tVal);
  return values;
}

function showOnly(screen) {
  [setupScreen, countdownScreen, gameScreen, resultScreen].forEach((el) => el.classList.add('hidden'));
  screen.classList.remove('hidden');
}

function getMode() {
  return document.querySelector('input[name="mode"]:checked').value;
}

function getUnlockedLevels() {
  return activeUser ? getUserProgress(activeUser) : new Set();
}

function ensureGameConfigIsUnlocked() {
  const unlocked = getUnlockedLevels();
  if (unlocked.has(configKey(gameConfig))) return;
  const firstUnlocked = LEVEL_SEQUENCE.find((level) => unlocked.has(configKey(level)));
  gameConfig = firstUnlocked || { mode: 'single', maxTable: 2 };
}

function syncSelectorsFromGameConfig() {
  maxTableSelect.value = String(gameConfig.maxTable);
  const targetMode = gameConfig.mode;
  document.querySelectorAll('input[name="mode"]').forEach((el) => {
    el.checked = el.value === targetMode;
  });
}

function applyLevelLocks() {
  const unlocked = getUnlockedLevels();

  document.querySelectorAll('input[name="mode"]').forEach((modeInput) => {
    const hasUnlockedForMode = LEVEL_SEQUENCE.some(
      (level) => level.mode === modeInput.value && unlocked.has(configKey(level)),
    );
    modeInput.disabled = !hasUnlockedForMode;
  });

  Array.from(maxTableSelect.options).forEach((opt) => {
    const value = Number(opt.value);
    const singleUnlocked = unlocked.has(configKey({ mode: 'single', maxTable: value }));
    const mixedUnlocked = unlocked.has(configKey({ mode: 'mixed', maxTable: value }));
    opt.disabled = !(singleUnlocked || mixedUnlocked);
  });

  const selectedMode = getMode();
  const selectedMax = Number(maxTableSelect.value);
  const selectedUnlocked = unlocked.has(configKey({ mode: selectedMode, maxTable: selectedMax }));
  if (!selectedUnlocked) {
    ensureGameConfigIsUnlocked();
    syncSelectorsFromGameConfig();
  }
}

function setSessionVisibility(loggedIn) {
  loginScreen.classList.toggle('hidden', loggedIn);
  sessionScreen.classList.toggle('hidden', !loggedIn);
  setupScreen.classList.toggle('hidden', !loggedIn);
  vehicleStage.classList.toggle('hidden', !loggedIn);
  if (!loggedIn) {
    [countdownScreen, gameScreen, resultScreen].forEach((el) => el.classList.add('hidden'));
  }
}

function applyTranslations() {
  document.documentElement.lang = currentLanguage;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });

  maxTableSelect.setAttribute('aria-label', t('aria.highestTimesTable'));
  answerInput.setAttribute('aria-label', t('aria.yourAnswer'));
  languageSelect.setAttribute('aria-label', t('aria.language'));
  loginNameInput.setAttribute('aria-label', t('aria.loginName'));
  vehicleVariantSelect.setAttribute('aria-label', t('aria.vehicleVariant'));
  vehicleColorInput.setAttribute('aria-label', t('aria.vehicleColor'));

  if (countdownEl.textContent === TRANSLATIONS.en['countdown.go'] || countdownEl.textContent === TRANSLATIONS.af['countdown.go']) {
    countdownEl.textContent = t('countdown.go');
  }

  renderLeaderboard(gameConfig);
  updateFuelUi();

  updateVoiceAvailabilityMessage();
}

function updateInstallButtonVisibility() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (deferredInstallPrompt && !isStandalone) {
    installBtn.classList.remove('hidden');
  } else {
    installBtn.classList.add('hidden');
  }
}

function showUpdateBanner() {
  updateBanner.classList.remove('hidden');
}

function hideUpdateBanner() {
  updateBanner.classList.add('hidden');
}

function promptForAvailableUpdate(registration) {
  if (registration.waiting) {
    showUpdateBanner();
  }
}

function monitorInstallingWorker(worker) {
  if (!worker) return;
  worker.addEventListener('statechange', () => {
    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
      showUpdateBanner();
    }
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      swRegistration = await navigator.serviceWorker.register('./sw.js');
      promptForAvailableUpdate(swRegistration);

      swRegistration.addEventListener('updatefound', () => {
        monitorInstallingWorker(swRegistration.installing);
      });

      if (navigator.onLine) {
        swRegistration.update();
      }

      setInterval(() => {
        if (navigator.onLine && swRegistration) {
          swRegistration.update();
        }
      }, 10 * 60 * 1000);
    } catch (error) {
      console.error('Service worker registration failed', error);
    }
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!shouldReloadForUpdate) return;
    shouldReloadForUpdate = false;
    window.location.reload();
  });

  window.addEventListener('online', () => {
    if (swRegistration) {
      swRegistration.update();
    }
  });
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  updateInstallButtonVisibility();
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  updateInstallButtonVisibility();
});

installBtn.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  updateInstallButtonVisibility();
});

updateBtn.addEventListener('click', () => {
  const waitingWorker = swRegistration?.waiting;
  if (!waitingWorker) return;

  shouldReloadForUpdate = true;
  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
});

dismissUpdateBtn.addEventListener('click', hideUpdateBanner);

for (let i = 2; i <= 12; i += 1) {
  const option = document.createElement('option');
  option.value = String(i);
  option.textContent = `${i}`;
  maxTableSelect.appendChild(option);
}

let gameConfig = { maxTable: 2, mode: 'single' };
let score = 0;
let secondsLeft = 60;
let timerInterval = null;
let currentQuestion = null;
let lastQuestionKey = null;
let currentStreak = 0;

let autoListenEnabled = true;
let isVoiceBusy = false;
let mediaRecorder = null;
let activeMediaStream = null;
let whisperTranscriberPromise = null;

const STREAK_MILESTONES = [5, 10, 15, 20];
const SCORE_MILESTONES = [10, 20, 30, 40, 50];

function setFeedbackMessage(element, message = '', state = '') {
  if (!element) return;
  element.textContent = message;
  element.className = 'feedback';
  if (state) element.classList.add(`feedback--${state}`);
  element.classList.toggle('hidden', !message);
}

function getAchievedMilestones(currentValue, milestones, previousValue) {
  return milestones.filter((milestone) => currentValue >= milestone && previousValue < milestone);
}

let fuel = 0;
let turboRemaining = 0;
let consecutiveCorrect = 0;

const MAX_FUEL = 5;
const TURBO_CORRECT_WINDOW = 3;
const TURBO_BONUS = 1;


function updateFuelUi() {
  const ratio = (fuel / MAX_FUEL) * 100;
  fuelStatusTextEl.textContent = t('label.fuelStatus', { current: fuel, max: MAX_FUEL });
  fuelMeterFillEl.style.width = `${ratio}%`;

  const turboActive = turboRemaining > 0;
  turboStatusEl.textContent = turboActive
    ? t('label.turboActive', { remaining: turboRemaining, bonus: TURBO_BONUS })
    : t('label.turboInactive');
  turboStatusEl.classList.toggle('is-active', turboActive);
  fuelMeterFillEl.classList.toggle('is-turbo', turboActive);
}

function makeQuestion(config, allowRepeat = false) {
  const tables = tablePool(config);
  let question;
  let guard = 0;
  do {
    const table = tables[Math.floor(Math.random() * tables.length)];
    const multiplier = 2 + Math.floor(Math.random() * 11);
    question = {
      table,
      multiplier,
      answer: table * multiplier,
      key: `${table}x${multiplier}`,
    };
    guard += 1;
  } while (!allowRepeat && question.key === lastQuestionKey && guard < 50);

  currentQuestion = question;
  lastQuestionKey = question.key;
  questionEl.textContent = `${question.table} × ${question.multiplier} = ?`;
  answerInput.value = '';
  answerInput.focus();
  setTimeout(startAutoListening, 220);
}

function beep({ frequency, duration = 0.18, type = 'sine', volume = 0.06 }) {
  const audio = new (window.AudioContext || window.webkitAudioContext)();
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + duration);
  osc.onended = () => audio.close();
}

function successSound() {
  beep({ frequency: 660, duration: 0.12, type: 'triangle', volume: 0.07 });
  setTimeout(() => beep({ frequency: 880, duration: 0.14, type: 'triangle', volume: 0.07 }), 100);
}

function failSound() {
  beep({ frequency: 220, duration: 0.2, type: 'square', volume: 0.07 });
}

function fanfareSound() {
  const notes = [523, 659, 784, 1046];
  notes.forEach((freq, i) => {
    setTimeout(() => beep({ frequency: freq, duration: 0.18, type: 'sawtooth', volume: 0.08 }), i * 130);
  });
}


function setVoiceStatus(messageKey, params = {}) {
  if (!voiceStatusEl) return;
  voiceStatusEl.textContent = t(messageKey, params);
}

function isVoiceSupported() {
  return Boolean(window.MediaRecorder && navigator.mediaDevices?.getUserMedia);
}

function updateVoiceAvailabilityMessage() {
  if (!isVoiceSupported()) {
    setVoiceStatus('hint.voiceUnsupported');
    return;
  }

  if (isVoiceBusy) {
    setVoiceStatus('hint.voiceListening');
    return;
  }

  setVoiceStatus('hint.voiceIdle');
}

function normalizeSpokenText(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z\s-]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseEnglishNumberWords(textValue) {
  const normalized = normalizeSpokenText(textValue);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;

  const units = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  };
  const teens = {
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
    sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  };
  const tens = {
    twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  };

  let current = 0;

  for (const token of tokens) {
    if (token === 'and') continue;
    if (token in units) {
      current += units[token];
      continue;
    }
    if (token in teens) {
      current += teens[token];
      continue;
    }
    if (token in tens) {
      current += tens[token];
      continue;
    }
    if (token === 'hundred') {
      if (current === 0) current = 1;
      current *= 100;
      continue;
    }
    return null;
  }

  return current;
}

function afrikaansNumberToWords(number) {
  const units = ['nul', 'een', 'twee', 'drie', 'vier', 'vyf', 'ses', 'sewe', 'agt', 'nege'];
  const teens = ['tien', 'elf', 'twaalf', 'dertien', 'veertien', 'vyftien', 'sestien', 'sewentien', 'agtien', 'negentien'];
  const tensWords = {
    20: 'twintig',
    30: 'dertig',
    40: 'veertig',
    50: 'vyftig',
    60: 'sestig',
    70: 'sewentig',
    80: 'tagtig',
    90: 'negentig',
  };

  if (number < 10) return units[number];
  if (number < 20) return teens[number - 10];
  if (number < 100) {
    const tens = Math.floor(number / 10) * 10;
    const unit = number % 10;
    if (unit === 0) return tensWords[tens];
    return `${units[unit]} en ${tensWords[tens]}`;
  }
  if (number === 100) return 'honderd';
  const remainder = number - 100;
  if (remainder === 0) return 'honderd';
  return `honderd ${afrikaansNumberToWords(remainder)}`;
}

const AFRIKAANS_NUMBER_LOOKUP = (() => {
  const lookup = new Map();
  for (let i = 0; i <= 144; i += 1) {
    const canonical = normalizeSpokenText(afrikaansNumberToWords(i));
    lookup.set(canonical, i);
    lookup.set(canonical.replace(/ en /g, ' '), i);
  }
  return lookup;
})();

function parseAfrikaansNumberWords(textValue) {
  const normalized = normalizeSpokenText(textValue);
  if (!normalized) return null;
  return AFRIKAANS_NUMBER_LOOKUP.get(normalized) ?? null;
}

function parseSpokenAnswer(transcript, language) {
  const numericMatch = transcript.match(/\d+/);
  if (numericMatch) return Number(numericMatch[0]);

  if (language === 'af') {
    return parseAfrikaansNumberWords(transcript);
  }

  return parseEnglishNumberWords(transcript);
}

function stopActiveRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  if (activeMediaStream) {
    activeMediaStream.getTracks().forEach((track) => track.stop());
    activeMediaStream = null;
  }
  mediaRecorder = null;
}

function downsampleTo16k(float32Array, sourceSampleRate) {
  if (sourceSampleRate === 16000) return float32Array;
  const ratio = sourceSampleRate / 16000;
  const newLength = Math.round(float32Array.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < float32Array.length; i += 1) {
      accum += float32Array[i];
      count += 1;
    }
    result[offsetResult] = count ? accum / count : 0;
    offsetResult += 1;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

async function decodeAudioBlobTo16kMono(audioBlob) {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AudioCtx();

  try {
    const decoded = await audioContext.decodeAudioData(arrayBuffer);
    const { numberOfChannels, length, sampleRate } = decoded;
    const mono = new Float32Array(length);

    for (let channel = 0; channel < numberOfChannels; channel += 1) {
      const data = decoded.getChannelData(channel);
      for (let i = 0; i < length; i += 1) {
        mono[i] += data[i] / numberOfChannels;
      }
    }

    return downsampleTo16k(mono, sampleRate);
  } finally {
    audioContext.close();
  }
}

async function recordAudioSnippet(durationMs = 1700) {
  activeMediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      noiseSuppression: true,
      echoCancellation: true,
      autoGainControl: true,
    },
  });

  return new Promise((resolve, reject) => {
    const chunks = [];
    mediaRecorder = new MediaRecorder(activeMediaStream);

    mediaRecorder.addEventListener('dataavailable', (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    });

    mediaRecorder.addEventListener('stop', () => {
      const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
      stopActiveRecording();
      resolve(blob);
    }, { once: true });

    mediaRecorder.addEventListener('error', () => {
      stopActiveRecording();
      reject(new Error('MediaRecorderError'));
    }, { once: true });

    mediaRecorder.start();
    setTimeout(() => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    }, durationMs);
  });
}

async function getWhisperTranscriber() {
  if (!whisperTranscriberPromise) {
    whisperTranscriberPromise = (async () => {
      setVoiceStatus('hint.voiceLoading');
      const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
      env.allowRemoteModels = true;
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      return pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
        quantized: true,
      });
    })();
  }

  return whisperTranscriberPromise;
}

async function startAutoListening() {
  if (!autoListenEnabled || !isVoiceSupported()) {
    updateVoiceAvailabilityMessage();
    return;
  }

  if (isVoiceBusy || gameScreen.classList.contains('hidden') || !currentQuestion || secondsLeft <= 0) return;

  isVoiceBusy = true;
  setVoiceStatus('hint.voiceListening');

  try {
    const audioBlob = await recordAudioSnippet();
    setVoiceStatus('hint.voiceTranscribing');
    const audio16k = await decodeAudioBlobTo16kMono(audioBlob);
    const transcriber = await getWhisperTranscriber();
    const output = await transcriber(audio16k, {
      task: 'transcribe',
      language: currentLanguage === 'af' ? 'afrikaans' : 'english',
      return_timestamps: false,
    });

    const transcript = (output?.text || '').trim();
    const spokenValue = parseSpokenAnswer(transcript, currentLanguage);

    if (spokenValue === null || spokenValue < 0 || spokenValue > 144) {
      setVoiceStatus('hint.voiceUnclear', { text: transcript || '...' });
      return;
    }

    answerInput.value = String(spokenValue);
    checkAnswer();
  } catch (error) {
    if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
      setVoiceStatus('hint.voicePermissionDenied');
    } else {
      setVoiceStatus('hint.voiceError');
      console.error('Voice recognition error', error);
    }
  } finally {
    isVoiceBusy = false;
    if (!gameScreen.classList.contains('hidden') && secondsLeft > 0) {
      setVoiceStatus('hint.voiceIdle');
    }
  }
}

function checkAnswer() {
  if (!currentQuestion) return;
  const val = Number(answerInput.value);
  if (Number.isNaN(val)) return;

  const previousScore = score;
  const previousStreak = currentStreak;

  if (val === currentQuestion.answer) {
    score += 1;
    currentStreak += 1;
    consecutiveCorrect += 1;
    let pointsAwarded = 1;

    if (turboRemaining > 0) {
      pointsAwarded += TURBO_BONUS;
      turboRemaining -= 1;
    }

    score += pointsAwarded;
    fuel = Math.min(MAX_FUEL, fuel + 1);

    if (fuel === MAX_FUEL && turboRemaining === 0) {
      turboRemaining = TURBO_CORRECT_WINDOW;
      fuel = 0;
    }

    scoreEl.textContent = String(score);
    updateFuelUi();
    successSound();

    const streakHits = getAchievedMilestones(currentStreak, STREAK_MILESTONES, previousStreak);
    const scoreHits = getAchievedMilestones(score, SCORE_MILESTONES, previousScore);

    if (streakHits.length) {
      const milestone = streakHits[streakHits.length - 1];
      setFeedbackMessage(gameFeedbackEl, t('feedback.streakMilestone', { n: milestone }), 'milestone');
    } else if (scoreHits.length) {
      const milestone = scoreHits[scoreHits.length - 1];
      setFeedbackMessage(gameFeedbackEl, t('feedback.scoreMilestone', { n: milestone }), 'milestone');
    } else {
      setFeedbackMessage(gameFeedbackEl, t('feedback.success', { n: score }), 'success');
    }

    makeQuestion(gameConfig, false);
  } else {
    consecutiveCorrect = 0;
    fuel = Math.max(0, fuel - 1);
    score -= 1;
    currentStreak = 0;
    scoreEl.textContent = String(score);
    updateFuelUi();
    failSound();
    setFeedbackMessage(gameFeedbackEl, t('feedback.tryAgain'), 'unlock');
    answerInput.value = '';
    answerInput.focus();
    setTimeout(startAutoListening, 220);
  }
}

function significantDigitCount(value) {
  const digitsOnly = value.replace(/\D/g, '');
  const withoutLeadingZeros = digitsOnly.replace(/^0+/, '');
  return withoutLeadingZeros.length;
}

function maybeAutoCheckAnswer() {
  if (!currentQuestion) return;
  const expectedDigits = String(currentQuestion.answer).length;
  if (significantDigitCount(answerInput.value) >= expectedDigits) {
    checkAnswer();
  }
}

function finishGame() {
  autoListenEnabled = false;
  stopActiveRecording();
  clearInterval(timerInterval);
  vehicleSprite.classList.remove('is-driving');
  timerInterval = null;
  showOnly(resultScreen);
  finalScoreEl.textContent = String(score);
  celebrationEl.classList.add('hidden');
  setFeedbackMessage(resultFeedbackEl);

  const board = getLeaderboard(gameConfig);
  const qualifies = board.length < 5 || score > board[board.length - 1].score;
  if (qualifies) {
    board.push({ name: activeUser, score });
    board.sort((a, b) => b.score - a.score);
    saveLeaderboard(gameConfig, board);
    celebrationEl.classList.remove('hidden');
    fanfareSound();
  }

  const unlockedLevel = unlockNextLevelForScore(gameConfig, score);
  if (unlockedLevel) {
    setFeedbackMessage(resultFeedbackEl, t('feedback.unlockMilestone', { level: settingLabel(unlockedLevel) }), 'unlock');
    applyLevelLocks();
  } else {
    const scoreHits = getAchievedMilestones(score, SCORE_MILESTONES, 0);
    if (scoreHits.length) {
      const milestone = scoreHits[scoreHits.length - 1];
      setFeedbackMessage(resultFeedbackEl, t('feedback.scoreMilestone', { n: milestone }), 'milestone');
    }
  }

  renderLeaderboard(gameConfig);
}

function startGameRound() {
  autoListenEnabled = true;
  score = 0;
  secondsLeft = 60;
  fuel = 0;
  turboRemaining = 0;
  consecutiveCorrect = 0;
  scoreEl.textContent = '0';
  timeLeftEl.textContent = '60';
  lastQuestionKey = null;
  currentStreak = 0;
  setFeedbackMessage(gameFeedbackEl);
  updateFuelUi();

  showOnly(gameScreen);
  vehicleSprite.classList.add('is-driving');
  makeQuestion(gameConfig);

  timerInterval = setInterval(() => {
    secondsLeft -= 1;
    timeLeftEl.textContent = String(secondsLeft);
    if (secondsLeft <= 0) {
      finishGame();
    }
  }, 1000);
}

function startCountdownThenGame() {
  let count = 3;
  showOnly(countdownScreen);
  countdownEl.textContent = '3';

  const interval = setInterval(() => {
    count -= 1;
    if (count > 0) {
      countdownEl.textContent = String(count);
      beep({ frequency: 480, duration: 0.08, type: 'triangle', volume: 0.06 });
    } else {
      countdownEl.textContent = t('countdown.go');
      beep({ frequency: 980, duration: 0.18, type: 'triangle', volume: 0.08 });
      clearInterval(interval);
      setTimeout(startGameRound, 600);
    }
  }, 1000);
}

function login(name) {
  activeUser = name.trim();
  localStorage.setItem(STORAGE_KEYS.activeUser, activeUser);
  activePlayerNameEl.textContent = activeUser;

  const unlockedLevels = getUserProgress(activeUser);
  saveUserProgress(activeUser, unlockedLevels);
  ensureGameConfigIsUnlocked();
  syncSelectorsFromGameConfig();
  applyLevelLocks();
  renderLeaderboard(gameConfig);
  applyVehiclePrefs(getVehiclePrefs(activeUser));
  setSessionVisibility(true);
}

function logout() {
  activeUser = null;
  vehicleSprite.classList.remove('is-driving');
  localStorage.removeItem(STORAGE_KEYS.activeUser);
  setSessionVisibility(false);
  loginNameInput.value = '';
  loginNameInput.focus();
}

startBtn.addEventListener('click', () => {
  gameConfig = {
    maxTable: Number(maxTableSelect.value),
    mode: getMode(),
  };
  ensureGameConfigIsUnlocked();
  syncSelectorsFromGameConfig();
  renderLeaderboard(gameConfig);
  startCountdownThenGame();
});

answerInput.addEventListener('input', maybeAutoCheckAnswer);
languageSelect.addEventListener('change', () => {
  currentLanguage = languageSelect.value;
  localStorage.setItem(STORAGE_KEYS.language, currentLanguage);
  stopActiveRecording();
  applyTranslations();
});

submitAnswerBtn.addEventListener('click', checkAnswer);
voiceRetryBtn.addEventListener('click', startAutoListening);
answerInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    checkAnswer();
  }
});

playAgainBtn.addEventListener('click', () => {
  showOnly(setupScreen);
  gameConfig = {
    maxTable: Number(maxTableSelect.value),
    mode: getMode(),
  };
  ensureGameConfigIsUnlocked();
  syncSelectorsFromGameConfig();
  renderLeaderboard(gameConfig);
});

loginBtn.addEventListener('click', () => {
  const name = loginNameInput.value.trim();
  if (!name) return;
  login(name);
});

loginNameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    loginBtn.click();
  }
});

logoutBtn.addEventListener('click', logout);

document.querySelectorAll('input[name="mode"]').forEach((el) => {
  el.addEventListener('change', () => {
    gameConfig = { maxTable: Number(maxTableSelect.value), mode: getMode() };
    ensureGameConfigIsUnlocked();
    syncSelectorsFromGameConfig();
    renderLeaderboard(gameConfig);
  });
});

maxTableSelect.addEventListener('change', () => {
  gameConfig = { maxTable: Number(maxTableSelect.value), mode: getMode() };
  ensureGameConfigIsUnlocked();
  syncSelectorsFromGameConfig();
  renderLeaderboard(gameConfig);
});


vehicleVariantSelect.addEventListener('change', () => {
  const prefs = sanitizeVehiclePrefs({
    variant: vehicleVariantSelect.value,
    color: vehicleColorInput.value,
  });
  applyVehiclePrefs(prefs);
  if (activeUser) {
    saveVehiclePrefs(activeUser, prefs);
  }
});

vehicleColorInput.addEventListener('input', () => {
  const prefs = sanitizeVehiclePrefs({
    variant: vehicleVariantSelect.value,
    color: vehicleColorInput.value,
  });
  applyVehiclePrefs(prefs);
  if (activeUser) {
    saveVehiclePrefs(activeUser, prefs);
  }
});

applyVehiclePrefs(DEFAULT_VEHICLE_PREFS);

applyTranslations();
updateInstallButtonVisibility();

if (activeUser) {
  login(activeUser);
} else {
  setSessionVisibility(false);
}
