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
const questionEl = document.getElementById('question');
const answerInput = document.getElementById('answer');
const onscreenKeypad = document.getElementById('onscreen-keypad');
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
const vehicleEnvironment = document.getElementById('vehicle-environment');
const vehicleForegroundLayer = document.getElementById('vehicle-foreground-layer');
const vehicleSprite = document.getElementById('vehicle-sprite');
const openGarageBtn = document.getElementById('open-garage-btn');
const garageModal = document.getElementById('garage-modal');
const garageDialog = document.getElementById('garage-dialog');
const garageBackdrop = document.getElementById('garage-backdrop');
const closeGarageBtn = document.getElementById('close-garage-btn');
const garageGrid = document.getElementById('garage-grid');
const vehicleColorInput = document.getElementById('vehicle-color');

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

let lastGarageFocus = null;

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


const VEHICLE_ASSETS = {
  bicycle: './assets/vehicles/bicycle.svg',
  hatchback: './assets/vehicles/hatchback.svg',
  lawnmower: './assets/vehicles/lawnmower.svg',
  limousine: './assets/vehicles/limousine.svg',
  miningtruck: './assets/vehicles/miningtruck.svg',
  monsterTruck: './assets/vehicles/monster-truck.svg',
  motorbike: './assets/vehicles/motorbike.svg',
  movingtruck: './assets/vehicles/movingtruck.svg',
  pickup: './assets/vehicles/pickup.svg',
  racecar: './assets/vehicles/racecar.svg',
  suv: './assets/vehicles/suv.svg',
  tractor: './assets/vehicles/tractor.svg',
};

const DEFAULT_VEHICLE_PREFS = {
  variant: 'pickup',
  color: '#2c7be5',
};

const VEHICLE_VARIANT_LIST = Object.keys(VEHICLE_ASSETS);
const VEHICLE_VARIANTS = new Set(VEHICLE_VARIANT_LIST);
const DEFAULT_VEHICLE_TRANSFORM = {
  scale: 1,
  translateX: 0,
  translateY: 0,
  flipX: false,
  garageScale: null,
};

let vehicleTransforms = {};
const VEHICLE_UNLOCK_SCORE_THRESHOLD = 20;
const LOCK_ICON_ASSET = './assets/other/lock.svg';

const VEHICLE_UNLOCK_RULES = VEHICLE_VARIANT_LIST.map((variant, index) => {
  if (index === 0) {
    return {
      variant,
      levelIndex: 0,
      prerequisiteLevelIndex: null,
      scoreThreshold: 0,
    };
  }

  const levelIndex = Math.min(index, LEVEL_SEQUENCE.length - 1);
  return {
    variant,
    levelIndex,
    prerequisiteLevelIndex: levelIndex - 1,
    scoreThreshold: VEHICLE_UNLOCK_SCORE_THRESHOLD,
  };
});

const VEHICLE_UNLOCK_RULES_BY_VARIANT = Object.fromEntries(
  VEHICLE_UNLOCK_RULES.map((rule) => [rule.variant, rule]),
);

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

function getUnlockedVehicleVariants() {
  return VEHICLE_VARIANT_LIST.filter((variant) => isVehicleUnlocked(variant));
}

function isVehicleUnlocked(variant) {
  const rule = VEHICLE_UNLOCK_RULES_BY_VARIANT[variant];
  if (!rule || rule.prerequisiteLevelIndex === null) return true;
  if (!activeUser) return false;

  const unlockedLevels = getUserProgress(activeUser);
  const requiredLevel = LEVEL_SEQUENCE[rule.levelIndex];
  if (!requiredLevel) return false;
  return unlockedLevels.has(configKey(requiredLevel));
}

function getModeLabel(config) {
  if (!config) return '';
  return config.mode === 'single'
    ? t('vehicle.unlockMode.single', { max: config.maxTable })
    : t('vehicle.unlockMode.mixed', { max: config.maxTable });
}

function getVehicleUnlockText(variant) {
  const rule = VEHICLE_UNLOCK_RULES_BY_VARIANT[variant];
  if (!rule || rule.prerequisiteLevelIndex === null) {
    return t('vehicle.unlockAlways');
  }

  const prerequisiteLevel = LEVEL_SEQUENCE[rule.prerequisiteLevelIndex];
  return t('vehicle.unlockHint', {
    score: rule.scoreThreshold,
    modeLabel: getModeLabel(prerequisiteLevel),
  });
}

