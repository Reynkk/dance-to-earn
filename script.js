const startBtn = document.getElementById('startBtn');
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');
const userVideo = document.getElementById('userVideo');
const trainerVideo = document.getElementById('trainerVideo');
const statusText = document.getElementById('statusText');
const downloadLink = document.getElementById('downloadLink');

let pose;
let userPoseData = [];

startBtn.onclick = () => {
  startTraining();
};

uploadBtn.onclick = () => {
  fileInput.click();
};

fileInput.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  trainerVideo.src = url;
  trainerVideo.style.display = 'block';
  trainerVideo.play();

  await extractPoseFromVideo(url);
};

async function startTraining() {
  statusText.textContent = 'Подключение камеры...';

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user' }
  });
  userVideo.srcObject = stream;

  userVideo.onloadedmetadata = () => {
    userVideo.play();
    userVideo.classList.add('mini');
    userVideo.style.display = 'block';
    statusText.textContent = 'Поднимите правую руку для начала тренировки';
  };

  pose = new Pose({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}`
  });

  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  pose.onResults(onPoseResult);

  const camera = new Camera(userVideo, {
    onFrame: async () => {
      await pose.send({ image: userVideo });
    },
    width: 640,
    height: 480
  });

  camera.start();
}

let danceStarted = false;

function onPoseResult(results) {
  if (!results.poseLandmarks) return;

  const rightWrist = results.poseLandmarks[16];
  userPoseData.push({
    frame: Date.now(),
    landmarks: results.poseLandmarks.map((lm) => ({
      x: lm.x,
      y: lm.y,
      z: lm.z,
      visibility: lm.visibility
    }))
  });

  if (!danceStarted && rightWrist.y < 0.5) {
    danceStarted = true;
    statusText.textContent = 'Тренировка началась!';
    playTrainerVideo();
  }
}

function playTrainerVideo() {
  trainerVideo.src = 'https://streamable.com/yaaax1'; // замените на прямую ссылку .mp4
  trainerVideo.style.display = 'block';
  trainerVideo.play();
}

async function extractPoseFromVideo(videoUrl) {
  statusText.textContent = 'Извлечение поз...';

  const video = document.createElement('video');
  video.src = videoUrl;
  video.crossOrigin = 'anonymous';
  video.muted = true;
  await video.play();

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const json = [];

  const pose = new Pose({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}`
  });

  pose.setOptions({
    staticImageMode: true,
    modelComplexity: 1,
    minDetectionConfidence: 0.5
  });

  await new Promise((resolve) => {
    video.onended = resolve;
    video.ontimeupdate = async () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const results = await pose.send({ image: canvas });

      if (results.poseLandmarks) {
        json.push({
          frame: Math.floor(video.currentTime * 1000),
          landmarks: results.poseLandmarks.map((lm) => ({
            x: lm.x,
            y: lm.y,
            z: lm.z,
            visibility: lm.visibility
          }))
        });
      }

      video.currentTime += 0.2; // ~5 кадров в секунду
    };
  });

  const blob = new Blob([JSON.stringify(json, null, 2)], {
    type: 'application/json'
  });

  const url = URL.createObjectURL(blob);
  downloadLink.href = url;
  downloadLink.download = 'trainer_pose_data.json';
  downloadLink.textContent = 'Скачать JSON';
  downloadLink.style.display = 'inline-block';
  statusText.textContent = 'Готово!';

  pose.close();
}




