window.addEventListener('DOMContentLoaded', () => {
  // === Элементы UI ===
  const loadingScreen = document.getElementById('loadingScreen');
  const telegramAuth = document.getElementById('telegramAuth');
  const tonConnect = document.getElementById('tonConnect');
  const connectTonBtn = document.getElementById('connectTonBtn');
  const tonAddressEl = document.getElementById('tonAddress');
  const app = document.getElementById('app');

  const tabs = document.querySelectorAll('#tabs button');
  const tabContents = document.querySelectorAll('.tabContent');

  // === Тренировка ===
  const startTrainingBtn = document.getElementById('startTrainingBtn');
  const uploadVideoBtn = document.getElementById('uploadVideoBtn');
  const uploadVideoInput = document.getElementById('uploadVideoInput');
  const videoElement = document.getElementById('video');
  const trainerVideo = document.getElementById('trainerVideo');
  const messageEl = document.getElementById('message');
  const overlayCanvas = document.getElementById('overlay');
  const overlayCtx = overlayCanvas.getContext('2d');
  const countdownOverlay = document.getElementById('countdownOverlay');
  const scoreOverlay = document.getElementById('scoreOverlay');
  const scoreValue = document.getElementById('scoreValue');
  const calibrationOverlay = document.getElementById('calibrationOverlay');
  const finalOverlay = document.getElementById('finalOverlay');
  const finalScoreValue = document.getElementById('finalScoreValue');
  const restartBtn = document.getElementById('restartBtn');

  let camera = null;
  let poseUser = null;
  let poseTrainer = null;
  let userPoseLandmarks = null;
  let trainerPoseLandmarks = null;
  let currentScore = 0;
  let compareInterval = null;

  // === Пользовательские данные ===
  let user = null;
  let tonWalletAddress = null;

  // === Показываем загрузочный экран ===
  showLoading();

  // Инициализация, проверка авторизации и TON-кошелька
  setTimeout(() => {
    const savedUser = localStorage.getItem('tgUser');
    const savedTonAddress = localStorage.getItem('tonWalletAddress');

    if (savedUser) {
      user = JSON.parse(savedUser);
      if (savedTonAddress) {
        tonWalletAddress = savedTonAddress;
        tonAddressEl.textContent = `Адрес кошелька: ${tonWalletAddress}`;
        showApp();
      } else {
        showTonConnect();
      }
    } else {
      showTelegramAuth();
    }
  }, 1500);

  // === UI функции показа экранов ===
  function showLoading() {
    loadingScreen.classList.remove('hidden');
    telegramAuth.classList.add('hidden');
    tonConnect.classList.add('hidden');
    app.classList.add('hidden');
  }

  function showTelegramAuth() {
    loadingScreen.classList.add('hidden');
    telegramAuth.classList.remove('hidden');
    tonConnect.classList.add('hidden');
    app.classList.add('hidden');
  }

  function showTonConnect() {
    loadingScreen.classList.add('hidden');
    telegramAuth.classList.add('hidden');
    tonConnect.classList.remove('hidden');
    app.classList.add('hidden');
  }

  function showApp() {
    loadingScreen.classList.add('hidden');
    telegramAuth.classList.add('hidden');
    tonConnect.classList.add('hidden');
    app.classList.remove('hidden');

    // Инициализируем тренировочный функционал
    initTraining();
  }

  // === Callback для Telegram Login Widget ===
  window.onTelegramAuth = function(userData) {
    if (userData && userData.id) {
      user = userData;
      localStorage.setItem('tgUser', JSON.stringify(userData));
      showTonConnect();
    } else {
      alert('Ошибка авторизации Telegram');
    }
  };

  // Подключение TON-кошелька
  connectTonBtn.onclick = async () => {
    try {
      const TonWeb = window.TonWeb;
      if (!TonWeb) throw new Error("TonWeb не загружен");

      // Для примера — генерация нового кошелька (замени на реальное подключение tonkeeper и т.п.)
      const keyPair = TonWeb.utils.keyPair.fromRandom();

      tonWalletAddress = keyPair.publicKey.toString('hex');

      tonAddressEl.textContent = `Адрес кошелька: ${tonWalletAddress}`;
      localStorage.setItem('tonWalletAddress', tonWalletAddress);

      showApp();
    } catch (e) {
      alert('Ошибка подключения TON: ' + e.message);
    }
  };

  // Логика табов
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const tabName = tab.dataset.tab;
      tabContents.forEach(c => {
        if (c.id === tabName) {
          c.classList.remove('hidden');
          c.classList.add('active');
        } else {
          c.classList.add('hidden');
          c.classList.remove('active');
        }
      });
    });
  });

  // === Тренировочная логика ===
  function initTraining() {
    // Все твои переменные, функции и обработчики, которые ты прислал ранее,
    // перенесены сюда.

    function delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    function comparePoses(landmarks1, landmarks2) {
      if (!landmarks1 || !landmarks2) return 0;

      let totalDist = 0;
      let count = 0;

      for (let i = 0; i < landmarks1.length; i++) {
        if (!landmarks1[i] || !landmarks2[i]) continue;

        const dx = landmarks1[i].x - landmarks2[i].x;
        const dy = landmarks1[i].y - landmarks2[i].y;
        const dz = (landmarks1[i].z || 0) - (landmarks2[i].z || 0);

        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        totalDist += dist;
        count++;
      }
      if (count === 0) return 0;

      const avgDist = totalDist / count;
      const similarity = Math.max(0, 1 - avgDist / 0.2);

      return similarity;
    }

    startTrainingBtn.onclick = async () => {
      trainerVideo.src = "trainer.mp4";
      trainerVideo.load();
      trainerVideo.muted = false;

      try {
        await trainerVideo.play();
        trainerVideo.pause();
        trainerVideo.currentTime = 0;
        console.log("🎥 Тренерское видео предварительно активировано");
      } catch (err) {
        console.warn("⚠️ Видео не активировано:", err);
      }

      document.getElementById("buttons").style.display = "none";
      calibrationOverlay.style.display = "flex";
      document.getElementById("calibrationMessage").textContent = "Пожалуйста, пройдите калибровку";

      try {
        videoElement.style.display = "block";

        poseUser = new Pose({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}`
        });

        poseUser.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        let step1Completed = false;
        let step2Completed = false;

        poseUser.onResults(async results => {
          overlayCanvas.width = videoElement.videoWidth;
          overlayCanvas.height = videoElement.videoHeight;
          overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

          if (results.poseLandmarks) {
            userPoseLandmarks = results.poseLandmarks;
            // Рисуем красные точки пользователя
            for (const lm of userPoseLandmarks) {
              overlayCtx.beginPath();
              overlayCtx.arc(lm.x * overlayCanvas.width, lm.y * overlayCanvas.height, 5, 0, 2 * Math.PI);
              overlayCtx.fillStyle = 'red';
              overlayCtx.fill();
            }

            // Калибровка
            const landmarks = userPoseLandmarks;
            const nose = landmarks[0];
            const leftAnkle = landmarks[27];
            const rightAnkle = landmarks[28];
            const leftWrist = landmarks[15];
            const rightWrist = landmarks[16];

            const allY = landmarks.map(lm => lm.y);
            const minY = Math.min(...allY);
            const maxY = Math.max(...allY);

            const inFrame = (
              minY > 0.02 && maxY < 0.98 &&
              leftAnkle && rightAnkle &&
              leftAnkle.visibility > 0.5 &&
              rightAnkle.visibility > 0.5
            );

            if (!step1Completed && inFrame) {
              step1Completed = true;
              document.getElementById("step1").textContent = "✅ 1. Вы полностью в кадре";
            }

            const handsUp =
              step1Completed &&
              leftWrist && rightWrist && nose &&
              leftWrist.y < nose.y &&
              rightWrist.y < nose.y &&
              leftWrist.visibility > 0.5 &&
              rightWrist.visibility > 0.5;

            if (step1Completed && handsUp && !step2Completed) {
              step2Completed = true;
              document.getElementById("step2").textContent = "✅ 2. Руки подняты";
              document.getElementById("calibrationMessage").textContent = "🎉 Калибровка завершена. Начинаем тренировку!";

              setTimeout(async () => {
                calibrationOverlay.style.display = "none";
                transitionToCornerVideo();
                await showCountdown();
                startTrainerVideo();
              }, 1500);
            }
          }
        });

        camera = new Camera(videoElement, {
          onFrame: async () => {
            await poseUser.send({ image: videoElement });
          },
          width: 480,
          height: 640
        });
        camera.start();

        poseTrainer = new Pose({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}`
        });

        poseTrainer.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        const trainerCanvas = document.createElement('canvas');
        const trainerCtx = trainerCanvas.getContext('2d');

        trainerVideo.addEventListener('play', () => {
          trainerCanvas.width = trainerVideo.videoWidth;
          trainerCanvas.height = trainerVideo.videoHeight;
        });

        poseTrainer.onResults(results => {
          if (results.poseLandmarks) {
            trainerPoseLandmarks = results.poseLandmarks;
          }
        });

        async function processTrainerFrame() {
          if (trainerVideo.paused || trainerVideo.ended) {
            trainerPoseLandmarks = null;
            return;
          }
          trainerCtx.drawImage(trainerVideo, 0, 0, trainerCanvas.width, trainerCanvas.height);
          await poseTrainer.send({ image: trainerCanvas });
          requestAnimationFrame(processTrainerFrame);
        }

        trainerVideo.addEventListener('play', () => {
          processTrainerFrame();
        });

      } catch (e) {
        messageEl.textContent = "Ошибка доступа к камере: " + e.message;
      }
    };

    function transitionToCornerVideo() {
      videoElement.classList.add("small-video");
      overlayCanvas.classList.add("small-video");
    }

    async function showCountdown() {
      countdownOverlay.style.display = "flex";
      for (let i = 3; i >= 1; i--) {
        countdownOverlay.textContent = i;
        await delay(1000);
      }
      countdownOverlay.style.display = "none";
    }

    function startTrainerVideo() {
      trainerVideo.currentTime = 0;
      trainerVideo.play();
      scoreOverlay.style.display = "flex";
      currentScore = 0;
      scoreValue.textContent = currentScore.toFixed(2);

      compareInterval = setInterval(() => {
        const similarity = comparePoses(userPoseLandmarks, trainerPoseLandmarks);
        currentScore += similarity;
        scoreValue.textContent = currentScore.toFixed(2);
      }, 1000);

      trainerVideo.onended = () => {
        clearInterval(compareInterval);
        scoreOverlay.style.display = "none";
        finalScoreValue.textContent = currentScore.toFixed(2);
        finalOverlay.style.display = "flex";
      };
    }

    restartBtn.onclick = () => {
      finalOverlay.style.display = "none";
      document.getElementById("buttons").style.display = "block";
      videoElement.style.display = "none";
      videoElement.classList.remove("small-video");
      overlayCanvas.classList.remove("small-video");
      messageEl.textContent = "";
      currentScore = 0;
      scoreValue.textContent = "0";
      trainerVideo.pause();
      trainerVideo.currentTime = 0;
    };

    uploadVideoBtn.onclick = () => {
      uploadVideoInput.click();
    };

    uploadVideoInput.onchange = (event) => {
      const file = event.target.files[0];
      if (file) {
        const fileURL = URL.createObjectURL(file);
        trainerVideo.src = fileURL;
        trainerVideo.load();
        messageEl.textContent = "Видео загружено. Готово к тренировке.";
      }
    };
  }
});
























