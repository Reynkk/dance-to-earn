window.addEventListener('DOMContentLoaded', () => {
  const startTrainingBtn = document.getElementById('startTrainingBtn');
  const uploadVideoBtn = document.getElementById('uploadVideoBtn');
  const uploadVideoInput = document.getElementById('uploadVideoInput');
  const videoElement = document.getElementById('video');
  const trainerVideo = document.getElementById('trainerVideo');
  const messageEl = document.getElementById('message');
  const overlayCanvas = document.getElementById('overlay');
  const overlayCtx = overlayCanvas.getContext('2d');

  const calibrationMessage = document.getElementById("calibrationMessage");
  const step1El = document.getElementById("step1");
  const step2El = document.getElementById("step2");

  let pose = null;
  let camera = null;

  startTrainingBtn.onclick = async () => {
    document.getElementById("calibrationOverlay").style.display = "block";
    calibrationMessage.textContent = "Пожалуйста, пройдите калибровку";

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoElement.srcObject = stream;
      await videoElement.play();

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

      let step1 = false;
      let step2 = false;

      pose.onResults(results => {
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

          const nose = results.poseLandmarks[0];
          const leftAnkle = results.poseLandmarks[27];
          const rightAnkle = results.poseLandmarks[28];
          const leftWrist = results.poseLandmarks[15];
          const rightWrist = results.poseLandmarks[16];

          if (!step1 && leftAnkle && rightAnkle && leftAnkle.y < 1 && rightAnkle.y < 1) {
            step1 = true;
            step1El.textContent = "✅ 1. Вы полностью в кадре";
          }

          if (step1 && leftWrist.y < nose.y && rightWrist.y < nose.y && !step2) {
            step2 = true;
            step2El.textContent = "✅ 2. Руки подняты";
            calibrationMessage.textContent = "🎉 Калибровка завершена!";

            setTimeout(() => {
              document.getElementById("calibrationOverlay").style.display = "none";
              transitionToCornerVideo();
              startDanceSession();
            }, 1500);
          }
        }
      });

      camera = new Camera(videoElement, {
        onFrame: async () => await pose.send({ image: videoElement }),
        width: 480,
        height: 640
      });

      camera.start();
    } catch (e) {
      messageEl.textContent = "Ошибка доступа к камере: " + e.message;
    }
  };

  function transitionToCornerVideo() {
    videoElement.classList.add('small-video');
    document.getElementById('buttons').classList.add('hidden');
  }

  function showCountdown(callback) {
    const countdownEl = document.getElementById("countdownOverlay");
    const steps = ["Приготовьтесь", "3", "2", "1"];
    let index = 0;

    countdownEl.style.display = "flex";
    countdownEl.textContent = steps[index];

    const interval = setInterval(() => {
      index++;
      if (index >= steps.length) {
        clearInterval(interval);
        countdownEl.style.display = "none";
        callback();
      } else {
        countdownEl.textContent = steps[index];
      }
    }, 1000);
  }

  function startDanceSession() {
    showCountdown(() => {
      trainerVideo.src = "trainer.mp4"; // путь к видео
      trainerVideo.style.display = "block";
      trainerVideo.play();

      let score = 0;
      const scoreValue = document.getElementById("scoreValue");
      const scoreInterval = setInterval(() => {
        score += Math.floor(Math.random() * 5); // заглушка
        scoreValue.textContent = score;
      }, 600);

      trainerVideo.onended = () => {
        clearInterval(scoreInterval);
        videoElement.style.display = "none";
        trainerVideo.style.display = "none";
        document.getElementById("scoreOverlay").style.display = "flex";
        if (camera && camera.stop) camera.stop();
      };
    });
  }

  uploadVideoBtn.onclick = () => uploadVideoInput.click();
  uploadVideoInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      messageEl.textContent = "Загружено: " + file.name;
    }
  };
});


