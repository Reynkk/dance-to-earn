// 1. Подключаем Telegram WebApp API
const tg = window.Telegram.WebApp;
tg.expand(); // Расширяет приложение на весь экран

// 2. Элементы из DOM
const videoElement = document.getElementById('video');
const videoContainer = document.getElementById('video-container');
const instruction = document.getElementById('instruction');

// 3. Главная функция, запускается по нажатию кнопки
async function startDance() {
  // 4. Показываем видео и инструкцию
  videoElement.style.display = "block";
  instruction.innerText = "🎵 Приготовьтесь... Поднимите правую руку для начала 🎵";
  instruction.style.display = "block";

  // 5. Создаём объект MediaPipe Pose
  const pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}`
  });

  // 6. Настройки для Pose
  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  // 7. Обработка результатов распознавания
  let danceStarted = false; // Флаг, чтобы не запускать повторно

  pose.onResults(results => {
    if (results.poseLandmarks) {
      const rightWrist = results.poseLandmarks[16]; // точка правой кисти

      if (!danceStarted && rightWrist.y < 0.5) {
        danceStarted = true;

        // Убираем инструкцию
        instruction.innerText = "🚀 Танец начался!";

        // Уменьшаем видео и переносим в угол
        videoContainer.classList.add("small");

        // Можно тут начать анализ танца и начисление очков
        console.log("Танец запущен по поднятой руке!");
      }
    }
  });

  // 8. Настраиваем камеру — она сама запросит разрешение
  const camera = new Camera(videoElement, {
    onFrame: async () => {
      await pose.send({ image: videoElement });
    },
    width: 640,
    height: 480
  });

  camera.start(); // Запускаем
}

