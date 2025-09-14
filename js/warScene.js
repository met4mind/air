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
    this.selectedPotion = selectedPotion || null; // جدید
    this.isPotionActive = false; // جدید

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
    this.setupPotionButton(); // جدید
  }
  setupPotionButton() {
    const potionBtn = document.getElementById("use-potion-btn");
    if (this.selectedPotion) {
      potionBtn.classList.remove("hidden");
      potionBtn.innerHTML = `<img src="${this.selectedPotion.imagePath}" alt="${this.selectedPotion.name}">`;
      potionBtn.addEventListener("click", () => this.activatePotion(), {
        once: true,
      }); // فقط یک بار قابل کلیک باشد
    } else {
      potionBtn.classList.add("hidden");
    }
  }

  activatePotion() {
    if (!this.selectedPotion || this.isPotionActive) return;

    this.isPotionActive = true;
    const potionBtn = document.getElementById("use-potion-btn");
    potionBtn.style.opacity = "0.5";
    potionBtn.style.cursor = "not-allowed";

    console.log(`Potion Activated: ${this.selectedPotion.name}`);

    // اعمال افکت بر اساس نوع معجون
    // این یک مثال ساده است و باید بر اساس فیلد effect در دیتابیس پیاده‌سازی شود
    switch (this.selectedPotion.name) {
      case "معجون قدرت":
        const originalDamage = 10;
        const boostedDamage = 15;
        // افزایش موقت قدرت برخورد
        this.networkManager.damage = boostedDamage;
        setTimeout(() => {
          this.networkManager.damage = originalDamage;
          this.isPotionActive = false;
          console.log("Power potion expired.");
        }, 20000); // 20 ثانیه
        break;
      // ... سایر معجون‌ها
    }

    // اطلاع به سرور (اختیاری، بستگی به منطق بازی شما دارد)
    // this.networkManager.send({ type: 'potion_activated', potionId: this.selectedPotion._id });
  }

  setOpponent(opponent) {
    this.opponent = opponent;
    this.createOpponentAirplane();
    this.updateOpponentHealthDisplay();
  }

  setupNetworkHandlers() {
    if (this.networkManager) {
      // در warScene.js - تابع onOpponentMove
      this.networkManager.onOpponentMove = (percentX, percentY) => {
        if (this.opponentAirplane) {
          // تبدیل درصد به موقعیت واقعی در صفحه فعلی
          const actualX =
            (1 - percentX) * window.innerWidth - this.opponentAirplane.width;
          const actualY =
            (1 - percentY) * window.innerHeight - this.opponentAirplane.height;

          this.opponentAirplane.setPosition(actualX, actualY);
        }
      };
      this.networkManager.onGameSettings = (settings) => {
        window.gameSettings = settings;
        this.updateGameBounds(settings);
      };
      this.networkManager.onHealthUpdate = (health, opponentHealth) => {
        this.health = health;
        this.opponentHealth = opponentHealth;
        this.updateHealthDisplay();
        this.updateOpponentHealthDisplay();
      };

      // در warScene.js - تابع onOpponentShoot
      // در warScene.js - تابع onOpponentShoot
      this.networkManager.onOpponentShoot = (
        percentX,
        percentY,
        rotation,
        isWingman
      ) => {
        if (!this.opponentAirplane) return;

        // موقعیت هواپیمای حریف
        const airplanePos = this.opponentAirplane.getPosition();
        const noseX = airplanePos.x + airplanePos.width / 2;
        const noseY = airplanePos.y + airplanePos.height;

        // ایجاد گلوله مستقیماً از دماغه هواپیما
        // (نادیده گرفتن موقعیت درصدی برای رفع مشکل)
        this.createOpponentBullet(noseX, noseY, 180);
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

  createOpponentBullet(x, y, rotation = 180) {
    if (!this.opponentAirplane) return;

    const bullet = this.opponentAirplane.shoot(
      this.getBulletImage(this.opponent.bullets),
      this.CONFIG.bullets.size,
      this.CONFIG.bullets.speed,
      rotation
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
  updateGameBounds(settings) {
    // ذخیره محدوده مجاز حرکت
    this.gameBounds = {
      minX: 0,
      maxX: settings.maxX,
      minY: 0,
      maxY: settings.maxY,
    }; // محدود کردن موقعیت فعلی هواپیما
    const currentPos = this.airplane.getPosition();
    const newX = Math.min(
      Math.max(currentPos.x, this.gameBounds.minX),
      this.gameBounds.maxX
    );
    const newY = Math.min(
      Math.max(currentPos.y, this.gameBounds.minY),
      this.gameBounds.maxY
    );

    this.airplane.setPosition(newX, newY);
  }
  // در تابع setupEventListeners، interval شلیک حریف را حذف کنید
  setupEventListeners() {
    // Setup shooting intervals - فقط برای بازیکن اصلی
    // در warScene.js - تابع setupEventListeners
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

      // اطلاع به سرور از شلیک با موقعیت درصدی
      if (this.networkManager && this.networkManager.sendShoot) {
        const pos = this.airplane.getPosition();
        const percentX = pos.x / window.innerWidth;
        const percentY = pos.y / window.innerHeight;

        this.networkManager.sendShoot(percentX, percentY, 180);
      }
    }, this.CONFIG.bullets.interval);
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
    // Determine the damage to send based on whether the power potion is active
    const damageToSend = this.isPotionActive ? 15 : 10;

    // Check for collisions between my bullets and the opponent's airplane
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      if (
        this.opponentAirplane &&
        this.isColliding(bullet, this.opponentAirplane)
      ) {
        if (this.networkManager && this.networkManager.sendHit) {
          // Send the determined damage to the server
          this.networkManager.sendHit(damageToSend);
        }
        // Remove the bullet after it hits
        bullet.remove();
        this.bullets.splice(i, 1);
      }
    }

    // Check for collisions between opponent's bullets and my airplane
    for (let i = this.opponentBullets.length - 1; i >= 0; i--) {
      const bullet = this.opponentBullets[i];
      if (this.isColliding(bullet, this.airplane)) {
        // No need to send damage to the server from here, as the server should handle the opponent's hits
        // and update our health via a socket message.

        // Remove the bullet after it hits
        bullet.remove();
        this.opponentBullets.splice(i, 1);
      }
    }
  }

  setHealth(health, opponentHealth) {
    this.health = health;
    this.opponentHealth = opponentHealth;
    this.updateHealthDisplay();
    this.updateOpponentHealthDisplay();

    // بررسی پایان بازی محلی (برای موارد قطع ارتباط)
    if (this.health <= 0) {
      this.showGameOver(false);
    } else if (this.opponentHealth <= 0) {
      this.showGameOver(true);
    }
  }

  isColliding(bullet, airplane) {
    const bulletPos = bullet.getPosition();
    const airplanePos = airplane.getPosition();

    // تشخیص برخورد با حاشیه‌های کاهش یافته برای طبیعی‌تر شدن بازی
    const collisionMargin = 15;

    // محاسبه مرکز گلوله
    const bulletCenterX = bulletPos.x + bulletPos.width / 2;
    const bulletCenterY = bulletPos.y + bulletPos.height / 2;

    // بررسی برخورد با استفاده از مرکز گلوله و محدوده هواپیما
    return (
      bulletCenterX > airplanePos.x + collisionMargin &&
      bulletCenterX < airplanePos.x + airplanePos.width - collisionMargin &&
      bulletCenterY > airplanePos.y + collisionMargin &&
      bulletCenterY < airplanePos.y + airplanePos.height - collisionMargin
    );
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
