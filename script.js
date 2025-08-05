let camera;
let pose;
let score = 0;
let scoreInterval;

const videoElement = document.getElementById("video");
const trainerVideo = document.getElementById("trainerVideo");
const startBtn = document.getElementById("startTrainingBtn");
const uploadBtn = document.getElementById("uploadVideoBtn");
const uploadInput = document.getElementById("uploadVideoInput");

const calibrationOverlay = document.getElementById("calibrationOverlay");
const countdownOverlay = document.getElementById("countdownOverlay");
const scoreOverlay = document.getElementById("scoreOverlay");
const scoreValue = document.getElementById("scoreValue");

startBtn.onclick = async () => {
  document.getElementById("buttons").style.display = "none";
  await startCamera();
  startCalibration();
};

uploadBtn.onclick = () => uploadInput.click();

uploadInput.onchange = (e) => {
  const file = e.target.files[0];
  if (file) {
    trainerVideo.src = URL.createObjectURL(file);
  }
};

async function startCamera() {
  return new Promise((resolve) => {
    camera = new Camera(videoElement, {
      onFrame: async () => {
        await pose.send({ image: videoElement });
      },
      width: 640,
      height: 480,
    });
    camera.start();
    resolve();
  });
}

function startCalibration() {
  calibrationOverlay.style.display = "block";

  let inFrame = false;
  let handsUp = false;

  pose = new Pose({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}`,
  });

  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  pose.onResults((results) => {
    const landmarks = results.poseLandmarks;
    if (!landmarks) return;

    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];
    const nose = landmarks[0];
    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];

    // Проверка на попадание всего тела в кадр
    if (leftAnkle.visibility > 0.5 && rightAnkle.visibility > 0.5) {
      inFrame = true;
      document.getElementById("step1").style.color = "lightgreen";
    }

    // Проверка на поднятие обеих рук
    if (
      leftWrist.y < nose.y &&
      rightWrist.y < nose.y &&
      leftWrist.visibility > 0.5 &&
      rightWrist.visibility > 0.5
    ) {
      handsUp = true;
      document.getElementById("step2").style.color = "lightgreen";
    }

    if (inFrame && handsUp) {
      calibrationOverlay.style.display = "none";
      videoElement.classList.add("small-video");
      startCountdown();
    }
  });
}

function startCountdown() {
  showMessage("Приготовьтесь", () => {
    let count = 3;
    countdownOverlay.style.display = "flex";
    countdownOverlay.innerText = count;

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        countdownOverlay.innerText = count;
      } else {
        clearInterval(interval);
        countdownOverlay.style.display = "none";
        startTrainerVideo();
      }
    }, 1000);
  });
}

function showMessage(text, callback) {
  countdownOverlay.innerText = text;
  countdownOverlay.style.display = "flex";
  setTimeout(() => {
    countdownOverlay.style.display = "none";
    callback();
  }, 1500);
}

function startTrainerVideo() {
  trainerVideo.style.display = "block";
  trainerVideo.play();

  score = 0;
  scoreValue.textContent = score;

  scoreInterval = setInterval(() => {
    score++;
    scoreValue.textContent = score;
  }, 1000);

  trainerVideo.onended = () => {
    clearInterval(scoreInterval);
    videoElement.style.display = "none";
    trainerVideo.style.display = "none";
    scoreOverlay.style.display = "flex";
    if (camera && camera.stop) camera.stop();
    document.getElementById("buttons").style.display = "block";
  };
}




