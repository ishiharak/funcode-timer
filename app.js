const DEFAULT_DURATION = 90;
const MIN_DURATION = 61;
const MAX_DURATION = 240;
const phaseDefinitions = [
  { name: "もくもくタイム", seconds: 30 * 60, caption: "自分のペースで、集中しよう。", color: "focus" },
  { name: "休憩", seconds: 5 * 60, caption: "少し休んで、リフレッシュ。", color: "break" },
  { name: "なるほどタイム", seconds: 20 * 60, caption: "みんなで一緒に考えてみよう。", color: "learn" },
  { name: "休憩", seconds: 5 * 60, caption: "もうひと休み。あと少し！", color: "break" },
  { name: "もくもくタイム", seconds: 0, caption: "学んだことを、やってみよう。", color: "focus" },
];
const completionSounds = {
  bell: { notes: [880, 1174], interval: 0.23, duration: 0.42, harmonic: true },
  chime: { notes: [1046, 1318, 1568], interval: 0.13, duration: 0.28, harmonic: true },
  soft: { notes: [659, 880], interval: 0.25, duration: 0.35, waveform: "triangle" },
};

const durationSelect = document.querySelector("#duration");
const soundSelect = document.querySelector("#sound-select");
const phaseName = document.querySelector("#phase-name");
const countdown = document.querySelector("#countdown");
const phaseCaption = document.querySelector("#phase-caption");
const progressLabel = document.querySelector("#progress-label");
const progressTrack = document.querySelector("#progress-track");
const progressFill = document.querySelector("#progress-fill");
const startButton = document.querySelector("#start-button");
const resetButton = document.querySelector("#reset-button");
const statusMessage = document.querySelector("#status-message");
const scheduleItems = [...document.querySelectorAll(".schedule-item")];
const scheduleTotal = document.querySelector("#schedule-total");
const previousPhaseButton = document.querySelector("#previous-phase");
const nextPhaseButton = document.querySelector("#next-phase");
const phasePosition = document.querySelector("#phase-position");
const durationDialog = document.querySelector("#duration-dialog");
const durationForm = document.querySelector("#duration-form");
const customDuration = document.querySelector("#custom-duration");
const muteButton = document.querySelector("#mute-button");
const fullscreenButton = document.querySelector("#fullscreen-button");
const timeAdjustButtons = [...document.querySelectorAll(".time-adjust-button")];

let totalMinutes = DEFAULT_DURATION;
let elapsedBeforeStart = 0;
let startedAt = null;
let intervalId = null;
let currentPhase = 0;
let phaseAdjustments = phaseDefinitions.map(() => 0);
let muted = false;
let audioContext = null;

function getElapsedSeconds() {
  return elapsedBeforeStart + (startedAt === null ? 0 : (Date.now() - startedAt) / 1000);
}

function getPhases() {
  const phases = phaseDefinitions.map((phase) => ({ ...phase }));
  phases.forEach((phase, index) => {
    if (index < phases.length - 1) phase.seconds += phaseAdjustments[index];
  });
  phases[4].seconds =
    totalMinutes * 60 -
    phaseDefinitions.slice(0, 4).reduce((sum, phase) => sum + phase.seconds, 0) +
    phaseAdjustments[4];
  return phases;
}

function getTotalDurationSeconds(phases = getPhases()) {
  return phases.reduce((sum, phase) => sum + phase.seconds, 0);
}

function formatMinutes(seconds) {
  return String(Number((seconds / 60).toFixed(1)));
}

