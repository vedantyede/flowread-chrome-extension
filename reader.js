// ─── FlowRead Reader Engine ─────────────────────────────────

const SPEED_PRESETS = [100, 150, 200, 250, 300, 400, 500, 600, 800, 1000];
const LIMIT_PRESETS = [
  { label: "∞ All", value: null },
  { label: "50",    value: 50   },
  { label: "100",   value: 100  },
  { label: "250",   value: 250  },
  { label: "500",   value: 500  },
];

// ── State ───────────────────────────────────────────────────
let words       = [];
let currentIdx  = 0;
let readerState = "idle";   // idle | reading | paused | done
let wpm         = 250;
let wordLimit   = null;
let timerId     = null;

// ── DOM refs ────────────────────────────────────────────────
const viewReader  = document.getElementById("view-reader");
const viewInput   = document.getElementById("view-input");
const textInput   = document.getElementById("text-input");
const clearBtn    = document.getElementById("clear-btn");
const startBtn    = document.getElementById("start-btn");
const statWords   = document.getElementById("stat-words");
const statChars   = document.getElementById("stat-chars");
const statTime    = document.getElementById("stat-time");
const statTimeCell= document.getElementById("stat-time-cell");
const wpmDisplay  = document.getElementById("wpm-val");
const wpmNudge    = document.getElementById("wpm-nudge-val");

const wBefore  = document.getElementById("w-before");
const wOrp     = document.getElementById("w-orp");
const wAfter   = document.getElementById("w-after");
const ctxPrev2 = document.getElementById("ctx-prev2");
const ctxPrev1 = document.getElementById("ctx-prev1");
const ctxNext1 = document.getElementById("ctx-next1");
const ctxNext2 = document.getElementById("ctx-next2");
const stateBadge = document.getElementById("state-text");
const stateDot   = document.getElementById("state-dot");
const wordCounter= document.getElementById("word-counter");

const progressFill  = document.getElementById("progress-fill");
const btnPlayPause  = document.getElementById("btn-playpause");
const iconPause     = document.getElementById("icon-pause");
const iconPlay      = document.getElementById("icon-play");
const btnEdit       = document.getElementById("btn-edit");
const btnRestart    = document.getElementById("btn-restart");
const btnBack       = document.getElementById("btn-back");
const btnFwd        = document.getElementById("btn-fwd");
const btnSlower     = document.getElementById("btn-slower");
const btnFaster     = document.getElementById("btn-faster");

const speedSliderR  = document.getElementById("speed-slider-r");
const speedValR     = document.getElementById("speed-val-r");
const speedPresetsR = document.getElementById("speed-presets-r");
const speedSliderI  = document.getElementById("speed-slider-i");
const speedValI     = document.getElementById("speed-val-i");
const speedPresetsI = document.getElementById("speed-presets-i");
const limitPresetsEl= document.getElementById("limit-presets");
const limitVal      = document.getElementById("limit-val");

const supportBtn    = document.getElementById("supportBtn");
const modalOverlay  = document.getElementById("modal-overlay");
const modalCloseBtn = document.getElementById("modal-close-btn");

// ── Helpers ─────────────────────────────────────────────────
function highlightWord(word) {
  const i = Math.max(0, Math.floor(word.length * 0.3));
  return { before: word.slice(0, i), orp: word[i] || "", after: word.slice(i + 1) };
}

function clearTimer() {
  if (timerId) { clearTimeout(timerId); timerId = null; }
}

function activeWords() {
  return wordLimit ? words.slice(0, wordLimit) : words;
}

function interval(word) {
  const base = Math.round(60000 / wpm);
  return /[.,!?;:]/.test(word) ? Math.round(base * 1.4) : base;
}

