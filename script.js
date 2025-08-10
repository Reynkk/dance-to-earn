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
  let poseUser = null;
  let poseTrainer = null;
  let userPoseLandmarks = null;
  let trainerPoseLandmarks = null;
  let currentScore = 0;
  let compareInterval = null;

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Функция сравнения поз - возвращает совпадение 0..1
  // Улучшена за счёт использования средней евклидовой дистанции и нормализации
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

    // Нормализация по максимальному порогу (0.2)
    const similarity = Math.max(0, 1 - avgDist / 0.2);

    return similarity;
  }

  startTrainingBtn.onclick = async () => {
    // Активируем trainerVideo (для мобильных)
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

      // Инициализация MediaPipe Pose для пользователя
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

          // Калибровка: проверяем что пользователь в кадре и руки подняты
          const landmarks = userPoseLandmarks;
          const nose = landmarks[0];
          const leftAnkle = landmarks[27];
          const rightAnkle = landmarks[28];
          const leftWrist = landmarks[15];
          const rightWrist = landmarks[16];

          const allY = landmarks.map(lm => lm.y);
          const minY = Math.min(...allY);
          const maxY = Math.max(...allY);

          // Исправленная проверка, с небольшим запасом
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

      // Инициализация MediaPipe Pose для тренера
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

      // Обработка кадров тренерского видео для получения поз
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
    countdownOverlay.textContent = "Приготовьтесь";
    await delay(1000);
    for (let i = 3; i > 0; i--) {
      countdownOverlay.textContent = i;
      await delay(1000);
    }
    countdownOverlay.style.display = "none";
  }

  function startTrainerVideo() {
    trainerVideo.style.display = "block";
    trainerVideo.muted = false;

    scoreOverlay.style.display = "flex";

    trainerVideo.play().catch(err => {
      console.error("🚫 Не удалось воспроизвести видео тренера:", err);
    });

    videoElement.classList.add("small-video");
    overlayCanvas.classList.add("small-video");

    currentScore = 0;
    scoreValue.textContent = currentScore;

    // Сравниваем позы 2 раза в секунду и начисляем очки
    compareInterval = setInterval(() => {
      if (!userPoseLandmarks || !trainerPoseLandmarks) return;

      const similarity = comparePoses(userPoseLandmarks, trainerPoseLandmarks);

      // Если похожесть > 0.75, начисляем очко
      if (similarity > 0.75) {
        currentScore++;
        scoreValue.textContent = currentScore;
      }

      // Для отладки:
      // console.log("Similarity:", similarity.toFixed(2), "Score:", currentScore);
    }, 500);

    trainerVideo.onended = () => {
      clearInterval(compareInterval);

      trainerVideo.style.display = "none";

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

      const pose = new Pose({
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

  restartBtn.onclick = () => {
    currentScore = 0;
    scoreValue.textContent = currentScore;
    finalOverlay.style.display = "none";
    messageEl.textContent = "";
    document.getElementById("buttons").style.display = "block";
  };
});





















