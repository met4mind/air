import { Airplane } from "./airplane.js";
import { Cloud } from "./clouds.js";

// Configuration
const CONFIG = {
  assets: {
    airplane: "./assets/images/airplanes/airplane1.png",
    bullet: "./assets/images/bullets/bullet1.png",
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
    angles: [0, -17.5, -35, 17.5, 35],
    size: 25,
    speed: 10,
    interval: 200,
  },
  clouds: {
    count: 80,
    minSize: 500,
    maxSize: 900,
    minSpeed: 0.5,
    maxSpeed: 2.5,
  },
};

// Game initialization
document.addEventListener("DOMContentLoaded", () => {
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
  for (let i = 0; i < CONFIG.clouds.count; i++) {
    setTimeout(() => {
      new Cloud({
        backwardSpeed:
          CONFIG.clouds.minSpeed +
          Math.random() * (CONFIG.clouds.maxSpeed - CONFIG.clouds.minSpeed),
        horizontalSpeed: (Math.random() - 0.5) * 0.8, // Increased horizontal movement
        size:
          CONFIG.clouds.minSize +
          Math.random() * (CONFIG.clouds.maxSize - CONFIG.clouds.minSize),
        imageUrl: CONFIG.assets.clouds[i % CONFIG.assets.clouds.length],
        startX: Math.random() * window.innerWidth,
        rotation: (Math.random() - 0.5) * 45, // More rotation (-22.5° to 22.5°)
      });
    }, i * 1500); // More spaced out creation
  }

  // Continuous cloud generation
  setInterval(() => {
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
