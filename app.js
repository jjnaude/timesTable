const maxTableSelect = document.getElementById('max-table');
const languageSelect = document.getElementById('language-select');
const startBtn = document.getElementById('start-btn');
const setupScreen = document.getElementById('setup-screen');
const countdownScreen = document.getElementById('countdown-screen');
const gameScreen = document.getElementById('game-screen');
const resultScreen = document.getElementById('result-screen');
const countdownEl = document.getElementById('countdown');
const timeLeftEl = document.getElementById('time-left');
const scoreEl = document.getElementById('score');
const questionEl = document.getElementById('question');
const answerInput = document.getElementById('answer');
const submitAnswerBtn = document.getElementById('submit-answer');
const finalScoreEl = document.getElementById('final-score');
const celebrationEl = document.getElementById('celebration');
const nameForm = document.getElementById('name-form');
const playerNameInput = document.getElementById('player-name');
const playAgainBtn = document.getElementById('play-again');
const leaderboardTitle = document.getElementById('leaderboard-title');
const leaderboardList = document.getElementById('leaderboard-list');

let currentLanguage = localStorage.getItem('language') || 'en';
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

for (let i = 2; i <= 12; i += 1) {
  const option = document.createElement('option');
  option.value = String(i);
  option.textContent = `${i}`;
  maxTableSelect.appendChild(option);
}
maxTableSelect.value = '5';

let gameConfig = { maxTable: 5, mode: 'single' };
let score = 0;
let secondsLeft = 60;
let timerInterval = null;
let currentQuestion = null;
let lastQuestionKey = null;
let pendingHighScore = null;

function applyTranslations() {
  document.documentElement.lang = currentLanguage;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });

  maxTableSelect.setAttribute('aria-label', t('aria.highestTimesTable'));
  answerInput.setAttribute('aria-label', t('aria.yourAnswer'));
  languageSelect.setAttribute('aria-label', t('aria.language'));

  if (countdownEl.textContent === TRANSLATIONS.en['countdown.go'] || countdownEl.textContent === TRANSLATIONS.af['countdown.go']) {
    countdownEl.textContent = t('countdown.go');
  }

  renderLeaderboard(gameConfig);
}

function showOnly(screen) {
  [setupScreen, countdownScreen, gameScreen, resultScreen].forEach((el) => el.classList.add('hidden'));
  screen.classList.remove('hidden');
}

function getMode() {
  return document.querySelector('input[name="mode"]:checked').value;
}

function settingKey(config) {
  return `${config.mode}-${config.maxTable}`;
}

function settingLabel(config) {
  return config.mode === 'single'
    ? t('leaderboard.single', { max: config.maxTable })
    : t('leaderboard.mixed', { max: config.maxTable });
}

function getLeaderboard(config) {
  const raw = localStorage.getItem(`leaderboard:${settingKey(config)}`);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLeaderboard(config, entries) {
  localStorage.setItem(`leaderboard:${settingKey(config)}`, JSON.stringify(entries.slice(0, 5)));
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
  const start = 2;
  const end = config.maxTable;
  const values = [];
  if (config.mode === 'single') {
    return [config.maxTable];
  }
  for (let tVal = start; tVal <= end; tVal += 1) values.push(tVal);
  return values;
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

function checkAnswer() {
  if (!currentQuestion) return;
  const val = Number(answerInput.value);
  if (Number.isNaN(val)) return;

  if (val === currentQuestion.answer) {
    score += 1;
    scoreEl.textContent = String(score);
    successSound();
    makeQuestion(gameConfig, false);
  } else {
    score -= 1;
    scoreEl.textContent = String(score);
    failSound();
    answerInput.value = '';
    answerInput.focus();
  }
}

function finishGame() {
  clearInterval(timerInterval);
  timerInterval = null;
  showOnly(resultScreen);
  finalScoreEl.textContent = String(score);
  celebrationEl.classList.add('hidden');
  nameForm.classList.add('hidden');

  const board = getLeaderboard(gameConfig);
  const qualifies = board.length < 5 || score > board[board.length - 1].score;
  if (qualifies) {
    pendingHighScore = { config: { ...gameConfig }, score };
    celebrationEl.classList.remove('hidden');
    nameForm.classList.remove('hidden');
    fanfareSound();
    playerNameInput.value = '';
    playerNameInput.focus();
  } else {
    pendingHighScore = null;
  }

  renderLeaderboard(gameConfig);
}

function startGameRound() {
  score = 0;
  secondsLeft = 60;
  scoreEl.textContent = '0';
  timeLeftEl.textContent = '60';
  lastQuestionKey = null;

  showOnly(gameScreen);
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

startBtn.addEventListener('click', () => {
  gameConfig = {
    maxTable: Number(maxTableSelect.value),
    mode: getMode(),
  };
  renderLeaderboard(gameConfig);
  startCountdownThenGame();
});

languageSelect.addEventListener('change', () => {
  currentLanguage = languageSelect.value;
  localStorage.setItem('language', currentLanguage);
  applyTranslations();
});

submitAnswerBtn.addEventListener('click', checkAnswer);
answerInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    checkAnswer();
  }
});

nameForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!pendingHighScore) return;
  const name = playerNameInput.value.trim() || t('default.player');
  const entries = getLeaderboard(pendingHighScore.config);
  entries.push({ name, score: pendingHighScore.score });
  entries.sort((a, b) => b.score - a.score);
  saveLeaderboard(pendingHighScore.config, entries);
  pendingHighScore = null;
  nameForm.classList.add('hidden');
  renderLeaderboard(gameConfig);
});

playAgainBtn.addEventListener('click', () => {
  showOnly(setupScreen);
  gameConfig = {
    maxTable: Number(maxTableSelect.value),
    mode: getMode(),
  };
  renderLeaderboard(gameConfig);
});

document.querySelectorAll('input[name="mode"]').forEach((el) => {
  el.addEventListener('change', () => {
    gameConfig = { maxTable: Number(maxTableSelect.value), mode: getMode() };
    renderLeaderboard(gameConfig);
  });
});

maxTableSelect.addEventListener('change', () => {
  gameConfig = { maxTable: Number(maxTableSelect.value), mode: getMode() };
  renderLeaderboard(gameConfig);
});

applyTranslations();
