import { Airplane } from "./airplane.js";
import { Cloud } from "./clouds.js";
import { RoadManager } from "./road.js";
import { AirplaneWingman } from "./wingman.js";

export class WarScene {
  constructor(CONFIG) {
    this.CONFIG = CONFIG;
  }

  init() {
    this.setupScene();
    this.createGameObjects();
    this.setupEventListeners();
    this.startGameLoop();
  }

  setupScene() {
    this.roadManager = new RoadManager(this.CONFIG);
    this.roadManager.init();
    this.bullets = [];
  }

  createGameObjects() {
    // Create main airplane
    this.airplane = new Airplane(
      this.CONFIG.assets.airplane,
      this.CONFIG.airplane.width,
      this.CONFIG.airplane.height
    );
    this.airplane.setPosition(
      eval(this.CONFIG.airplane.startX),
      eval(this.CONFIG.airplane.startY)
    );

    // Create wingmen
    this.wingman = new AirplaneWingman(this.airplane, {
      ...this.CONFIG.wingmen,
      images: this.CONFIG.assets.wingmen,
      bulletImage: this.CONFIG.assets.bullet,
    });

    // Create clouds
    this.createClouds();
  }

  setupEventListeners() {
    // Setup shooting intervals
    this.shootingInterval = setInterval(() => {
      this.CONFIG.bullets.angles.forEach((angle) => {
        this.airplane.shoot(
          this.CONFIG.assets.bullet,
          this.CONFIG.bullets.size,
          this.CONFIG.bullets.speed,
          angle
        );
      });
      this.playSound(this.CONFIG.assets.sound);
    }, this.CONFIG.bullets.interval);

    this.wingmanShootingInterval = setInterval(() => {
      if (Math.random() < this.CONFIG.wingmen.shootProbability) {
        this.wingman.shoot();
        this.playSound(this.CONFIG.assets.sound);
      }
    }, this.CONFIG.bullets.interval * this.CONFIG.wingmen.shootDelayMultiplier);
  }

  startGameLoop() {
    const gameLoop = () => {
      this.roadManager.update();
      requestAnimationFrame(gameLoop);
    };
    gameLoop();
  }

  createClouds() {
    // Initial cloud creation
    for (let i = 0; i < this.CONFIG.clouds.count; i++) {
      setTimeout(() => {
        new Cloud({
          backwardSpeed:
            this.CONFIG.clouds.minSpeed +
            Math.random() *
              (this.CONFIG.clouds.maxSpeed - this.CONFIG.clouds.minSpeed),
          horizontalSpeed: (Math.random() - 0.5) * 0.8,
          size:
            this.CONFIG.clouds.minSize +
            Math.random() *
              (this.CONFIG.clouds.maxSize - this.CONFIG.clouds.minSize),
          imageUrl:
            this.CONFIG.assets.clouds[i % this.CONFIG.assets.clouds.length],
          startX: Math.random() * window.innerWidth,
          rotation: (Math.random() - 0.5) * 45,
        });
      }, i * 1500);
    }

    // Continuous cloud generation
    this.cloudGenerationInterval = setInterval(() => {
      new Cloud({
        backwardSpeed:
          this.CONFIG.clouds.minSpeed +
          Math.random() *
            (this.CONFIG.clouds.maxSpeed - this.CONFIG.clouds.minSpeed),
        horizontalSpeed: (Math.random() - 0.5) * 0.8,
        size:
          this.CONFIG.clouds.minSize +
          Math.random() *
            (this.CONFIG.clouds.maxSize - this.CONFIG.clouds.minSize),
        imageUrl:
          this.CONFIG.assets.clouds[
            Math.floor(Math.random() * this.CONFIG.assets.clouds.length)
          ],
        startX: Math.random() * window.innerWidth,
        rotation: Math.random() * 360,
      });
    }, 5000);
  }

  playSound(url) {
    try {
      const audio = new Audio(url);
      audio.volume = 0.3;
      audio.play().catch((e) => console.log("Audio play prevented:", e));
    } catch (e) {
      console.log("Audio error:", e);
    }
  }

  cleanup() {
    clearInterval(this.shootingInterval);
    clearInterval(this.wingmanShootingInterval);
    clearInterval(this.cloudGenerationInterval);
    this.airplane.remove();
    this.wingman.remove();
    // Additional cleanup logic can be added here
  }
}