function formatTime(seconds) {
  const roundedSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(roundedSeconds / 60);
  const remainingSeconds = roundedSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function update(shouldPlayPhaseSound = false) {
  const phases = getPhases();
  const totalSeconds = getTotalDurationSeconds(phases);
  const elapsed = Math.min(getElapsedSeconds(), totalSeconds);
  const previousPhase = currentPhase;
  let phaseStart = 0;
  currentPhase = phases.findIndex((phase) => {
    const phaseEnd = phaseStart + phase.seconds;
    if (elapsed < phaseEnd) return true;
    phaseStart = phaseEnd;
    return false;
  });

  const completed = currentPhase === -1;
  if (shouldPlayPhaseSound && currentPhase !== previousPhase) playCompletionSound();
  if (completed) {
    phaseName.textContent = "授業終了";
    countdown.textContent = "00:00";
    phaseCaption.textContent = "今日もおつかれさまでした！";
  } else {
    phaseName.textContent = phases[currentPhase].name;
    countdown.textContent = formatTime(phaseStart + phases[currentPhase].seconds - elapsed);
    phaseCaption.textContent = phases[currentPhase].caption;
  }

  document.querySelector(".phase-marker").dataset.phaseColor = completed ? "complete" : phases[currentPhase].color;
  progressFill.style.width = `${(elapsed / totalSeconds) * 100}%`;
  progressLabel.innerHTML = `${Math.floor(elapsed / 60)}<span class="progress-divider"> / </span>${formatMinutes(totalSeconds)}分`;
  progressTrack.setAttribute("aria-valuemax", String(totalSeconds / 60));
  progressTrack.setAttribute("aria-valuenow", String(elapsed / 60));
  scheduleTotal.textContent = `全 ${formatMinutes(totalSeconds)} 分`;

  let start = 0;
  scheduleItems.forEach((item, index) => {
    const end = start + phases[index].seconds;
    item.classList.toggle("is-active", !completed && index === currentPhase);
    item.classList.toggle("is-complete", completed || elapsed >= end);
    item.querySelector(".schedule-duration").textContent = `${formatMinutes(phases[index].seconds)}分`;
    if (index === currentPhase && !completed) {
      item.querySelector("button").setAttribute("aria-current", "step");
    } else {
      item.querySelector("button").removeAttribute("aria-current");
    }
    start = end;
  });
  const displayedPhase = completed ? phases.length - 1 : currentPhase;
  phasePosition.textContent = `${displayedPhase + 1} / ${phases.length}`;
  previousPhaseButton.disabled = displayedPhase === 0;
  nextPhaseButton.disabled = completed || displayedPhase === phases.length - 1;

  if (completed) {
    stopTimer();
    elapsedBeforeStart = totalSeconds;
    startedAt = null;
    statusMessage.textContent = "授業が終了しました";
    startButton.disabled = true;
  }
}

function stopTimer() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function startTimer() {
  if (startedAt !== null || getElapsedSeconds() >= getTotalDurationSeconds()) return;
  prepareAudio();
  startedAt = Date.now();
  intervalId = window.setInterval(() => update(true), 200);
  startButton.innerHTML = '<span class="button-icon" aria-hidden="true">Ⅱ</span><span>一時停止</span>';
  statusMessage.textContent = "授業中";
  update();
}

function pauseTimer() {
  if (startedAt === null) return;
  elapsedBeforeStart = getElapsedSeconds();
  startedAt = null;
  stopTimer();
  startButton.innerHTML = '<span class="button-icon" aria-hidden="true">▶</span><span>再開</span>';
  statusMessage.textContent = "一時停止中";
  update();
}

function resetTimer() {
  stopTimer();
  elapsedBeforeStart = 0;
  startedAt = null;
  phaseAdjustments = phaseDefinitions.map(() => 0);
  startButton.disabled = false;
  startButton.innerHTML = '<span class="button-icon" aria-hidden="true">▶</span><span>スタート</span>';
  durationSelect.disabled = false;
  statusMessage.textContent = "準備ができたらスタート";
  update();
}

function setDuration(minutes) {
  const wasRunning = startedAt !== null;
  elapsedBeforeStart = getElapsedSeconds();
  totalMinutes = minutes;
  phaseAdjustments = phaseDefinitions.map(() => 0);
  startedAt = wasRunning ? Date.now() : null;
  startButton.disabled = false;
  startButton.innerHTML = wasRunning
    ? '<span class="button-icon" aria-hidden="true">Ⅱ</span><span>一時停止</span>'
    : elapsedBeforeStart > 0
      ? '<span class="button-icon" aria-hidden="true">▶</span><span>再開</span>'
      : '<span class="button-icon" aria-hidden="true">▶</span><span>スタート</span>';
  statusMessage.textContent = wasRunning
    ? "授業中"
    : elapsedBeforeStart > 0
      ? "一時停止中"
      : "準備ができたらスタート";
  update();
}

function goToPhase(index) {
  const phases = getPhases();
  const phaseStart = phases.slice(0, index).reduce((sum, phase) => sum + phase.seconds, 0);
  const wasRunning = startedAt !== null;
  stopTimer();
  elapsedBeforeStart = phaseStart;
  startedAt = wasRunning ? Date.now() : null;

  if (wasRunning) {
    intervalId = window.setInterval(update, 200);
    startButton.innerHTML = '<span class="button-icon" aria-hidden="true">Ⅱ</span><span>一時停止</span>';
    statusMessage.textContent = "授業中";
  } else {
    startButton.disabled = false;
    startButton.innerHTML = '<span class="button-icon" aria-hidden="true">▶</span><span>再開</span>';
    statusMessage.textContent = "一時停止中";
  }
  update();
}

function adjustRemainingTime(deltaSeconds) {
  if (currentPhase < 0) return;
  const phases = getPhases();
  const phaseStart = phases.slice(0, currentPhase).reduce((sum, phase) => sum + phase.seconds, 0);
  const remaining = Math.max(0, phaseStart + phases[currentPhase].seconds - getElapsedSeconds());
  const adjustment = Math.max(deltaSeconds, -remaining);
  phaseAdjustments[currentPhase] += adjustment;
  update();
}

function prepareAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  audioContext ??= new AudioContextClass();
  if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
}