// ── Rendering ────────────────────────────────────────────────
function renderWord(idx) {
  const aw = activeWords();
  const word = aw[idx] || "";
  const { before, orp, after } = highlightWord(word);

  const wordEl = document.getElementById("word-display");
  wordEl.classList.remove("word-flash");
  // Force reflow to restart animation
  void wordEl.offsetWidth;
  wordEl.classList.add("word-flash");

  wBefore.textContent = before;
  wOrp.textContent    = orp;
  wAfter.textContent  = after;

  ctxPrev2.textContent = aw[idx - 2] || "";
  ctxPrev1.textContent = aw[idx - 1] || "";
  ctxNext1.textContent = aw[idx + 1] || "";
  ctxNext2.textContent = aw[idx + 2] || "";

  wordCounter.textContent = `${idx + 1} / ${aw.length}`;

  // Progress
  const pct = aw.length > 0 ? Math.round(((idx + 1) / aw.length) * 100) : 0;
  progressFill.style.width = pct + "%";

  // Stats: time left
  const remaining = Math.ceil((aw.length - idx - 1) / wpm);
  statTime.textContent = `~${remaining}`;
  statTimeCell.style.display = "block";
}

function updateStateBadge() {
  stateBadge.textContent = readerState;
  stateDot.style.display = readerState === "reading" ? "block" : "none";
  iconPause.style.display = readerState === "reading" ? "block" : "none";
  iconPlay.style.display  = readerState !== "reading" ? "block" : "none";
}

function updateWpmUI() {
  const val = wpm + " wpm";
  wpmDisplay.textContent  = wpm;
  wpmNudge.textContent    = wpm;
  speedValR.textContent   = val;
  speedValI.textContent   = val;
  speedSliderR.value      = wpm;
  speedSliderI.value      = wpm;

  // Update active preset buttons
  document.querySelectorAll(".preset-btn[data-wpm]").forEach(btn => {
    btn.classList.toggle("active", parseInt(btn.dataset.wpm) === wpm);
  });
}

function updateLimitUI() {
  const aw = activeWords();
  const total = words.length;
  limitVal.textContent = wordLimit
    ? `${Math.min(wordLimit, total)} of ${total}`
    : `All ${total || "—"}`;
  document.querySelectorAll(".preset-btn[data-limit]").forEach(btn => {
    const v = btn.dataset.limit === "null" ? null : parseInt(btn.dataset.limit);
    btn.classList.toggle("active", v === wordLimit);
  });
}

function updateInputStats() {
  const raw = textInput.value;
  const trimmed = raw.trim();
  const wc = trimmed ? trimmed.split(/\s+/).length : 0;
  statWords.textContent = wc.toLocaleString();
  statChars.textContent = raw.length.toLocaleString();
  clearBtn.style.display = raw ? "flex" : "none";
  startBtn.disabled = wc === 0;
  startBtn.textContent = wc > 0
    ? `Start Reading → ${wordLimit ? Math.min(wc, wordLimit) : wc} words`
    : "Paste text above to begin";
  updateLimitUI();
}

// ── Views ───────────────────────────────────────────────────
function showView(name) {
  viewReader.classList.toggle("active", name === "reader");
  viewInput.classList.toggle("active",  name === "input");
}

// ── Scheduler ───────────────────────────────────────────────
function scheduleNext(idx) {
  clearTimer();
  const aw = activeWords();
  if (idx >= aw.length) {
    readerState = "done";
    updateStateBadge();
    return;
  }
  timerId = setTimeout(() => {
    currentIdx = idx;
    renderWord(currentIdx);
    scheduleNext(currentIdx + 1);
  }, interval(aw[idx]));
}

// ── Actions ─────────────────────────────────────────────────
function startReading(text) {
  const raw = (text || textInput.value).trim();
  if (!raw) return;

  // Save wpm to storage for next session
  chrome.storage.local.set({ savedWpm: wpm });

  words = raw.split(/\s+/).filter(Boolean);
  currentIdx = 0;
  readerState = "reading";
  showView("reader");
  updateStateBadge();
  renderWord(0);
  scheduleNext(1);
}

function pauseReading() {
  clearTimer();
  readerState = "paused";
  updateStateBadge();
}

function resumeReading() {
  readerState = "reading";
  updateStateBadge();
  scheduleNext(currentIdx + 1);
}

function restartReading() {
  clearTimer();
  currentIdx = 0;
  readerState = "reading";
  updateStateBadge();
  renderWord(0);
  scheduleNext(1);
}

function goToInput() {
  clearTimer();
  readerState = "idle";
  statTimeCell.style.display = "none";
  showView("input");
}

