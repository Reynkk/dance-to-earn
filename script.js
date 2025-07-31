// JS-файл: script.js
window.addEventListener('DOMContentLoaded', () => {
const startTrainingBtn = document.getElementById('startTrainingBtn');
const uploadVideoBtn = document.getElementById('uploadVideoBtn');
const uploadVideoInput = document.getElementById('uploadVideoInput');
const videoElement = document.getElementById('video');
const trainerVideo = document.getElementById('trainerVideo');
const messageEl = document.getElementById('message');
const overlayCanvas = document.getElementById('overlay');
const overlayCtx = overlayCanvas.getContext('2d');
let camera = null;
let pose = null;

function downloadJSON(content, fileName) {
  const a = document.createElement('a');
  const file = new Blob([content], { type: 'application/json' });
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
}

startTrainingBtn.onclick = async () => {
  document.getElementById("calibrationOverlay").style.display = "block";
  document.getElementById("calibrationMessage").textContent = "Пожалуйста, пройдите калибровку";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
    videoElement.srcObject = stream;
    await videoElement.play();
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

        if (!step1Completed && nose && leftAnkle && rightAnkle && leftAnkle.y < 1 && rightAnkle.y < 1) {
          step1Completed = true;
          document.getElementById("step1").textContent = "✅ 1. Вы полностью в кадре";
        }

        const leftWrist = results.poseLandmarks[15];
        const rightWrist = results.poseLandmarks[16];
        if (step1Completed && leftWrist.y < nose.y && rightWrist.y < nose.y && !step2Completed) {
          step2Completed = true;
          document.getElementById("step2").textContent = "✅ 2. Руки подняты";
          document.getElementById("calibrationMessage").textContent = "🎉 Калибровка завершена. Начинаем тренировку!";

          setTimeout(() => {
            document.getElementById("calibrationOverlay").style.display = "none";
            transitionToCornerVideo();
            startDanceSession();
          }, 2000);
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
  videoElement.style.transition = "all 0.5s ease";
  videoElement.style.position = "fixed";
  videoElement.style.width = "160px";
  videoElement.style.height = "120px";
  videoElement.style.bottom = "10px";
  videoElement.style.right = "10px";
  videoElement.style.zIndex = "10";
  videoElement.style.objectFit = "cover";
}

function startDanceSession() {
  console.log("Тренировка началась!");
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