function sanitizeVehicleTransform(rawTransform = {}) {
  const safeScale = Number(rawTransform.scale);
  const safeTranslateX = Number(rawTransform.translateX);
  const safeTranslateY = Number(rawTransform.translateY);
  const safeGarageScale = Number(rawTransform.garageScale);

  return {
    scale: Number.isFinite(safeScale) ? safeScale : DEFAULT_VEHICLE_TRANSFORM.scale,
    translateX: Number.isFinite(safeTranslateX) ? safeTranslateX : DEFAULT_VEHICLE_TRANSFORM.translateX,
    translateY: Number.isFinite(safeTranslateY) ? safeTranslateY : DEFAULT_VEHICLE_TRANSFORM.translateY,
    flipX: Boolean(rawTransform.flipX),
    garageScale: Number.isFinite(safeGarageScale) ? safeGarageScale : DEFAULT_VEHICLE_TRANSFORM.garageScale,
  };
}

function getVehicleTransform(variant) {
  return {
    ...DEFAULT_VEHICLE_TRANSFORM,
    ...sanitizeVehicleTransform(vehicleTransforms[variant]),
  };
}

async function loadVehicleTransforms() {
  try {
    const response = await fetch('./assets/vehicles/transforms.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = await response.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Vehicle transform config must be an object map');
    }

    vehicleTransforms = Object.fromEntries(
      Object.entries(parsed).map(([variant, transform]) => [variant, sanitizeVehicleTransform(transform)]),
    );
  } catch (error) {
    console.warn('Failed to load vehicle transforms, using defaults.', error);
    vehicleTransforms = {};
  }
}

function applyVehiclePrefs(prefs) {
  const safePrefs = sanitizeVehiclePrefs(prefs);
  const unlocked = getUnlockedVehicleVariants();
  const activeVariant = unlocked.includes(safePrefs.variant) ? safePrefs.variant : unlocked[0];
  const transform = getVehicleTransform(activeVariant);
  const flipDirection = transform.flipX ? -1 : 1;

  vehicleSprite.style.setProperty('--vehicle-color', safePrefs.color);
  vehicleSprite.style.setProperty('--vehicle-mask-image', `url('${VEHICLE_ASSETS[activeVariant]}')`);
  vehicleSprite.style.setProperty('--vehicle-scale', String(transform.scale));
  vehicleSprite.style.setProperty('--vehicle-translate-x', `${transform.translateX}px`);
  vehicleSprite.style.setProperty('--vehicle-translate-y', `${transform.translateY}px`);
  vehicleSprite.style.setProperty('--vehicle-flip-x', String(flipDirection));

  if (vehicleColorInput.value.toLowerCase() !== safePrefs.color.toLowerCase()) {
    vehicleColorInput.value = safePrefs.color;
  }

  renderGarage(activeVariant, safePrefs.color);

  return { variant: activeVariant, color: safePrefs.color };
}

function createVehicleTile(variant, selectedVariant, color) {
  const optionBtn = document.createElement('button');
  optionBtn.type = 'button';
  optionBtn.className = 'garage-grid__item';
  optionBtn.setAttribute('role', 'option');

  const unlocked = isVehicleUnlocked(variant);
  optionBtn.classList.toggle('is-locked', !unlocked);
  optionBtn.setAttribute('aria-disabled', String(!unlocked));
  optionBtn.setAttribute('aria-selected', String(selectedVariant === variant));

  const unlockHint = getVehicleUnlockText(variant);
  if (!unlocked) {
    optionBtn.title = unlockHint;
    optionBtn.setAttribute('aria-label', `${t(`vehicle.${variant}`)} — ${unlockHint}`);
  } else {
    optionBtn.setAttribute('aria-label', t(`vehicle.${variant}`));
  }

  const icon = document.createElement('div');
  icon.className = 'garage-grid__icon';
  const transform = getVehicleTransform(variant);
  const iconScale = transform.garageScale ?? transform.scale;
  icon.style.setProperty('--vehicle-icon-mask', `url('${VEHICLE_ASSETS[variant]}')`);
  icon.style.setProperty('--vehicle-icon-mask', `url('${unlocked ? VEHICLE_ASSETS[variant] : LOCK_ICON_ASSET}')`);
  icon.style.setProperty('--vehicle-color', color);
  icon.style.setProperty('--vehicle-scale', String(iconScale));
  optionBtn.appendChild(icon);

  const name = document.createElement('span');
  name.className = 'garage-grid__name';
  name.textContent = t(`vehicle.${variant}`);
  optionBtn.appendChild(name);

  if (!unlocked) {
    const lock = document.createElement('span');
    lock.className = 'garage-grid__lock';
    lock.textContent = t('label.locked');
    optionBtn.appendChild(lock);
  }

  optionBtn.addEventListener('click', () => {
    if (!isVehicleUnlocked(variant)) {
      window.alert(t('feedback.vehicleLockedClick', { hint: unlockHint }));
      return;
    }

    const applied = applyVehiclePrefs({ variant, color: vehicleColorInput.value });
    if (activeUser) saveVehiclePrefs(activeUser, applied);
  });

  return optionBtn;
}

