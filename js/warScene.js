import { CONFIG } from "../config.js";
import { Airplane } from "./airplane.js";
import { OpponentAirplane } from "./opponentAirplane.js";
import { Cloud } from "./clouds.js";
import { RoadManager } from "./road.js";
import { AirplaneWingman } from "./wingman.js";
import { Bullet } from "./bullet.js";

export class WarScene {
  constructor(CONFIG, networkManager, playerAssets = {}) {
    this.CONFIG = CONFIG;
    this.networkManager = networkManager;
    this.playerAssets = playerAssets;
    this.opponent = null;
    this.opponentAirplane = null;
    this.opponentBullets = [];
    this.health = 100;
    this.opponentHealth = 100;
    this.bullets = [];

    // قرار دادن networkManager در scope全局 برای دسترسی از airplane.js
    window.networkManager = networkManager;

    // ذخیره ابعاد صفحه برای محاسبات حرکت معکوس
    this.screenWidth = window.innerWidth;
    this.screenHeight = window.innerHeight;
  }

  async init() {
    this.setupScene();
    this.createGameObjects();
    this.setupEventListeners();
    this.setupNetworkHandlers();
    this.startGameLoop();
    this.createHealthDisplays();
  }

  setOpponent(opponent) {
    this.opponent = opponent;
    this.createOpponentAirplane();
    this.updateOpponentHealthDisplay();
  }

  setupNetworkHandlers() {
    if (this.networkManager) {
      this.networkManager.onOpponentMove = (x, y) => {
        if (this.opponentAirplane) {
          // تبدیل مختصات به حرکت معکوس
          const mirroredX = this.screenWidth - x - this.CONFIG.airplane.width;
          const mirroredY = this.screenHeight - y - this.CONFIG.airplane.height;

          this.opponentAirplane.setPosition(mirroredX, mirroredY);
        }
      };

      this.networkManager.onOpponentShoot = (x, y) => {
        // تبدیل مختصات شلیک به موقعیت معکوس
        const mirroredX = this.screenWidth - x;
        const mirroredY = this.screenHeight - y;
        this.createOpponentBullet(mirroredX, mirroredY);
      };

      this.networkManager.onYouHit = (damage) => {
        this.applyDamage(damage);
      };

      this.networkManager.onGameOver = (result) => {
        this.showGameOver(result === "win");
      };

      this.networkManager.onOpponentDisconnected = () => {
        this.showOpponentDisconnected();
      };

      this.networkManager.onOpponentHealthUpdate = (health) => {
        this.opponentHealth = health;
        this.updateOpponentHealthDisplay();
      };
    }
  }

  getAirplaneImage(airplanePath) {
    return `./${airplanePath}`;
  }

  getBulletImage(bulletPath) {
    return `./${bulletPath}`;
  }

  createOpponentAirplane() {
    if (!this.opponent) return;

    this.opponentAirplane = new OpponentAirplane(
      this.getAirplaneImage(this.opponent.airplane),
      this.CONFIG.airplane.width,
      this.CONFIG.airplane.height
    );

    // قرار دادن حریف در موقعیت اولیه (بالای صفحه)
    const initialX = this.screenWidth / 2 - this.CONFIG.airplane.width / 2;
    const initialY = 50;
    this.opponentAirplane.setPosition(initialX, initialY);
  }

  createOpponentBullet(x, y) {
    if (!this.opponentAirplane) return;

    const bullet = this.opponentAirplane.shoot(
      this.getBulletImage(this.opponent.bullets),
      this.CONFIG.bullets.size,
      this.CONFIG.bullets.speed
    );

    // تنظیم موقعیت گلوله حریف اگر مختصات مشخص شده باشد
    if (x !== undefined && y !== undefined) {
      bullet.setPosition(x, y);
    }

    this.opponentBullets.push(bullet);

    // پخش صدای شلیک حریف
    this.playSound(this.CONFIG.assets.sound);
  }

  setupScene() {
    this.roadManager = new RoadManager(this.CONFIG);
    this.roadManager.init();
    this.bullets = [];
  }

