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
  let camera = null;
  let pose = null;

  let currentScore = 0;

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  startTrainingBtn.onclick = async () => {
    // Скрываем кнопки, показываем калибровку
    document.getElementById("buttons").style.display = "none";
    document.getElementById("calibrationOverlay").style.display = "block";
    document.getElementById("calibrationMessage").textContent = "Пожалуйста, пройдите калибровку";

    try {
      videoElement.style.display = "block"; // Показываем камеру полноэкранно

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
        overlayCanvas.width = 160;
        overlayCanvas.height = 120;
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

        if (results.poseLandmarks) {
          for (const lm of results.poseLandmarks) {
             overlayCtx.beginPath();
             overlayCtx.arc(lm.x * 160, lm.y * 120, 4, 0, 2 * Math.PI);
             overlayCtx.fillStyle = 'red';
             overlayCtx.fill();
          }

          const landmarks = results.poseLandmarks;
          const nose = landmarks[0];
          const leftAnkle = landmarks[27];
          const rightAnkle = landmarks[28];
          const leftWrist = landmarks[15];
          const rightWrist = landmarks[16];

          // Условие 1: человек полностью в кадре
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

          // Условие 2: обе руки подняты выше головы
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

            // После небольшой паузы:
            setTimeout(async () => {
              document.getElementById("calibrationOverlay").style.display = "none";
              // Добавляем класс, который уменьшит видео камеры и переместит в правый нижний угол
              videoElement.classList.add("small-video");
              // Запускаем обратный отсчет
              await showCountdown();
              // Запускаем видео тренера
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

  // Обратный отсчет перед стартом видео тренера
  async function showCountdown() {
    countdownOverlay.style.display = "flex"; // Показываем оверлей с центровкой
    countdownOverlay.textContent = "Приготовьтесь";
    await delay(1000);
    for (let i = 3; i > 0; i--) {
      countdownOverlay.textContent = i;
      await delay(1000);
    }
    countdownOverlay.style.display = "none";
  }

  // Запуск видео тренера и обновление счета
  function startTrainerVideo() {
    trainerVideo.src = "trainer.mp4"; // Путь к видео тренера
    trainerVideo.style.display = "block";
    trainerVideo.style.width = "100vw";   // Видео на весь экран по ширине
    trainerVideo.style.height = "auto";   // Авто высота для сохранения пропорций
    trainerVideo.style.position = "fixed";
    trainerVideo.style.top = "0";
    trainerVideo.style.left = "0";
    trainerVideo.style.zIndex = "9";

    trainerVideo.play();

    scoreOverlay.style.display = "flex";  // Показываем счет с центровкой

    const interval = setInterval(() => {
      // Здесь должна быть твоя логика подсчета очков, пока пример с рандомом
      currentScore += Math.floor(Math.random() * 3);
      scoreValue.textContent = currentScore;
    }, 500);

    trainerVideo.onended = () => {
      clearInterval(interval);
      trainerVideo.style.display = "none";
      // Камера остается в углу (класс small-video не удаляем)
      scoreOverlay.textContent = `Ваш счёт: ${currentScore}`;
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
});










