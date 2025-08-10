/* script.js
   - Splash -> Auth (Telegram WebApp) -> TON Connect -> Main App (3 tabs)
   - Training tab contains previous training UI (camera/cali).
*/

/* ------------- Конфигурация (замени перед деплоем) ------------- */
const BOT_USERNAME = "DanceEarn_bot"; // <-- заменить (без @) для Telegram Login Widget fallback
const TONCONNECT_MANIFEST_URL = "https://yourdomain.com/tonconnect-manifest.json"; // <-- заменить реальным manifest URL
const TRAINER_VIDEO_PATH = "trainer.mp4"; // или ссылка

/* ------------- DOM элементы ------------- */
const splashEl = document.getElementById("splash");
const authEl = document.getElementById("auth");
const appEl = document.getElementById("app");

const tgProfileEl = document.getElementById("tgProfile");
const tgAvatarEl = document.getElementById("tgAvatar");
const tgNameEl = document.getElementById("tgName");
const tgUsernameEl = document.getElementById("tgUsername");
const proceedBtn = document.getElementById("proceedBtn");
const connectTonBtn = document.getElementById("connectTonBtn");
const tonStatusEl = document.getElementById("tonStatus");

const userInfoEl = document.getElementById("userInfo");
const walletInfoEl = document.getElementById("walletInfo");

const pages = document.querySelectorAll(".page");
const navButtons = document.querySelectorAll(".nav-btn");

/* training elements */
const startTrainingBtn = document.getElementById("startTrainingBtn");
const uploadVideoBtn = document.getElementById("uploadVideoBtn");
const uploadVideoInput = document.getElementById("uploadVideoInput");
const videoEl = document.getElementById("video");
const overlayCanvas = document.getElementById("overlay");
const calibrationOverlay = document.getElementById("calibrationOverlay");
const countdownOverlay = document.getElementById("countdownOverlay");
const trainerVideo = document.getElementById("trainerVideo");
const scoreOverlay = document.getElementById("scoreOverlay");
const scoreValue = document.getElementById("scoreValue");
const messageEl = document.getElementById("message");

/* ------------- State ------------- */
let currentUser = null;      // {id, first_name, username, ...}
let tonConnector = null;     // TonConnect instance
let tonAccount = null;       // connected account object {account: {...}} - will extract address
let cameraInstance = null;   // MediaPipe Camera (if running)
let poseInstance = null;     // MediaPipe Pose
let currentScore = 0;

/* ----------------- SPLASH -> AUTH flow ----------------- */
async function showSplashThenAuth() {
  splashEl.classList.remove("hidden");
  await delay(1800); // показать splash ~1.8s
  splashEl.classList.add("hidden");
  // показать экран авторизации
  authEl.classList.remove("hidden");

  // проверим, есть ли Telegram WebApp (запущено внутри Telegram)
  if (window.Telegram && window.Telegram.WebApp) {
    // Telegram Web App present
    const tg = window.Telegram.WebApp;
    // доступные данные: tg.initDataUnsafe.user (если разрешено)
    try {
      const info = tg.initDataUnsafe?.user || null;
      if (info) {
        populateTelegramProfile(info);
        currentUser = info;
        proceedBtn.disabled = false;
      } else {
        // если нет данных, можно предложить нажать login виджет
        proceedBtn.disabled = true;
      }
    } catch (err) {
      console.warn("Telegram init info not available", err);
    }
  } else {
    // не внутри Telegram — покажем виджет (уже в HTML). Пользователь должен нажать Login.
    // fallback: enable proceed only after Telegram Login widget calls onTelegramAuth
    proceedBtn.disabled = true;
  }

  // Восстановление TonConnect если был ранее
  initTonConnect();
}

/* helper */
function delay(ms){ return new Promise(r=>setTimeout(r, ms)); }

/* Called by Telegram Login Widget (global scope required by widget) */
window.onTelegramAuth = function(user) {
  // Telegram Login Widget передаёт JSON как строку в браузере
  // В виджете атрибут data-onauth="onTelegramAuth(user)" вызывает этот callback
  try {
    // 'user' приходит уже объект в большинстве современных бразуеров when called by widget
    currentUser = user;
    populateTelegramProfile(user);
    proceedBtn.disabled = false;
  } catch(e){ console.error(e) }
};

