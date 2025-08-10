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

  // ➕ Новый элемент для процента совпадения
  const accuracyEl = document.createElement('div');
  accuracyEl.style.fontSize = '18px';
  accuracyEl.style.marginTop = '8px';
  accuracyEl.style.fontWeight = 'bold';
  accuracyEl.textContent = 'Совпадение: 0%';
  scoreOverlay.appendChild(accuracyEl);

  let camera = null;
  let poseUser = null;
  let poseTrainer = null;
  let userPoseLandmarks = null;
  let trainerPoseLandmarks = null;
  let currentScore = 0;
  let isComparing = false;

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
      totalDist += Math.sqrt(dx * dx + dy * dy + dz * dz);
      count++;
    }

    if (count === 0) return 0;
    const avgDist = totalDist / count;
    return Math.max(0, 1 - avgDist / 0.2);
  }

  startTrainingBtn.onclick = async () => {
    trainerVideo.src = "trainer.mp4";
    trainerVideo.load();
    trainerVideo.muted = false;
    try {
      await trainerVideo.play();
      trainerVideo.pause();
      trainerVideo.currentTime = 0;
    } catch (err) {
      console.warn("⚠️ Видео не активировано:", err);
    }

    document.getElementById("buttons").style.display = "none";
    calibrationOverlay.style.display = "flex";
    document.getElementById("calibrationMessage").textContent = "Пожалуйста, пройдите калибровку";

    try {
      videoElement.style.display = "block";

      // Pose для пользователя
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
      poseUser.onResults(results => {
        overlayCanvas.width = videoElement.videoWidth;
        overlayCanvas.height = videoElement.videoHeight;
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        if (results.poseLandmarks) {
          userPoseLandmarks = results.poseLandmarks;
          for (const lm of userPoseLandmarks) {
            overlayCtx.beginPath();
            overlayCtx.arc(lm.x * overlayCanvas.width, lm.y * overlayCanvas.height, 5, 0, 2 * Math.PI);
            overlayCtx.fillStyle = 'red';
            overlayCtx.fill();
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

      // Pose для тренера
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
        processTrainerFrame();
      });

      poseTrainer.onResults(results => {
        if (results.poseLandmarks) {
          trainerPoseLandmarks = results.poseLandmarks;
        }
      });

      function processTrainerFrame() {
        if (!trainerVideo.paused && !trainerVideo.ended) {
          trainerCtx.drawImage(trainerVideo, 0, 0, trainerCanvas.width, trainerCanvas.height);
          poseTrainer.send({ image: trainerCanvas });
          requestAnimationFrame(processTrainerFrame);
        }
      }

    } catch (e) {
      messageEl.textContent = "Ошибка доступа к камере: " + e.message;
    }
  };

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
    trainerVideo.play().catch(err => console.error("🚫 Не удалось воспроизвести видео тренера:", err));

    videoElement.classList.add("small-video");
    overlayCanvas.classList.add("small-video");

    currentScore = 0;
    scoreValue.textContent = currentScore;
    isComparing = true;
    compareLoop();

    trainerVideo.onended = () => {
      isComparing = false;
      trainerVideo.style.display = "none";
      videoElement.style.display = "none";
      overlayCanvas.style.display = "none";
      scoreOverlay.style.display = "none";
      finalScoreValue.textContent = currentScore;
      finalOverlay.style.display = "flex";
    };
  }

  function compareLoop() {
    if (!isComparing) return;
    if (userPoseLandmarks && trainerPoseLandmarks) {
      const similarity = comparePoses(userPoseLandmarks, trainerPoseLandmarks);
      const percent = Math.round(similarity * 100);

      // Обновляем цвет в зависимости от точности
      if (percent > 90) accuracyEl.style.color = 'limegreen';
      else if (percent < 50) accuracyEl.style.color = 'red';
      else accuracyEl.style.color = 'gold';

      accuracyEl.textContent = `Совпадение: ${percent}%`;

      if (similarity > 0.75) {
        currentScore++;
        scoreValue.textContent = currentScore;
      }
    }
    requestAnimationFrame(compareLoop);
  }

  uploadVideoBtn.onclick = () => uploadVideoInput.click();

  restartBtn.onclick = () => {
    currentScore = 0;
    scoreValue.textContent = currentScore;
    accuracyEl.textContent = 'Совпадение: 0%';
    finalOverlay.style.display = "none";
    document.getElementById("buttons").style.display = "block";
  };
});



