function playCompletionSound() {
  if (muted) return;
  prepareAudio();
  if (!audioContext) return;
  const sound = completionSounds[soundSelect.value] ?? completionSounds.bell;
  const playTone = (frequency, volume, startTime, duration) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.type = sound.waveform ?? "sine";
    oscillator.frequency.setValueAtTime(frequency, startTime);
    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  };
  const startTime = audioContext.currentTime;
  sound.notes.forEach((frequency, index) => {
    const noteStart = startTime + index * sound.interval;
    playTone(frequency, 0.18, noteStart, sound.duration);
    if (sound.harmonic) playTone(frequency * 2.76, 0.035, noteStart, sound.duration * 0.65);
  });
}

startButton.addEventListener("click", () => {
  if (startedAt === null) startTimer();
  else pauseTimer();
});

resetButton.addEventListener("click", resetTimer);
previousPhaseButton.addEventListener("click", () => {
  const phase = currentPhase === -1 ? phaseDefinitions.length - 1 : currentPhase - 1;
  if (phase >= 0) goToPhase(phase);
});
nextPhaseButton.addEventListener("click", () => {
  if (currentPhase >= 0 && currentPhase < phaseDefinitions.length - 1) {
    goToPhase(currentPhase + 1);
  }
});
scheduleItems.forEach((item, index) => {
  item.querySelector("button").addEventListener("click", () => goToPhase(index));
});

durationSelect.addEventListener("change", () => {
  if (durationSelect.value === "custom") {
    customDuration.value = String(totalMinutes);
    durationDialog.showModal();
  } else {
    setDuration(Number(durationSelect.value));
  }
});

durationDialog.addEventListener("close", () => {
  if (durationDialog.returnValue !== "apply") {
    const matchingPreset = [...durationSelect.options].some((option) => option.value === String(totalMinutes));
    durationSelect.value = matchingPreset ? String(totalMinutes) : "custom";
  }
});

durationForm.addEventListener("submit", (event) => {
  if (event.submitter?.value !== "apply") return;
  event.preventDefault();
  const minutes = Number(customDuration.value);
  if (!Number.isInteger(minutes) || minutes < MIN_DURATION || minutes > MAX_DURATION) {
    customDuration.setCustomValidity(`授業時間は${MIN_DURATION}〜${MAX_DURATION}分で設定してください`);
    customDuration.reportValidity();
    return;
  }
  customDuration.setCustomValidity("");
  setDuration(minutes);
  durationSelect.value = "custom";
  durationDialog.close("apply");
});

customDuration.addEventListener("input", () => customDuration.setCustomValidity(""));

muteButton.addEventListener("click", () => {
  muted = !muted;
  muteButton.setAttribute("aria-pressed", String(muted));
  muteButton.setAttribute("aria-label", muted ? "サウンドをオン" : "サウンドを消音");
  muteButton.querySelector("span").textContent = muted ? "🔇" : "🔊";
});

fullscreenButton.disabled = !document.fullscreenEnabled;
fullscreenButton.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.querySelector(".app-shell").requestFullscreen();
  } catch {
    statusMessage.textContent = "全画面表示にできませんでした";
  }
});

document.addEventListener("fullscreenchange", () => {
  const isFullscreen = document.fullscreenElement !== null;
  fullscreenButton.setAttribute("aria-pressed", String(isFullscreen));
  fullscreenButton.setAttribute("aria-label", isFullscreen ? "全画面表示を終了" : "画面を最大化");
  fullscreenButton.title = isFullscreen ? "全画面表示を終了" : "画面を最大化";
});

timeAdjustButtons.forEach((button) => {
  button.addEventListener("click", () => adjustRemainingTime(Number(button.dataset.adjustSeconds)));
});

update();