/* fill profile area */
function populateTelegramProfile(user){
  tgProfileEl.classList.remove("hidden");
  if (user.photo_url) {
    tgAvatarEl.src = user.photo_url;
    tgAvatarEl.style.width = "56px";
    tgAvatarEl.style.height = "56px";
    tgAvatarEl.style.borderRadius = "8px";
  }
  tgNameEl.textContent = user.first_name || "";
  tgUsernameEl.textContent = user.username ? "@" + user.username : "";
  // show in header
  userInfoEl.textContent = (user.first_name || "") + (user.username ? " ("+user.username+")" : "");
}

/* Proceed button */
proceedBtn.addEventListener("click", () => {
  if (!currentUser) {
    alert("Пожалуйста, войдите через Telegram.");
    return;
  }
  // Если TON не подключен — можно позволить зайти, но лучше требовать привязку (по желанию)
  // Здесь разрешаем продолжить
  authEl.classList.add("hidden");
  appEl.classList.remove("hidden");
});

/* ----------------- TonConnect integration ----------------- */
/* Real integration using TonConnect SDK. See docs: https://github.com/ton-connect/tonconnect
   Important: manifest URL must be served via HTTPS and contain required fields.
*/
async function initTonConnect(){
  if (!window.TonConnect) {
    tonStatusEl.textContent = "TonConnect SDK не найден";
    return;
  }
  try {
    // manifestUrl should point to a JSON manifest describing the DApp
    tonConnector = new TonConnect.TonConnect({
      manifestUrl: TONCONNECT_MANIFEST_URL // <-- replace with your manifest
    });

    // reconnect automatically if previously connected
    await tonConnector.reconnectIfNeeded();
    const activePair = tonConnector?.account;
    if (activePair) {
      tonAccount = activePair;
      showTonConnected(activePair);
    } else {
      tonStatusEl.textContent = "TON кошелёк не подключён";
    }
  } catch (err) {
    console.warn("TonConnect init error", err);
    tonStatusEl.textContent = "Ошибка инициализации TonConnect";
  }
}

/* connect on button click */
connectTonBtn.addEventListener("click", async () => {
  if (!tonConnector) {
    tonStatusEl.textContent = "TonConnect не инициализирован";
    return;
  }
  try {
    const transport = await tonConnector.connect(); // вызывает UI кошелька
    // after connect, tonConnector.account contains selected account
    tonAccount = tonConnector.account || transport.account;
    showTonConnected(tonAccount);
  } catch (err) {
    console.error("Ton connect failed", err);
    tonStatusEl.textContent = "Отменено или ошибка подключения";
  }
});

function showTonConnected(account){
  tonStatusEl.textContent = "Подключено: " + (account?.account?.address || account?.address || "—");
  walletInfoEl.textContent = "Wallet: " + (account?.account?.address || account?.address || "");
  proceedBtn.disabled = false; // разрешаем перейти в приложение
}

/* ----------------- Bottom navigation ----------------- */
navButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    navButtons.forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    const target = btn.dataset.target;
    pages.forEach(p => p.classList.toggle("active", p.id === target));
  });
});

/* ----------------- TRAINING TAB: camera + calibration flow ----------------- */
/* We'll reuse MediaPipe approach from previous steps. Kept compact here. */

