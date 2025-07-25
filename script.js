// 1. Подключаем Telegram WebApp API
const tg = window.Telegram.WebApp;
tg.expand(); // Расширяет приложение на весь экран

// 2. Получаем элементы
const videoElement = document.getElementById('video');
const videoContainer = document.getElementById('video-container');
const messageElement = document.getElementById('message');

let danceStarted = false; // Для контроля запуска

// 3. Основная функция
async function startDance() {
  messageElement.textContent = "Приготовьтесь. Поднимите правую руку для запуска танца.";

  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });

  videoElement.srcObject = stream;
  videoElement.onloadedmetadata = async () => {
    await videoElement.play();
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

  pose.onResults(results => {
    if (!results.poseLandmarks) return;

    const rightWrist = results.poseLandmarks[16];
    const rightShoulder = results.poseLandmarks[12];

    if (!danceStarted && rightWrist.y < rightShoulder.y) {
      danceStarted = true;
      onDanceStart();
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
}

// 4. Функция запуска танца
function onDanceStart() {
  messageElement.textContent = ""; // Удаляем текст

  // Перемещаем видео в угол
  videoContainer.style.position = "fixed";
  videoContainer.style.width = "160px";
  videoContainer.style.height = "120px";
  videoContainer.style.bottom = "20px";
  videoContainer.style.right = "20px";
  videoContainer.style.zIndex = "1000";
  videoContainer.style.border = "2px solid #4CAF50";
  videoContainer.style.borderRadius = "10px";

  videoElement.style.width = "100%";
  videoElement.style.height = "100%";

  console.log("Танец начался! 🎉");
}
