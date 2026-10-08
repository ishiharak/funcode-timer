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

const durationSelect = document.querySelector("#duration");
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

let totalMinutes = DEFAULT_DURATION;
let elapsedBeforeStart = 0;
let startedAt = null;
let intervalId = null;
let currentPhase = 0;

function getElapsedSeconds() {
  return elapsedBeforeStart + (startedAt === null ? 0 : (Date.now() - startedAt) / 1000);
}

function getPhases() {
  const phases = phaseDefinitions.map((phase) => ({ ...phase }));
  phases[4].seconds = totalMinutes * 60 - phases.slice(0, 4).reduce((sum, phase) => sum + phase.seconds, 0);
  return phases;
}

function formatTime(seconds) {
  const roundedSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(roundedSeconds / 60);
  const remainingSeconds = roundedSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function update() {
  const elapsed = Math.min(getElapsedSeconds(), totalMinutes * 60);
  const phases = getPhases();
  let phaseStart = 0;
  currentPhase = phases.findIndex((phase) => {
    const phaseEnd = phaseStart + phase.seconds;
    if (elapsed < phaseEnd) return true;
    phaseStart = phaseEnd;
    return false;
  });

  const completed = currentPhase === -1;
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
  progressFill.style.width = `${(elapsed / (totalMinutes * 60)) * 100}%`;
  progressLabel.innerHTML = `${Math.floor(elapsed / 60)}<span class="progress-divider"> / </span>${totalMinutes}分`;
  progressTrack.setAttribute("aria-valuemax", String(totalMinutes));
  progressTrack.setAttribute("aria-valuenow", String(Math.floor(elapsed / 60)));
  scheduleTotal.textContent = `全 ${totalMinutes} 分`;

  let start = 0;
  scheduleItems.forEach((item, index) => {
    const end = start + phases[index].seconds;
    item.classList.toggle("is-active", !completed && index === currentPhase);
    item.classList.toggle("is-complete", completed || elapsed >= end);
    item.querySelector(".schedule-duration").textContent = `${phases[index].seconds / 60}分`;
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
    elapsedBeforeStart = totalMinutes * 60;
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
  if (startedAt !== null || getElapsedSeconds() >= totalMinutes * 60) return;
  startedAt = Date.now();
  intervalId = window.setInterval(update, 200);
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

update();