  createGameObjects() {
    // ایجاد هواپیمای اصلی کاربر
    this.airplane = new Airplane(
      this.getAirplaneImage(
        this.playerAssets.airplane || this.CONFIG.assets.airplane
      ),
      this.CONFIG.airplane.width,
      this.CONFIG.airplane.height
    );

    // قرار دادن کاربر در پایین صفحه
    const playerX = this.screenWidth / 2 - this.CONFIG.airplane.width / 2;
    const playerY = this.screenHeight - this.CONFIG.airplane.height - 50;
    this.airplane.setPosition(playerX, playerY);

    // ایجاد wingman ها (اگر فعال باشند)
    if (this.CONFIG.wingmen.enabled) {
      this.wingman = new AirplaneWingman(this.airplane, {
        ...this.CONFIG.wingmen,
        images: {
          left: this.getAirplaneImage(this.CONFIG.assets.wingmen.left),
          right: this.getAirplaneImage(this.CONFIG.assets.wingmen.right),
        },
        bulletImage: this.getBulletImage(
          this.playerAssets.bullets || this.CONFIG.assets.bullet
        ),
      });
    }

    // ایجاد ابرها
    this.createClouds();
  }

  createHealthDisplays() {
    // ایجاد نمایش سلامت کاربر
    this.playerHealthDisplay = document.createElement("div");
    this.playerHealthDisplay.id = "player-health";
    this.playerHealthDisplay.style.position = "fixed";
    this.playerHealthDisplay.style.bottom = "20px";
    this.playerHealthDisplay.style.left = "20px";
    this.playerHealthDisplay.style.background = "rgba(0,0,0,0.7)";
    this.playerHealthDisplay.style.color = "white";
    this.playerHealthDisplay.style.padding = "10px 15px";
    this.playerHealthDisplay.style.borderRadius = "10px";
    this.playerHealthDisplay.style.fontFamily = "Arial, sans-serif";
    this.playerHealthDisplay.style.fontSize = "16px";
    this.playerHealthDisplay.style.zIndex = "100";
    this.playerHealthDisplay.innerHTML = `Your Health: ${this.health}%`;
    document.body.appendChild(this.playerHealthDisplay);

    // ایجاد نمایش سلامت حریف
    this.opponentHealthDisplay = document.createElement("div");
    this.opponentHealthDisplay.id = "opponent-health";
    this.opponentHealthDisplay.style.position = "fixed";
    this.opponentHealthDisplay.style.top = "20px";
    this.opponentHealthDisplay.style.right = "20px";
    this.opponentHealthDisplay.style.background = "rgba(0,0,0,0.7)";
    this.opponentHealthDisplay.style.color = "white";
    this.opponentHealthDisplay.style.padding = "10px 15px";
    this.opponentHealthDisplay.style.borderRadius = "10px";
    this.opponentHealthDisplay.style.fontFamily = "Arial, sans-serif";
    this.opponentHealthDisplay.style.fontSize = "16px";
    this.opponentHealthDisplay.style.zIndex = "100";
    this.opponentHealthDisplay.innerHTML = `${
      this.opponent?.username || "Opponent"
    } Health: ${this.opponentHealth}%`;
    document.body.appendChild(this.opponentHealthDisplay);
  }

  updateHealthDisplay() {
    if (this.playerHealthDisplay) {
      this.playerHealthDisplay.innerHTML = `Your Health: ${this.health}%`;

      // تغییر رنگ بر اساس سلامت
      if (this.health < 30) {
        this.playerHealthDisplay.style.background = "rgba(255,0,0,0.7)";
      } else if (this.health < 60) {
        this.playerHealthDisplay.style.background = "rgba(255,165,0,0.7)";
      } else {
        this.playerHealthDisplay.style.background = "rgba(0,0,0,0.7)";
      }
    }
  }

  updateOpponentHealthDisplay() {
    if (this.opponentHealthDisplay) {
      this.opponentHealthDisplay.innerHTML = `${
        this.opponent?.username || "Opponent"
      } Health: ${this.opponentHealth}%`;

      // تغییر رنگ بر اساس سلامت
      if (this.opponentHealth < 30) {
        this.opponentHealthDisplay.style.background = "rgba(255,0,0,0.7)";
      } else if (this.opponentHealth < 60) {
        this.opponentHealthDisplay.style.background = "rgba(255,165,0,0.7)";
      } else {
        this.opponentHealthDisplay.style.background = "rgba(0,0,0,0.7)";
      }
    }
  }