function renderGarage(selectedVariant, color) {
  garageGrid.innerHTML = '';
  VEHICLE_VARIANT_LIST.forEach((variant) => {
    garageGrid.appendChild(createVehicleTile(variant, selectedVariant, color));
  });
}

function getGarageFocusableElements() {
  if (!garageDialog) return [];
  return Array.from(garageDialog.querySelectorAll(FOCUSABLE_SELECTOR));
}

function isGarageOpen() {
  return !garageModal.classList.contains('hidden');
}

function closeGarage({ restoreFocus = true } = {}) {
  const wasOpen = isGarageOpen();
  garageModal.classList.add('hidden');
  garageModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');

  if (!wasOpen || !restoreFocus) return;

  if (openGarageBtn && !openGarageBtn.disabled) {
    openGarageBtn.focus();
  } else if (lastGarageFocus instanceof HTMLElement && document.contains(lastGarageFocus)) {
    lastGarageFocus.focus();
  }
}

function openGarage() {
  if (!activeUser) return;
  lastGarageFocus = document.activeElement;
  garageModal.classList.remove('hidden');
  garageModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  const focusable = getGarageFocusableElements();
  if (focusable.length) {
    focusable[0].focus();
  } else {
    garageDialog.focus();
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
    closeGarage({ restoreFocus: false });
  }
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
  openGarageBtn.setAttribute('aria-label', t('aria.openGarage'));
  closeGarageBtn.setAttribute('aria-label', t('aria.closeGarage'));
  garageDialog.setAttribute('aria-label', t('aria.garageDialog'));
  garageGrid.setAttribute('aria-label', t('aria.vehicleVariant'));
  vehicleColorInput.setAttribute('aria-label', t('aria.vehicleColor'));
  onscreenKeypad.setAttribute('aria-label', t('aria.numberKeypad'));

  if (countdownEl.textContent === TRANSLATIONS.en['countdown.go'] || countdownEl.textContent === TRANSLATIONS.af['countdown.go']) {
    countdownEl.textContent = t('countdown.go');
  }

  renderLeaderboard(gameConfig);
  const currentPrefs = getVehiclePrefs(activeUser || '');
  applyVehiclePrefs(currentPrefs);
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


const STREAK_MILESTONES = [5, 10, 15, 20];
const SCORE_MILESTONES = [10, 20, 30, 40, 50];

const SCORE_TO_WORLD_PIXELS = 50;
const FAR_LAYER_PARALLAX_FACTOR = 0.35;
const MID_LAYER_PARALLAX_FACTOR = 0.6;
const NEAR_LAYER_PARALLAX_FACTOR = 1;
const NEAREST_LAYER_PARALLAX_FACTOR = 2;
const WORLD_PIXELS_PER_BACKGROUND_UNIT = 10;
const BACKGROUND_RENDER_BUFFER_PIXELS = 300;

const DEFAULT_BACKGROUND_OBJECT = {
  translateY: 0,
  scale: 1,
  frequency: 0,
  levels: [],
};

let backgroundObjectConfig = [];
let backgroundPlacementState = null;
const WORLD_OFFSET_SETTLE_DURATION_MS = 3000;

let worldOffset = 0;
let worldOffsetSpline = null;
let worldOffsetAnimationFrameId = null;

function buildCubicSplineSegment({
  startTimeMs,
  durationMs,
  startPosition,
  startVelocity,
  endPosition,
  endVelocity,
}) {
  const durationSeconds = durationMs / 1000;

  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return {
      startTimeMs,
      endTimeMs: startTimeMs,
      durationSeconds: 0,
      a: 0,
      b: 0,
      c: 0,
      d: endPosition,
      endPosition,
      endVelocity,
    };
  }

  const T = durationSeconds;
  const deltaPosition = endPosition - startPosition;
  const deltaVelocity = endVelocity - startVelocity;

  const a = (deltaVelocity * T - 2 * (deltaPosition - startVelocity * T)) / (T ** 3);
  const b = (deltaVelocity - 3 * a * (T ** 2)) / (2 * T);

  return {
    startTimeMs,
    endTimeMs: startTimeMs + durationMs,
    durationSeconds,
    a,
    b,
    c: startVelocity,
    d: startPosition,
    endPosition,
    endVelocity,
  };
}

