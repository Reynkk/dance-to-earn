window.addEventListener('DOMContentLoaded', () => {
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
  let pose = null;
  let currentScore = 0;

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  startTrainingBtn.onclick = async () => {
    // Активируем trainerVideo в момент клика (требуется для мобильных устройств)
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

      pose = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}`
      });

      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      let step1Completed = false;
      let step2Completed = false;

      pose.onResults(async results => {
        overlayCanvas.width = videoElement.videoWidth;
        overlayCanvas.height = videoElement.videoHeight;
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

        if (results.poseLandmarks) {
          for (const lm of results.poseLandmarks) {
            overlayCtx.beginPath();
            overlayCtx.arc(lm.x * overlayCanvas.width, lm.y * overlayCanvas.height, 5, 0, 2 * Math.PI);
            overlayCtx.fillStyle = 'red';
            overlayCtx.fill();
          }

          const landmarks = results.poseLandmarks;
          const nose = landmarks[0];
          const leftAnkle = landmarks[27];
          const rightAnkle = landmarks[28];
          const leftWrist = landmarks[15];
          const rightWrist = landmarks[16];

          const allY = landmarks.map(lm => lm.y);
          const minY = Math.min(...allY);
          const maxY = Math.max(...allY);

          const inFrame = (
            minY > 0.05 && maxY < 0.95 &&
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
          await pose.send({ image: videoElement });
        },
        width: 480,
        height: 640
      });
      camera.start();
    } catch (e) {
      messageEl.textContent = "Ошибка доступа к камере: " + e.message;
    }
  };

  function transitionToCornerVideo() {
    videoElement.classList.add("small-video");
  }

  async function showCountdown() {
    countdownOverlay.style.display = "flex";
    countdownOverlay.textContent = "Приготовьтесь";
    await delay(1000);
    for (let i = 3; i > 0; i--) {
      countdownOverlay.textContent = i;
      await delay(1000);
    }
    countdownOverlay.style.display = "none";
  }

  function startTrainerVideo() {
    // Показываем видео тренера
  trainerVideo.style.display = "block";
  trainerVideo.muted = false;

  // Показываем очки
  scoreOverlay.style.display = "flex";

  // Запускаем видео тренера со звуком
  trainerVideo.play().catch(err => {
    console.error("🚫 Не удалось воспроизвести видео тренера:", err);
  });

  // Переводим камеру пользователя в угол (если еще не сделано)
  videoElement.classList.add("small-video");
  overlayCanvas.classList.add("small-video");

  // Начинаем обновление очков
  const interval = setInterval(() => {
    currentScore += Math.floor(Math.random() * 3); // имитация набора очков
    scoreValue.textContent = currentScore;
  }, 500);

  // Когда видео закончится
  trainerVideo.onended = () => {
    clearInterval(interval);

    trainerVideo.style.display = "none";

    // Можно оставить камеру в углу или убрать, на твой выбор:
    // Если хочешь оставить:
    // videoElement.style.display = "block";

    // Если хочешь убрать после тренировки:
    videoElement.style.display = "none";
    videoElement.classList.remove("small-video");
    overlayCanvas.classList.remove("small-video");
    overlayCanvas.style.display = "none";

    scoreOverlay.style.display = "none";

    finalScoreValue.textContent = currentScore;
    finalOverlay.style.display = "flex";
  };
  }

  uploadVideoBtn.onclick = () => {
    uploadVideoInput.click();
  };

  uploadVideoInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    messageEl.textContent = "Обрабатываем видео...";

    try {
      const poseData = await processTrainingVideo(file);
      const jsonStr = JSON.stringify(poseData, null, 2);
      downloadJSON(jsonStr, 'trainer_pose_data.json');
      messageEl.textContent = "Готово! JSON файл с позами сохранен.";
    } catch (err) {
      messageEl.textContent = "Ошибка обработки: " + err.message;
    }
  };

  function downloadJSON(content, fileName) {
    const a = document.createElement('a');
    const file = new Blob([content], { type: 'application/json' });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function processTrainingVideo(videoFile) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(videoFile);
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.playsInline = true;

      video.onloadedmetadata = () => {
        video.pause();
        video.currentTime = 0;
      };

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const json = [];
      let latestResults = null;

      pose = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}`
      });

      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      pose.onResults(results => {
        latestResults = results;
      });

      video.ontimeupdate = async () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        await pose.send({ image: canvas });

        if (latestResults && latestResults.poseLandmarks) {
          json.push({
            frame: Math.floor(video.currentTime * 1000),
            landmarks: latestResults.poseLandmarks.map(lm => ({
              x: lm.x, y: lm.y, z: lm.z, visibility: lm.visibility
            }))
          });
        }

        video.currentTime += 0.2;
      };

      video.onended = () => {
        pose.close();
        URL.revokeObjectURL(video.src);
        resolve(json);
      };

      video.onerror = () => reject(new Error('Ошибка загрузки видео'));
    });
  }

  // Повторная тренировка
  restartBtn.onclick = () => {
    currentScore = 0;
    scoreValue.textContent = currentScore;
    finalOverlay.style.display = "none";
    messageEl.textContent = "";
    document.getElementById("buttons").style.display = "block";
  };
});


