startTrainingBtn.addEventListener("click", async () => {
  messageEl.textContent = "";
  // show camera and calibration UI
  document.getElementById("calibrationOverlay").classList.remove("hidden");
  overlayCanvas.classList.remove("hidden");
  videoEl.classList.remove("hidden");

  // create Pose before starting camera
  poseInstance = new Pose({
    locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}`
  });
  poseInstance.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  // calibration state
  let step1Completed = false;
  let step2Completed = false;

  // onResults handler — more robust check: use min/max Y and visibilities
  poseInstance.onResults(results => {
    if (!results.poseLandmarks) return;
    // draw simple overlay
    overlayCanvas.width = videoEl.videoWidth;
    overlayCanvas.height = videoEl.videoHeight;
    const ctx = overlayCanvas.getContext("2d");
    ctx.clearRect(0,0,overlayCanvas.width, overlayCanvas.height);
    for (const lm of results.poseLandmarks) {
      ctx.beginPath();
      ctx.arc(lm.x * overlayCanvas.width, lm.y * overlayCanvas.height, 4, 0, Math.PI*2);
      ctx.fillStyle = "rgba(0,200,255,0.9)";
      ctx.fill();
    }

    // robust checks
    const l = results.poseLandmarks;
    const nose = l[0], leftWrist = l[15], rightWrist = l[16], leftAnkle = l[27], rightAnkle = l[28];

    // compute min/max y among visible major points
    const ys = l.filter(p=>p.visibility>0.4).map(p=>p.y);
    const minY = ys.length ? Math.min(...ys) : 1;
    const maxY = ys.length ? Math.max(...ys) : 0;

    // condition 1: full body roughly in frame: top not too close to 0, bottom not too close to 1
    const inFrame = (minY > 0.03 && maxY < 0.97 && leftAnkle && rightAnkle && leftAnkle.visibility>0.4 && rightAnkle.visibility>0.4);

    if (!step1Completed && inFrame) {
      step1Completed = true;
      document.getElementById("step1").textContent = "✅ 1. Вы полностью в кадре";
    }

    // condition 2: both wrists above nose and reasonably visible
    const handsUp = (leftWrist && rightWrist && nose && leftWrist.visibility>0.4 && rightWrist.visibility>0.4 && leftWrist.y < nose.y - 0.05 && rightWrist.y < nose.y - 0.05);

    if (step1Completed && !step2Completed && handsUp) {
      step2Completed = true;
      document.getElementById("step2").textContent = "✅ 2. Руки подняты";
      document.getElementById("calibrationMessage").textContent = "Калибровка пройдена";
      // small delay then start countdown -> trainer
      setTimeout(async ()=>{
        document.getElementById("calibrationOverlay").classList.add("hidden");
        transitionToCorner();
        await showCountdown();
        startTrainerSequence();
      }, 700);
    }
  });

  // start camera (MediaPipe Camera util handles getUserMedia)
  cameraInstance = new Camera(videoEl, {
    onFrame: async () => await poseInstance.send({ image: videoEl }),
    width: 640,
    height: 480
  });
  cameraInstance.start();
});

/* helper: move camera to corner */
function transitionToCorner(){
  videoEl.classList.add("small-video");
}

/* countdown */
async function showCountdown(){
  countdownOverlay.classList.remove("hidden");
  countdownOverlay.textContent = "Приготовьтесь";
  await delay(900);
  for (let i=3;i>=1;i--){
    countdownOverlay.textContent = i.toString();
    await delay(800);
  }
  countdownOverlay.classList.add("hidden");
}

/* start trainer video and fake comparison loop (placeholder) */
function startTrainerSequence(){
  trainerVideo.src = TRAINER_VIDEO_PATH;
  trainerVideo.classList.remove("hidden");
  trainerVideo.play();

  currentScore = 0;
  scoreValue.textContent = currentScore;
  scoreOverlay.classList.remove("hidden");

  // Placeholder scoring loop — здесь нужно вставить реальное сравнение движения с эталоном
  const scoringInterval = setInterval(()=>{
    currentScore += Math.floor(Math.random()*4);
    scoreValue.textContent = currentScore;
  }, 700);

  trainerVideo.onended = () => {
    clearInterval(scoringInterval);
    // clean up camera
    if (cameraInstance && cameraInstance.stop) cameraInstance.stop();
    videoEl.classList.add("hidden");
    overlayCanvas.classList.add("hidden");
    trainerVideo.classList.add("hidden");
    // show final score UI (we keep small overlay)
    scoreOverlay.textContent = `Ваш счёт: ${currentScore}`;
    // show buttons again (allow to re-run)
    document.getElementById("buttons").style.display = "block";
  };
}

/* Upload training video -> extract poses (delegated to existing logic).
   For brevity we only accept the file and set trainerVideo.src = objectURL here.
*/
uploadVideoBtn.addEventListener("click", ()=> uploadVideoInput.click());
uploadVideoInput.addEventListener("change", (e)=>{
  const file = e.target.files?.[0];
  if (!file) return;
  trainerVideo.src = URL.createObjectURL(file);
  messageEl.textContent = `Видео загружено: ${file.name}`;
});

/* -------------- Utilities -------------- */
function log(msg){ console.log("[app]",msg) }
function showErr(e){ console.error(e); alert("Ошибка: "+(e?.message||e)); }

/* small helper to start app */
showSplashThenAuth();