function evaluateSplineStateAt(spline, timeMs) {
  if (!spline) {
    return { position: worldOffset, velocity: 0 };
  }

  if (timeMs <= spline.startTimeMs) {
    return { position: spline.d, velocity: spline.c };
  }

  if (timeMs >= spline.endTimeMs || spline.durationSeconds <= 0) {
    return { position: spline.endPosition, velocity: spline.endVelocity };
  }

  const elapsedSeconds = (timeMs - spline.startTimeMs) / 1000;
  const position = (((spline.a * elapsedSeconds) + spline.b) * elapsedSeconds + spline.c) * elapsedSeconds + spline.d;
  const velocity = (3 * spline.a * (elapsedSeconds ** 2)) + (2 * spline.b * elapsedSeconds) + spline.c;
  return { position, velocity };
}

function applyWorldOffset() {
  vehicleEnvironment.style.setProperty('--hills-offset-far-x', `${-worldOffset * FAR_LAYER_PARALLAX_FACTOR}px`);
  vehicleEnvironment.style.setProperty('--hills-offset-mid-x', `${-worldOffset * MID_LAYER_PARALLAX_FACTOR}px`);
  vehicleEnvironment.style.setProperty('--hills-offset-near-x', `${-worldOffset * NEAR_LAYER_PARALLAX_FACTOR}px`);
  renderForegroundBackgroundLayer();
}

