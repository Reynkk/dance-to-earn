const tg = window.Telegram.WebApp;
tg.expand();

const videoElement = document.getElementById("video");
const trainingVideo = document.getElementById("training-video");
const instructionText = document.getElementById("instruction");
const scoreDisplay = document.getElementById("score");
const startBtn = document.getElementById("startBtn");

let trainingPoseResults = null;
let userScore = 0;
let trainingStarted = false;

async function startDance() {
  startBtn.style.display = "none";
  instructionText.innerText = "Приготовьтесь... Поднимите правую руку для старта";

  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
  videoElement.srcObject = stream;

  videoElement.onloadedmetadata = () => {
    videoElement.play();
    videoElement.style.display = "block";
  };

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

  pose.onResults(async (results) => {
    if (!trainingStarted) {
      const rightWrist = results.poseLandmarks?.[16];
      if (rightWrist && rightWrist.y < 0.5) {
        trainingStarted = true;
        instructionText.innerText = "";
        startTraining();
      }
    } else {
      const userPose = results.poseLandmarks;
      const match = compareLandmarks(userPose, trainingPoseResults);
      if (match > 20) {
        userScore += 10;
        scoreDisplay.innerText = `Очки: ${userScore}`;
      }
    }
  });

  const camera = new Camera(videoElement, {
    onFrame: async () => {
      await pose.send({ image: videoElement });
    },
    width: 640,
    height: 480
  });

  camera.start();

  // Обработка позы с тренировочного видео
  const trainingPose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}`
  });

  trainingPose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  const tempCanvas = document.createElement("canvas");
  const ctx = tempCanvas.getContext("2d");

  trainingPose.onResults((results) => {
    trainingPoseResults = results.poseLandmarks;
  });

  trainingVideo.addEventListener("play", () => {
    tempCanvas.width = trainingVideo.videoWidth;
    tempCanvas.height = trainingVideo.videoHeight;

    function detectPoseFromVideo() {
      if (!trainingVideo.paused && !trainingVideo.ended) {
        ctx.drawImage(trainingVideo, 0, 0, tempCanvas.width, tempCanvas.height);
        trainingPose.send({ image: tempCanvas });
        requestAnimationFrame(detectPoseFromVideo);
      } else {
        // Тренировка завершена
        instructionText.innerText = `Тренировка завершена! Вы набрали ${userScore} очков 🎉`;
        trainingVideo.style.display = "none";
        videoElement.style.display = "none";
      }
    }

    detectPoseFromVideo();
  });
}

function startTraining() {
  trainingVideo.currentTime = 0;
  trainingVideo.play();
  trainingVideo.style.display = "block";
}

function compareLandmarks(user, ref) {
  if (!user || !ref) return 0;
  let matched = 0;
  for (let i = 0; i < user.length; i++) {
    const dx = user[i].x - ref[i].x;
    const dy = user[i].y - ref[i].y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.1) matched++;
  }
  return matched;
}


