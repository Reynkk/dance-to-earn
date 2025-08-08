// Исходный код script.js, который ты прислал, будет вставлен сюда
// Далее я обновлю его, чтобы сравнивать движения в реальном времени и начислять очки

window.addEventListener('DOMContentLoaded', () => {
  const startTrainingBtn = document.getElementById('startTrainingBtn');
  const videoElement = document.getElementById('video');
  const trainerVideo = document.getElementById('trainerVideo');
  const countdownOverlay = document.getElementById('countdownOverlay');
  const calibrationOverlay = document.getElementById('calibrationOverlay');
  const scoreOverlay = document.getElementById('scoreOverlay');
  const scoreValue = document.getElementById('scoreValue');
  const finalOverlay = document.getElementById('finalOverlay');
  const finalScoreValue = document.getElementById('finalScoreValue');
  const restartBtn = document.getElementById('restartBtn');
  const overlayCanvas = document.getElementById('overlay');
  const overlayCtx = overlayCanvas.getContext('2d');

  let pose, camera, userPose = null, trainerPose = null, currentScore = 0;

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function comparePoses(poseA, poseB) {
    if (!poseA || !poseB) return 0;

    let total = 0;
    let count = 0;

    for (let i = 0; i < poseA.length; i++) {
      const a = poseA[i];
      const b = poseB[i];
      if (a.visibility > 0.5 && b.visibility > 0.5) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        total += dist;
        count++;
      }
    }

    if (count === 0) return 0;
    const avgDist = total / count;
    return 1 - avgDist;
  }

  async function showCountdown() {
    countdownOverlay.style.display = 'flex';
    countdownOverlay.textContent = 'Приготовьтесь';
    await delay(1000);
    for (let i = 3; i > 0; i--) {
      countdownOverlay.textContent = i;
      await delay(1000);
    }
    countdownOverlay.style.display = 'none';
  }

  function transitionToCornerVideo() {
    videoElement.classList.add("small-video");
    overlayCanvas.classList.add("small-video");
  }

  async function startTrainerTracking() {
    const trainerCanvas = document.createElement("canvas");
    const trainerCtx = trainerCanvas.getContext("2d");

    const trainerPoseDetector = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}`
    });

    trainerPoseDetector.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    trainerPoseDetector.onResults(results => {
      if (results.poseLandmarks) {
        trainerPose = results.poseLandmarks;
      }
    });

    async function track() {
      if (trainerVideo.paused || trainerVideo.ended) return;
      trainerCanvas.width = trainerVideo.videoWidth;
      trainerCanvas.height = trainerVideo.videoHeight;
      trainerCtx.drawImage(trainerVideo, 0, 0);
      await trainerPoseDetector.send({ image: trainerCanvas });
      requestAnimationFrame(track);
    }

    track();
  }

  async function startTraining() {
    calibrationOverlay.style.display = 'none';
    transitionToCornerVideo();
    await showCountdown();

    trainerVideo.style.display = 'block';
    trainerVideo.muted = false;
    scoreOverlay.style.display = 'flex';
    currentScore = 0;
    scoreValue.textContent = currentScore;

    startTrainerTracking();

    trainerVideo.play();

    const interval = setInterval(() => {
      if (userPose && trainerPose) {
        const similarity = comparePoses(userPose, trainerPose);
        if (similarity > 0.85) {
          currentScore += 10;
          scoreValue.textContent = currentScore;
        }
      }
    }, 300);

    trainerVideo.onended = () => {
      clearInterval(interval);
      videoElement.style.display = 'none';
      trainerVideo.style.display = 'none';
      finalScoreValue.textContent = currentScore;
      finalOverlay.style.display = 'flex';
    };
  }

  startTrainingBtn.addEventListener('click', async () => {
    calibrationOverlay.style.display = 'flex';

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
      overlayCanvas.width = videoElement.videoWidth;
      overlayCanvas.height = videoElement.videoHeight;
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      if (results.poseLandmarks) {
        userPose = results.poseLandmarks;
        for (const lm of results.poseLandmarks) {
          overlayCtx.beginPath();
          overlayCtx.arc(lm.x * overlayCanvas.width, lm.y * overlayCanvas.height, 4, 0, 2 * Math.PI);
          overlayCtx.fillStyle = 'red';
          overlayCtx.fill();
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

    await camera.start();
  });

  restartBtn.onclick = () => {
    currentScore = 0;
    scoreValue.textContent = currentScore;
    finalOverlay.style.display = "none";
    calibrationOverlay.style.display = "flex";
  };
});














