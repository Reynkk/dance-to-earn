// 1. Подключаем Telegram WebApp API
const tg = window.Telegram.WebApp;
tg.expand(); // Расширяет приложение на весь экран

// 2. Находим элемент <video> на странице — в нём будет отображаться камера
const videoElement = document.getElementById('video');

// 3. Объявляем функцию startDance, которая запустится при нажатии на кнопку "Начать танец"
async function startDance() {
  // 4. Запрашиваем доступ к передней камере
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });

  // 5. Подключаем видеопоток из камеры к нашему видеоэлементу
  videoElement.srcObject = stream;
  // 3. Ждём, когда видео будет готово, и только потом вызываем play()
  videoElement.onloadedmetadata = async () => {
  videoElement.play();
  videoElement.style.display = "block"; // Показываем видео
};

  // 6. Создаём объект MediaPipe Pose — это ИИ, который будет определять положение тела
 const pose = new Pose({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}`
});

  // 7. Настройки для MediaPipe — можно менять качество, точность, и т.д.
  pose.setOptions({
    modelComplexity: 1, // 0 (легкий), 1 (средний), 2 (тяжёлый) — влияет на точность
    smoothLandmarks: true, // Сглаживать движения
    enableSegmentation: false, // Нам это не нужно сейчас
    minDetectionConfidence: 0.5, // Минимальная уверенность, чтобы засчитать точку
    minTrackingConfidence: 0.5 // Минимальная уверенность для отслеживания
  });

  // 8. Когда Pose нашёл позу — вызывается эта функция
  pose.onResults(results => {
    // 9. В этом объекте results.poseLandmarks будут координаты ключевых точек (голова, руки, ноги и т.д.)
    console.log("Поза пользователя:", results.poseLandmarks);

    // 10. Здесь ты можешь анализировать движения и начислять очки
    if (results.poseLandmarks) {
      // Пример: если пользователь поднял руку — начислить очки
      const rightWrist = results.poseLandmarks[16]; // Точка 16 = правая кисть
      if (rightWrist.y < 0.5) {
        console.log("Ты поднял правую руку! +10 очков 🎉");
      }
    }
  });

  // 11. Настраиваем камеру, чтобы в каждый кадр передавался в Pose
  const camera = new Camera(videoElement, {
    onFrame: async () => {
      await pose.send({ image: videoElement }); // Отправляем кадр в MediaPipe
    },
    width: 640,
    height: 480
  });

  // 12. Запускаем камеру
  camera.start();
}
