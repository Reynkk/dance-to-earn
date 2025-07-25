// 1. Подключаем Telegram WebApp API
const tg = window.Telegram.WebApp;
tg.expand(); // Расширяет приложение на весь экран

// 2. Получаем нужные элементы со страницы
const videoElement = document.getElementById('video');
const videoContainer = document.getElementById('video-container');
const messageElement = document.getElementById('message');

// 3. Переменная для отслеживания, начался ли танец
let danceStarted = false;

// 4. Основная функция — запускается при нажатии кнопки "Начать танец"
async function startDance() {
  // 5. Показываем инструкцию
  messageElement.textContent = "Приготовьтесь. Поднимите правую руку для запуска танца.";

  // 6. Запрашиваем доступ к передней камере
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });

  // 7. Подключаем камеру к <video>
  videoElement.srcObject = stream;
  videoElement.onloadedmetadata = async () => {
    await videoElement.play(); // Ждём полной загрузки видео
    videoElement.style.display = "block"; // Показываем видео
  };

  // 8. Инициализируем MediaPipe Pose
  const pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}`
  });

  // 9. Устанавливаем параметры отслеживания
  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  // 10. Когда получены результаты позы
  pose.onResults(results => {
    if (!results.poseLandmarks) return;

    console.log("Поза пользователя:", results.poseLandmarks);

    // 11. Проверяем поднятие правой руки — если танец ещё не начался
    if (!danceStarted) {
      const rightWrist = results.poseLandmarks[16];
      const rightShoulder = results.poseLandmarks[12];

      if (rightWrist.y < rightShoulder.y) {
        danceStarted = true;
        onDanceStart(); // Запускаем танец
      }
    }
  });

  // 12. Камера передаёт каждый кадр в MediaPipe Pose
  const camera = new Camera(videoElement, {
    onFrame: async () => {
      await pose.send({ image: videoElement });
    },
    width: 640,
    height: 480
  });

  camera.start(); // 13. Запускаем камеру
}

// 14. Функция, которая запускается, когда пользователь поднял руку
function onDanceStart() {
  messageElement.textContent = ""; // Убираем сообщение

  // Уменьшаем видео и перемещаем в правый нижний угол
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
  // Здесь можно запускать подсчёт очков, музыку и т.д.
}

  // 12. Запускаем камеру
  camera.start();
}