function skip(delta) {
  const aw = activeWords();
  const newIdx = Math.max(0, Math.min(aw.length - 1, currentIdx + delta));
  clearTimer();
  currentIdx = newIdx;
  renderWord(currentIdx);
  if (readerState === "reading") scheduleNext(currentIdx + 1);
}

function setWpm(val) {
  wpm = Math.max(80, Math.min(1000, val));
  updateWpmUI();
  if (readerState === "reading") { clearTimer(); scheduleNext(currentIdx + 1); }
}

// ── Build preset buttons ────────────────────────────────────
function buildSpeedPresets(container, suffix) {
  SPEED_PRESETS.forEach(p => {
    const btn = document.createElement("button");
    btn.className = "preset-btn";
    btn.dataset.wpm = p;
    btn.textContent = p;
    btn.addEventListener("click", () => setWpm(p));
    container.appendChild(btn);
  });
}

function buildLimitPresets() {
  LIMIT_PRESETS.forEach(p => {
    const btn = document.createElement("button");
    btn.className = "preset-btn";
    btn.dataset.limit = p.value === null ? "null" : p.value;
    btn.textContent = p.label;
    btn.addEventListener("click", () => {
      wordLimit = p.value;
      updateLimitUI();
      updateInputStats();
    });
    limitPresetsEl.appendChild(btn);
  });
}

// ── Event listeners ──────────────────────────────────────────
textInput.addEventListener("input", updateInputStats);

clearBtn.addEventListener("click", () => {
  textInput.value = "";
  updateInputStats();
});

startBtn.addEventListener("click", () => startReading());

btnPlayPause.addEventListener("click", () => {
  if      (readerState === "reading") pauseReading();
  else if (readerState === "paused")  resumeReading();
  else                                restartReading();
});

btnEdit.addEventListener("click",    goToInput);
btnRestart.addEventListener("click", restartReading);
btnBack.addEventListener("click",    () => skip(-10));
btnFwd.addEventListener("click",     () => skip(10));
btnSlower.addEventListener("click",  () => setWpm(wpm - 50));
btnFaster.addEventListener("click",  () => setWpm(wpm + 50));

speedSliderR.addEventListener("input", () => setWpm(parseInt(speedSliderR.value)));
speedSliderI.addEventListener("input", () => setWpm(parseInt(speedSliderI.value)));

supportBtn.addEventListener("click",    () => modalOverlay.classList.add("open"));
modalCloseBtn.addEventListener("click", () => modalOverlay.classList.remove("open"));
modalOverlay.addEventListener("click",  (e) => { if (e.target === modalOverlay) modalOverlay.classList.remove("open"); });

// Keyboard shortcuts (works on Mac & Windows)
document.addEventListener("keydown", (e) => {
  if (viewReader.classList.contains("active")) {
    switch (e.code) {
      case "Space":
        e.preventDefault();
        if      (readerState === "reading") pauseReading();
        else if (readerState === "paused")  resumeReading();
        else                                restartReading();
        break;
      case "ArrowLeft":  skip(-10); break;
      case "ArrowRight": skip(10);  break;
      case "ArrowUp":    setWpm(wpm + 50); break;
      case "ArrowDown":  setWpm(wpm - 50); break;
      case "KeyR":       if (e.metaKey || e.ctrlKey) { e.preventDefault(); restartReading(); } break;
      case "Escape":     goToInput(); break;
    }
  }
});

// ── Init ─────────────────────────────────────────────────────
function init() {
  buildSpeedPresets(speedPresetsR, "r");
  buildSpeedPresets(speedPresetsI, "i");
  buildLimitPresets();

  // Load saved WPM preference
  chrome.storage.local.get(["pendingText", "savedWpm"], (data) => {
    if (data.savedWpm) {
      wpm = data.savedWpm;
    }

    updateWpmUI();
    updateLimitUI();

    if (data.pendingText) {
      // Clear so it doesn't re-trigger on refresh
      chrome.storage.local.remove("pendingText");
      const text = data.pendingText;

      // Show text in textarea and pre-populate
      textInput.value = text;
      updateInputStats();
      showView("input");
    } else {
      showView("input");
      updateInputStats();
    }
  });
}

init();