  setupEventListeners() {
    // Setup shooting intervals
    this.shootingInterval = setInterval(() => {
      this.CONFIG.bullets.angles.forEach((angle) => {
        const bullet = this.airplane.shoot(
          this.getBulletImage(
            this.playerAssets.bullets || this.CONFIG.assets.bullet
          ),
          this.CONFIG.bullets.size,
          this.CONFIG.bullets.speed,
          angle
        );
        this.bullets.push(bullet);
      });
      this.playSound(this.CONFIG.assets.sound);

      // اطلاع به سرور از شلیک (با مختصات معکوس)
      if (this.networkManager && this.networkManager.sendShoot) {
        const pos = this.airplane.getPosition();
        const mirroredX = this.screenWidth - pos.x - this.CONFIG.airplane.width;
        const mirroredY =
          this.screenHeight - pos.y - this.CONFIG.airplane.height;

        this.networkManager.sendShoot(
          mirroredX + this.CONFIG.airplane.width / 2,
          mirroredY,
          180 // rotation برای شلیک به سمت پایین در صفحه حریف
        );
      }
    }, this.CONFIG.bullets.interval);

    // شلیک wingman ها (اگر فعال باشند)
    if (this.wingman) {
      this.wingmanShootingInterval = setInterval(() => {
        if (Math.random() < this.CONFIG.wingmen.shootProbability) {
          const wingmanBullets = this.wingman.shoot();
          this.bullets = this.bullets.concat(wingmanBullets);
          this.playSound(this.CONFIG.assets.sound);
        }
      }, this.CONFIG.bullets.interval * this.CONFIG.wingmen.shootDelayMultiplier);
    }

    // شلیک حریف (اتوماتیک)
    this.opponentShootingInterval = setInterval(() => {
      if (this.opponentAirplane && Math.random() < 0.3) {
        this.createOpponentBullet();
      }
    }, 1000);
  }

  startGameLoop() {
    const gameLoop = () => {
      this.roadManager.update();
      this.updateBullets();
      this.checkCollisions();
      requestAnimationFrame(gameLoop);
    };
    gameLoop();
  }

  updateBullets() {
    // به روزرسانی موقعیت گلوله‌های من
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      if (!this.bullets[i].active) {
        this.bullets.splice(i, 1);
      }
    }

