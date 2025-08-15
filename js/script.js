import { Airplane } from "./airplane.js";
import { Cloud } from "./clouds.js";
import { RoadManager } from "./road.js";

const CONFIG = {
  assets: {
    airplane: "./assets/images/airplanes/airplane1.png",
    bullet: "./assets/images/bullets/bullet1/lvl1.png",
    sound: "./assets/sounds/bullets/bullet2.wav",
    clouds: [
      "./assets/images/clouds/cloud3.png",
      "./assets/images/clouds/cloud2.png",
      "./assets/images/clouds/cloud1.png",
    ],
  },
  airplane: {
    width: 100,
    height: 100,
    startX: window.innerWidth / 2 - 50,
    startY: window.innerHeight - 150,
  },
  bullets: {
    angles: [0],
    size: 25,
    speed: 5,
    interval: 900,
  },
  clouds: {
    count: 80,
    minSize: 500,
    maxSize: 900,
    minSpeed: 0.5,
    maxSpeed: 2.5,
  },
  roads: {
    images: ["assets/images/roads/road1.png", "assets/images/roads/road2.png"],
    speed: 2,
    transitionDuration: 2000,
    width: 3840,
    height: 2160,
  },
};

// Game initialization
document.addEventListener("DOMContentLoaded", () => {
  const roadManager = new RoadManager(CONFIG);
  roadManager.init();

  function gameLoop() {
    roadManager.update();
    requestAnimationFrame(gameLoop);
  }
  gameLoop();
  // Create airplane
  const airplane = new Airplane(
    CONFIG.assets.airplane,
    CONFIG.airplane.width,
    CONFIG.airplane.height
  );
  airplane.setPosition(CONFIG.airplane.startX, CONFIG.airplane.startY);

  // Create clouds
  createClouds();

  // Setup shooting interval
  setInterval(() => {
    CONFIG.bullets.angles.forEach((angle) => {
      airplane.shoot(
        CONFIG.assets.bullet,
        CONFIG.bullets.size,
        CONFIG.bullets.speed,
        angle
      );
    });
    playSound(CONFIG.assets.sound);
  }, CONFIG.bullets.interval);
});

function createClouds() {
  // Initial cloud creation
  for (let i = 0; i < CONFIG.clouds.count; i++) {
    setTimeout(() => {
      new Cloud({
        backwardSpeed:
          CONFIG.clouds.minSpeed +
          Math.random() * (CONFIG.clouds.maxSpeed - CONFIG.clouds.minSpeed),
        horizontalSpeed: (Math.random() - 0.5) * 0.8,
        size:
          CONFIG.clouds.minSize +
          Math.random() * (CONFIG.clouds.maxSize - CONFIG.clouds.minSize),
        imageUrl: CONFIG.assets.clouds[i % CONFIG.assets.clouds.length],
        startX: Math.random() * window.innerWidth,
        rotation: (Math.random() - 0.5) * 45,
      });
    }, i * 1500);
  }

  setInterval(() => {
    const randomCloudIndex = Math.floor(
      Math.random() * CONFIG.assets.clouds.length
    );
    new Cloud({
      backwardSpeed:
        CONFIG.clouds.minSpeed +
        Math.random() * (CONFIG.clouds.maxSpeed - CONFIG.clouds.minSpeed),
      horizontalSpeed: (Math.random() - 0.5) * 0.8,
      size:
        CONFIG.clouds.minSize +
        Math.random() * (CONFIG.clouds.maxSize - CONFIG.clouds.minSize),
      imageUrl: CONFIG.assets.clouds[randomCloudIndex],
      startX: Math.random() * window.innerWidth,
      rotation: Math.random() * 360,
    });
  }, 5000);
}
function playSound(url) {
  try {
    const audio = new Audio(url);
    audio.volume = 0.3;
    audio.play().catch((e) => console.log("Audio play prevented:", e));
  } catch (e) {
    console.log("Audio error:", e);
  }
}