function hashSeed(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRng(seedValue) {
  let seed = hashSeed(seedValue);
  return function rng() {
    seed += 0x6D2B79F5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sanitizeBackgroundObject(rawObject = {}) {
  const translateY = Number(rawObject.translateY);
  const scale = Number(rawObject.scale);
  const frequency = Number(rawObject.frequency);
  const levels = Array.isArray(rawObject.levels)
    ? rawObject.levels.map((level) => Number(level)).filter((level) => Number.isInteger(level) && level >= 2 && level <= 12)
    : [];

  return {
    id: String(rawObject.id || ''),
    asset: String(rawObject.asset || ''),
    translateY: Number.isFinite(translateY) ? translateY : DEFAULT_BACKGROUND_OBJECT.translateY,
    scale: Number.isFinite(scale) ? scale : DEFAULT_BACKGROUND_OBJECT.scale,
    frequency: Number.isFinite(frequency) && frequency > 0 ? frequency : DEFAULT_BACKGROUND_OBJECT.frequency,
    levels,
  };
}

async function loadBackgroundObjectConfig() {
  try {
    const response = await fetch('./assets/background/objects.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = await response.json();
    if (!Array.isArray(parsed)) {
      throw new Error('Background object config must be an array');
    }

    backgroundObjectConfig = parsed
      .map((item) => sanitizeBackgroundObject(item))
      .filter((item) => item.id && item.asset && item.frequency > 0 && item.levels.length > 0);
  } catch (error) {
    console.warn('Failed to load background objects config, using no foreground objects.', error);
    backgroundObjectConfig = [];
  }
}

function resetForegroundPlacements() {
  const seed = `${configKey(gameConfig)}-max:${gameConfig.maxTable}`;
  const eligibleObjects = backgroundObjectConfig.filter((item) => item.levels.includes(gameConfig.maxTable));
  backgroundPlacementState = {
    rng: createSeededRng(seed),
    generatedUnit: 0,
    placements: [],
    eligibleObjects,
  };
  renderForegroundBackgroundLayer();
}

function ensureForegroundPlacementsUntil(targetUnit) {
  if (!backgroundPlacementState) return;

  while (backgroundPlacementState.generatedUnit < targetUnit) {
    backgroundPlacementState.generatedUnit += 1;
    const unit = backgroundPlacementState.generatedUnit;

    backgroundPlacementState.eligibleObjects.forEach((item) => {
      if (backgroundPlacementState.rng() < item.frequency) {
        const jitterUnit = backgroundPlacementState.rng();
        backgroundPlacementState.placements.push({
          worldX: (unit + jitterUnit) * WORLD_PIXELS_PER_BACKGROUND_UNIT,
          translateY: item.translateY,
          scale: item.scale,
          asset: item.asset,
        });
      }
    });
  }
}

function renderForegroundBackgroundLayer() {
  if (!vehicleForegroundLayer) return;
  if (!backgroundPlacementState || !backgroundPlacementState.eligibleObjects.length) {
    vehicleForegroundLayer.innerHTML = '';
    return;
  }

  const layerOffset = worldOffset * NEAREST_LAYER_PARALLAX_FACTOR;
  const width = vehicleForegroundLayer.clientWidth || vehicleEnvironment.clientWidth || 0;
  const viewStart = Math.max(0, layerOffset - BACKGROUND_RENDER_BUFFER_PIXELS);
  const viewEnd = layerOffset + width + BACKGROUND_RENDER_BUFFER_PIXELS;
  const targetUnit = Math.ceil(viewEnd / WORLD_PIXELS_PER_BACKGROUND_UNIT);

  ensureForegroundPlacementsUntil(targetUnit);

  const visible = backgroundPlacementState.placements.filter(
    (placement) => placement.worldX >= viewStart && placement.worldX <= viewEnd,
  );

  vehicleForegroundLayer.innerHTML = visible
    .map((placement) => {
      const left = placement.worldX - layerOffset;
      return `<div class="vehicle-stage__foreground-object" style="left:${left}px;background-image:url('${placement.asset}');transform:translate(-50%, ${placement.translateY}px) scale(${placement.scale});"></div>`;
    })
    .join('');
}

function updateWorldOffsetFromScore() {
  const now = performance.now();
  const { position, velocity } = evaluateSplineStateAt(worldOffsetSpline, now);
  const targetPosition = score * SCORE_TO_WORLD_PIXELS;

  worldOffsetSpline = buildCubicSplineSegment({
    startTimeMs: now,
    durationMs: WORLD_OFFSET_SETTLE_DURATION_MS,
    startPosition: position,
    startVelocity: velocity,
    endPosition: targetPosition,
    endVelocity: 0,
  });

  worldOffset = position;
  applyWorldOffset();
}

function resetWorldOffset() {
  worldOffset = 0;
  worldOffsetSpline = null;
  applyWorldOffset();
}

function animateWorldOffset() {
  const now = performance.now();
  const { position } = evaluateSplineStateAt(worldOffsetSpline, now);

  if (position !== worldOffset) {
    worldOffset = position;
    applyWorldOffset();
  }

  worldOffsetAnimationFrameId = window.requestAnimationFrame(animateWorldOffset);
}

function ensureWorldOffsetAnimationLoop() {
  if (worldOffsetAnimationFrameId !== null) return;
  worldOffsetAnimationFrameId = window.requestAnimationFrame(animateWorldOffset);
}

function updateVehicleRoadPosition() {
  applyWorldOffset();
}

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
}

function beep({ frequency, duration = 0.18, type = 'sine', volume = 0.06 }) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const audio = new AudioCtx();
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
  } catch (error) {
    console.warn('Unable to play countdown/game sound.', error);
  }
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

function checkAnswer() {
  if (!currentQuestion) return;
  const val = Number(answerInput.value);
  if (Number.isNaN(val)) return;

  const previousScore = score;
  const previousStreak = currentStreak;

  if (val === currentQuestion.answer) {
    score += 1;
    currentStreak += 1;
    scoreEl.textContent = String(score);
    updateWorldOffsetFromScore();
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
    score -= 1;
    currentStreak = 0;
    scoreEl.textContent = String(score);
    updateWorldOffsetFromScore();
    failSound();
    setFeedbackMessage(gameFeedbackEl, t('feedback.tryAgain'), 'unlock');
    answerInput.value = '';
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
  clearInterval(timerInterval);
  vehicleSprite.classList.remove('is-driving');
  vehicleEnvironment.classList.remove('is-driving');
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
  score = 0;
  secondsLeft = 60;
  scoreEl.textContent = '0';
  timeLeftEl.textContent = '60';
  lastQuestionKey = null;
  currentStreak = 0;
  setFeedbackMessage(gameFeedbackEl);
  resetWorldOffset();
  resetForegroundPlacements();

  showOnly(gameScreen);
  vehicleSprite.classList.add('is-driving');
  vehicleEnvironment.classList.add('is-driving');
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
  showOnly(countdownScreen);
  const countdownSteps = [
    { label: '3', frequency: 480, duration: 0.08, type: 'triangle', volume: 0.06 },
    { label: '2', frequency: 480, duration: 0.08, type: 'triangle', volume: 0.06 },
    { label: '1', frequency: 480, duration: 0.08, type: 'triangle', volume: 0.06 },
    { label: t('countdown.go'), frequency: 980, duration: 0.18, type: 'triangle', volume: 0.08 },
  ];

  countdownSteps.forEach((step, index) => {
    setTimeout(() => {
      countdownEl.textContent = step.label;
      beep(step);
    }, index * 1000);
  });

  const totalCountdownDurationMs = (countdownSteps.length - 1) * 1000 + 600;
  setTimeout(startGameRound, totalCountdownDurationMs);
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
  const appliedPrefs = applyVehiclePrefs(getVehiclePrefs(activeUser));
  saveVehiclePrefs(activeUser, appliedPrefs);
  closeGarage();
  setSessionVisibility(true);
  resetWorldOffset();
  resetForegroundPlacements();
  ensureWorldOffsetAnimationLoop();
}

function logout() {
  activeUser = null;
  vehicleSprite.classList.remove('is-driving');
  vehicleEnvironment.classList.remove('is-driving');
  localStorage.removeItem(STORAGE_KEYS.activeUser);
  resetWorldOffset();
  backgroundPlacementState = null;
  renderForegroundBackgroundLayer();
  closeGarage();
  setSessionVisibility(false);
  loginNameInput.value = '';
  loginNameInput.focus();
}

window.addEventListener('resize', () => {
  updateVehicleRoadPosition();
});

startBtn.addEventListener('click', () => {
  gameConfig = {
    maxTable: Number(maxTableSelect.value),
    mode: getMode(),
  };
  ensureGameConfigIsUnlocked();
  syncSelectorsFromGameConfig();
  renderLeaderboard(gameConfig);
  closeGarage();
  startCountdownThenGame();
});

answerInput.addEventListener('input', maybeAutoCheckAnswer);
languageSelect.addEventListener('change', () => {
  currentLanguage = languageSelect.value;
  localStorage.setItem(STORAGE_KEYS.language, currentLanguage);
  applyTranslations();
});




function appendAnswerDigit(digit) {
  const nextValue = `${answerInput.value}${digit}`;
  answerInput.value = nextValue.replace(/^0+(?=\d)/, '');
  maybeAutoCheckAnswer();
}

function backspaceAnswer() {
  answerInput.value = answerInput.value.slice(0, -1);
}

function clearAnswer() {
  answerInput.value = '';
}

function handleKeypadAction(action) {
  if (action === 'submit') {
    checkAnswer();
  } else if (action === 'backspace') {
    backspaceAnswer();
  } else if (action === 'clear') {
    clearAnswer();
  }
}

onscreenKeypad.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;

  const key = button.dataset.key;
  if (key) {
    appendAnswerDigit(key);
    return;
  }

  const action = button.dataset.action;
  if (action) handleKeypadAction(action);
});

document.addEventListener('keydown', (event) => {
  if (gameScreen.classList.contains('hidden')) return;
  if (event.key >= '0' && event.key <= '9') {
    event.preventDefault();
    appendAnswerDigit(event.key);
    return;
  }

  if (event.key === 'Backspace') {
    event.preventDefault();
    backspaceAnswer();
    return;
  }

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
  closeGarage();
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
openGarageBtn.addEventListener('click', openGarage);
closeGarageBtn.addEventListener('click', () => closeGarage());
garageBackdrop.addEventListener('click', () => closeGarage());

document.addEventListener('keydown', (event) => {
  if (!isGarageOpen()) return;

  if (event.key === 'Escape') {
    event.preventDefault();
    closeGarage();
    return;
  }

  if (event.key !== 'Tab') return;

  const focusable = getGarageFocusableElements();
  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

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

vehicleColorInput.addEventListener('input', () => {
  const prefs = sanitizeVehiclePrefs({
    variant: getVehiclePrefs(activeUser || '').variant,
    color: vehicleColorInput.value,
  });
  const applied = applyVehiclePrefs(prefs);
  if (activeUser) {
    saveVehiclePrefs(activeUser, applied);
  }
});

async function initializeApp() {
  await Promise.all([loadVehicleTransforms(), loadBackgroundObjectConfig()]);
  applyVehiclePrefs(DEFAULT_VEHICLE_PREFS);
  applyTranslations();
  updateInstallButtonVisibility();

  if (activeUser) {
    login(activeUser);
  } else {
    setSessionVisibility(false);
  }

  resetWorldOffset();
  resetForegroundPlacements();
  ensureWorldOffsetAnimationLoop();
}

initializeApp();
