const tg = window.Telegram.WebApp;
tg.expand(); // Разворачивает mini app на весь экран

document.getElementById('startDance').onclick = () => {
  alert("Танец скоро начнется! 🎶");
};