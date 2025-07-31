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

// Utility: Скачивание JSON-файла
function downloadJSON(content, fileName) {
  const a = document.createElement('a');
  const file = new Blob([content], { type: 'application/json' });
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
}

// --- ЗАПУСК ТРЕНИРОВКИ С КАМЕРОЙ ---
startTrainingBtn.onclick = async () => {
  messageEl.textContent = "Приготовьтесь. Поднимите правую руку для запуска танца.";
  trainerVideo.style.display = 'none';
  videoElement.style.display = "block";

  try {
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

    let danceStarted = false;

    pose.onResults(results => {
      overlayCanvas.width = videoElement.videoWidth;
      overlayCanvas.height = videoElement.videoHeight;
      overlayCanvas.style.width = videoElement.style.width;
      overlayCanvas.style.height = videoElement.style.height;

      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      if (results.poseLandmarks) {
        for (const lm of results.poseLandmarks) {
          overlayCtx.beginPath();
          overlayCtx.arc(lm.x * overlayCanvas.width, lm.y * overlayCanvas.height, 5, 0, 2 * Math.PI);
          overlayCtx.fillStyle = 'red';
          overlayCtx.fill();
        }

        if (!danceStarted) {
          const rightWrist = results.poseLandmarks[16];
          if (rightWrist && rightWrist.y < 0.5) {
            danceStarted = true;
            messageEl.textContent = "Танец начался!";
            moveCameraToCorner();
            startDanceSession();
          }
        }
      }
    });

    camera = new Camera(videoElement, {
      onFrame: async () => {
        await pose.send({ image: videoElement });
      },
      width: 640,
      height: 480
    });

    camera.start();

  } catch (e) {
    messageEl.textContent = "Ошибка доступа к камере: " + e.message;
  }
};

function moveCameraToCorner() {
  videoElement.style.position = 'fixed';
  videoElement.style.width = '160px';
  videoElement.style.height = '120px';
  videoElement.style.bottom = '10px';
  videoElement.style.right = '10px';
  videoElement.style.zIndex = '10';
}

function startDanceSession() {
  // Тут можно добавить логику игры: воспроизведение тренировочного видео,
  // подсчет очков и т.д.
}

// --- ЗАГРУЗКА ВИДЕО И ИЗВЛЕЧЕНИЕ ПОЗ ---
uploadVideoBtn.onclick = () => {
  uploadVideoInput.click();
};

uploadVideoInput.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  messageEl.textContent = "Обрабатываем видео, подождите...";

  try {
    const poseData = await processTrainingVideo(file);
    const jsonStr = JSON.stringify(poseData, null, 2);
    downloadJSON(jsonStr, 'trainer_pose_data.json');
    messageEl.textContent = "Готово! JSON файл для тренировки сгенерирован и загружен.";
  } catch (err) {
    messageEl.textContent = "Ошибка при обработке видео: " + err.message;
  }
};

// Обработка тренировочного видео и извлечение поз
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
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      await pose.send({ image: canvas });

      if (latestResults && latestResults.poseLandmarks) {
        json.push({
          frame: Math.floor(video.currentTime * 1000),
          landmarks: latestResults.poseLandmarks.map(lm => ({
            x: lm.x,
            y: lm.y,
            z: lm.z,
            visibility: lm.visibility
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

    video.onerror = () => reject(new Error('Ошибка при загрузке видео'));

    video.play().then(() => {
      // Триггерим первый кадр
      video.currentTime = 0.01;
    });
  });
}