    // به روزرسانی موقعیت گلوله‌های حریف
    for (let i = this.opponentBullets.length - 1; i >= 0; i--) {
      if (!this.opponentBullets[i].active) {
        this.opponentBullets.splice(i, 1);
      }
    }
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
          imageUrl: this.getCloudImage(
            this.CONFIG.assets.clouds[i % this.CONFIG.assets.clouds.length]
          ),
          startX: Math.random() * this.screenWidth,
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
        imageUrl: this.getCloudImage(
          this.CONFIG.assets.clouds[
            Math.floor(Math.random() * this.CONFIG.assets.clouds.length)
          ]
        ),
        startX: Math.random() * this.screenWidth,
        rotation: Math.random() * 360,
      });
    }, 5000);
  }

  getCloudImage(cloudPath) {
    return `./${cloudPath}`;
  }

  playSound(soundPath) {
    try {
      const audio = new Audio(`./${soundPath}`);
      audio.volume = 0.3;
      audio.play().catch((e) => console.log("Audio play prevented:", e));
    } catch (e) {
      console.log("Audio error:", e);
    }
  }

  checkCollisions() {
    // بررسی برخورد گلوله‌های من با حریف
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      if (
        this.opponentAirplane &&
        this.isColliding(bullet, this.opponentAirplane)
      ) {
        // کاهش سلامت حریف
        this.opponentHealth -= 10;
        if (this.opponentHealth < 0) this.opponentHealth = 0;

        this.updateOpponentHealthDisplay();

        // اطلاع به سرور از آسیب به حریف
        if (this.networkManager && this.networkManager.sendHit) {
          this.networkManager.sendHit(10);
        }

        bullet.remove();
        this.bullets.splice(i, 1);

        // بررسی پایان بازی
        if (this.opponentHealth <= 0) {
          this.showGameOver(true);
          if (this.networkManager && this.networkManager.sendGameOver) {
            this.networkManager.sendGameOver();
          }
        }
      }
    }

    // بررسی برخورد گلوله‌های حریف با من
    for (let i = this.opponentBullets.length - 1; i >= 0; i--) {
      const bullet = this.opponentBullets[i];
      if (this.isColliding(bullet, this.airplane)) {
        this.applyDamage(10);
        bullet.remove();
        this.opponentBullets.splice(i, 1);
      }
    }
  }

  isColliding(bullet, airplane) {
    const bulletPos = bullet.getPosition();
    const airplanePos = airplane.getPosition();

    // تشخیص برخورد با حاشیه‌های کاهش یافته برای طبیعی‌تر شدن بازی
    const collisionMargin = 15;

    return (
      bulletPos.x + collisionMargin <
        airplanePos.x + airplanePos.width - collisionMargin &&
      bulletPos.x + bulletPos.width - collisionMargin >
        airplanePos.x + collisionMargin &&
      bulletPos.y + collisionMargin <
        airplanePos.y + airplanePos.height - collisionMargin &&
      bulletPos.y + bulletPos.height - collisionMargin >
        airplanePos.y + collisionMargin
    );
  }

  applyDamage(damage) {
    this.health -= damage;
    if (this.health < 0) this.health = 0;

    this.updateHealthDisplay();

    if (this.health <= 0) {
      this.showGameOver(false);
      if (this.networkManager && this.networkManager.sendGameOver) {
        this.networkManager.sendGameOver();
      }
    }
  }

  showGameOver(isWinner) {
    // متوقف کردن intervalها
    clearInterval(this.shootingInterval);
    if (this.wingmanShootingInterval)
      clearInterval(this.wingmanShootingInterval);
    clearInterval(this.opponentShootingInterval);
    clearInterval(this.cloudGenerationInterval);

    // نمایش صفحه پایان بازی
    const gameOverDiv = document.createElement("div");
    gameOverDiv.style.position = "fixed";
    gameOverDiv.style.top = "0";
    gameOverDiv.style.left = "0";
    gameOverDiv.style.width = "100%";
    gameOverDiv.style.height = "100%";
    gameOverDiv.style.background = "rgba(0,0,0,0.9)";
    gameOverDiv.style.color = "white";
    gameOverDiv.style.display = "flex";
    gameOverDiv.style.justifyContent = "center";
    gameOverDiv.style.alignItems = "center";
    gameOverDiv.style.zIndex = "1000";
    gameOverDiv.style.flexDirection = "column";
    gameOverDiv.innerHTML = `
      <div style="text-align: center; padding: 30px; background: rgba(0,0,0,0.8); border-radius: 15px;">
        <h2 style="font-size: 36px; margin-bottom: 20px;">Game Over</h2>
        <p style="font-size: 24px; margin-bottom: 10px;">You ${
          isWinner ? "Win! 🎉" : "Lose! 😢"
        }</p>
        <p style="font-size: 18px; margin-bottom: 20px;">Opponent: ${
          this.opponent?.username || "Unknown"
        }</p>
        <p style="font-size: 16px; margin-bottom: 10px;">Your Health: ${
          this.health
        }% | Opponent Health: ${this.opponentHealth}%</p>
        <button id="play-again-button" style="padding: 15px 30px; margin-top: 20px; font-size: 18px; background: #4CAF50; color: white; border: none; border-radius: 8px; cursor: pointer;">Play Again</button>
      </div>
    `;

    document.body.appendChild(gameOverDiv);

    // اضافه کردن event listener برای دکمه Play Again
    document
      .getElementById("play-again-button")
      .addEventListener("click", () => {
        location.reload();
      });
  }

  showOpponentDisconnected() {
    // نمایش پیام قطع ارتباط حریف
    const messageDiv = document.createElement("div");
    messageDiv.style.position = "fixed";
    messageDiv.style.top = "50%";
    messageDiv.style.left = "50%";
    messageDiv.style.transform = "translate(-50%, -50%)";
    messageDiv.style.background = "rgba(0,0,0,0.8)";
    messageDiv.style.color = "white";
    messageDiv.style.padding = "20px";
    messageDiv.style.borderRadius = "8px";
    messageDiv.style.zIndex = "1000";
    messageDiv.innerHTML = `<p style="font-size: 18px;">${
      this.opponent?.username || "Opponent"
    } disconnected. You win!</p>`;

    document.body.appendChild(messageDiv);

    setTimeout(() => {
      messageDiv.remove();
      this.showGameOver(true);
    }, 2000);
  }

  cleanup() {
    clearInterval(this.shootingInterval);
    if (this.wingmanShootingInterval)
      clearInterval(this.wingmanShootingInterval);
    clearInterval(this.opponentShootingInterval);
    clearInterval(this.cloudGenerationInterval);

    this.airplane.remove();
    if (this.wingman) this.wingman.remove();
    if (this.opponentAirplane) this.opponentAirplane.remove();

    // حذف نمایش سلامت
    if (this.playerHealthDisplay) this.playerHealthDisplay.remove();
    if (this.opponentHealthDisplay) this.opponentHealthDisplay.remove();

    // حذف تمام گلوله‌ها
    this.bullets.forEach((bullet) => bullet.remove());
    this.opponentBullets.forEach((bullet) => bullet.remove());

    // حذف networkManager از scope全局
    window.networkManager = null;
  }

  // تابع برای به روزرسانی ابعاد صفحه هنگام resize
  handleResize() {
    this.screenWidth = window.innerWidth;
    this.screenHeight = window.innerHeight;
  }
}

// اضافه کردن event listener برای resize
window.addEventListener("resize", () => {
  if (window.currentWarScene) {
    window.currentWarScene.handleResize();
  }
});
