// js/warScene.js

import { CONFIG } from "../config.js";
import { Airplane } from "./airplane.js";
import { OpponentAirplane } from "./opponentAirplane.js";
import { Cloud } from "./clouds.js";
import { RoadManager } from "./road.js";
import { Missile } from "./missile.js";
import { AirplaneWingman } from "./wingman.js";
import { Bullet } from "./bullet.js";

export class WarScene {
  constructor(
    CONFIG,
    networkManager,
    selectedAirplane,
    selectedBullet,
    selectedPotion,
    userData,
    initialHealth,
    initialOpponentHealth
  ) {
    this.CONFIG = CONFIG;
    this.networkManager = networkManager;
    this.selectedAirplane = selectedAirplane;
    this.selectedBullet = selectedBullet;
    this.selectedPotion = selectedPotion || null;
    this.userData = userData;
    this.opponent = null;
    this.opponentAirplane = null;
    this.opponentBullets = [];
    this.health = initialHealth || 100;
    this.opponentHealth = initialOpponentHealth || 100;
    this.bullets = [];
    this.isPotionActive = false;
    this.missiles = [];
    this.isShielded = false;
    this.originalBulletSpeed = this.CONFIG.bullets.speed;
    this.originalShootingInterval = this.CONFIG.bullets.interval;
    window.networkManager = networkManager;
    this.screenWidth = window.innerWidth;
    this.screenHeight = window.innerHeight;
  }
  async init() {
    this.setupScene();
    this.createGameObjects();
    this.startShooting();
    this.setupNetworkHandlers();
    this.startGameLoop();
    this.createHealthDisplays();
    this.setupPotionButton();
  }

  startShooting() {
    const planeData = window.gameManager.allPlanes.find(
      (p) =>
        p.tier === this.selectedAirplane.tier &&
        p.style === this.selectedAirplane.style
    );

    if (
      !planeData ||
      !planeData.projectiles ||
      planeData.projectiles.length === 0
    ) {
      console.error(
        `Shooting data not found for plane: ${this.selectedAirplane.name}.`
      );
      return;
    }

    const bulletVisuals = {
      blue: { filter: "saturate(3) hue-rotate(200deg)" },
      orange: { filter: "saturate(5) hue-rotate(15deg)" },
      red: { filter: "saturate(4) hue-rotate(320deg)" },
      purple: { filter: "saturate(3) hue-rotate(250deg)" },
    };
    const bulletSizeMap = { 1: 15, 2: 20, 3: 25, 5: 35 };
    const missileSizeMap = { 1: 20, 2: 25, 3: 30, 4: 40, 5: 50 };
    const totalProjectileCount = planeData.projectiles.reduce(
      (sum, p) => sum + p.count,
      0
    );
    const damagePerProjectile =
      totalProjectileCount > 0 ? planeData.damage / totalProjectileCount : 0;
    const shootingInterval = 1200;

    this.shootingInterval = setInterval(() => {
      if (!this.airplane || !this.airplane.element.parentNode) {
        clearInterval(this.shootingInterval);
        return;
      }
      const planePos = this.airplane.getPosition();
      const planeCenterX = planePos.x + planePos.width / 2;
      const planeCenterY = planePos.y + planePos.height / 2;

      planeData.projectiles.forEach((proj) => {
        const count = proj.count;
        for (let i = 0; i < count; i++) {
          let startX,
            startY,
            angleDeg = -90;
          let offsetX = 0,
            offsetY = 0;

          if (proj.from === "nose") {
            const offsetFromCenter = count > 1 ? (i - (count - 1) / 2) * 15 : 0;
            startX = planeCenterX + offsetFromCenter;
            startY = planePos.y + 20;
            offsetX = offsetFromCenter;
            offsetY = startY - planeCenterY;
          } else {
            const offsetRatio = proj.offset === "near" ? 0.3 : 0.1;
            const wing = i % 2 === 0 ? -1 : 1;
            startX = planeCenterX + wing * planePos.width * offsetRatio;
            startY = planePos.y + planePos.height * 0.4;
            offsetX = startX - planeCenterX;
            offsetY = startY - planeCenterY;
          }

          if (proj.pattern === "angled" && count > 1) {
            const spread = 40;
            angleDeg = -90 - spread / 2 + i * (spread / (count - 1));
          }

          let specSize, specFilter;
          if (proj.type === "bullet") {
            const visual = bulletVisuals[proj.color] || {};
            specSize = bulletSizeMap[proj.size] || 20;
            specFilter = visual.filter;
            const bullet = new Bullet(
              "./assets/images/bullets/lvl1.png",
              startX,
              startY,
              specSize,
              planeData.bulletSpeed / 20,
              angleDeg,
              false,
              specFilter
            );
            bullet.damage = damagePerProjectile;
            this.bullets.push(bullet);
          } else if (proj.type === "missile") {
            specSize = missileSizeMap[proj.size] || 30;
            specFilter = "none";
            const missile = new Missile({
              x: startX,
              y: startY,
              target: this.opponentAirplane,
              missileType: proj.missileType,
              speed: planeData.bulletSpeed / 30,
              damage: damagePerProjectile,
              size: specSize,
            });
            this.missiles.push(missile);
          }

          if (this.networkManager) {
            const planePercentX = planeCenterX / window.innerWidth;
            const planePercentY = planeCenterY / window.innerHeight;
            this.networkManager.sendShoot(
              planePercentX,
              planePercentY,
              offsetX,
              offsetY,
              angleDeg,
              false,
              specSize,
              specFilter || "none"
            );
          }
        }
      });
      this.playSound(this.CONFIG.assets.sound);
    }, shootingInterval);
  }

  setupPotionButton() {
    const potionBtn = document.getElementById("use-potion-btn");
    if (!potionBtn) {
      console.warn(
        'Potion button with id "use-potion-btn" not found in the DOM.'
      );
      return;
    }

    if (this.selectedPotion) {
      potionBtn.classList.remove("hidden");
      potionBtn.innerHTML = `<img src="${this.selectedPotion.imagePath}" alt="${this.selectedPotion.name}">`;
      const newPotionBtn = potionBtn.cloneNode(true);
      potionBtn.parentNode.replaceChild(newPotionBtn, potionBtn);
      newPotionBtn.addEventListener("click", () => this.activatePotion(), {
        once: true,
      });
    } else {
      potionBtn.classList.add("hidden");
    }
  }

  activatePotion() {
    if (!this.selectedPotion || this.isPotionActive) return;

    if (this.networkManager) {
      this.networkManager.sendPotionActivate(this.selectedPotion._id);
    }

    this.isPotionActive = true;
    const potionBtn = document.getElementById("use-potion-btn");
    potionBtn.style.opacity = "0.5";
    potionBtn.style.cursor = "not-allowed";

    const airplaneElement = this.airplane.element;
    let effectClass = "";
    let soundPath = "";

    console.log(`Potion Activated: ${this.selectedPotion.name}`);

    switch (this.selectedPotion.name) {
      case "معجون قدرت":
        soundPath = "assets/sounds/potions/power.mp3";
        effectClass = "power-effect";
        airplaneElement.classList.add(effectClass, "potion-effect-active");
        setTimeout(() => {
          airplaneElement.classList.remove(effectClass, "potion-effect-active");
          this.isPotionActive = false;
        }, 20000);
        break;

      case "معجون سرعت":
        soundPath = "assets/sounds/potions/speed.mp3";
        effectClass = "speed-effect";
        airplaneElement.classList.add(effectClass, "potion-effect-active");
        clearInterval(this.shootingInterval);
        this.CONFIG.bullets.interval = this.originalShootingInterval / 1.5;
        this.setupEventListeners();
        setTimeout(() => {
          airplaneElement.classList.remove(effectClass, "potion-effect-active");
          clearInterval(this.shootingInterval);
          this.CONFIG.bullets.interval = this.originalShootingInterval;
          this.setupEventListeners();
          this.isPotionActive = false;
        }, 30000);
        break;

      case "معجون محافظ":
        soundPath = "assets/sounds/potions/shield.mp3";
        effectClass = "shield-effect";
        airplaneElement.classList.add(effectClass);
        this.isShielded = true;
        setTimeout(() => {
          airplaneElement.classList.remove(effectClass);
          this.isShielded = false;
          this.isPotionActive = false;
        }, 10000);
        break;

      case "معجون درمان":
        soundPath = "assets/sounds/potions/heal.mp3";
        for (let i = 0; i < 20; i++) {
          const particle = document.createElement("div");
          particle.className = "heal-particle";
          document.body.appendChild(particle);
          const airplanePos = this.airplane.getPosition();
          particle.style.left = `${
            airplanePos.x + Math.random() * airplanePos.width
          }px`;
          particle.style.top = `${
            airplanePos.y + Math.random() * airplanePos.height
          }px`;
          setTimeout(() => particle.remove(), 1500);
        }
        this.isPotionActive = false;
        potionBtn.style.display = "none";
        break;
    }

    if (soundPath) {
      this.playSound(soundPath);
    }
  }
  applyOpponentPotionEffect(potionName) {
    if (!this.opponentAirplane) return;

    const opponentElement = this.opponentAirplane.element;
    let effectClass = "";

    switch (potionName) {
      case "معجون قدرت":
        effectClass = "power-effect";
        break;
      case "معجون سرعت":
        effectClass = "speed-effect";
        break;
      case "معجون محافظ":
        effectClass = "shield-effect";
        break;
    }

    if (effectClass) {
      opponentElement.classList.add(effectClass, "potion-effect-active");
      let duration = 20000;
      if (potionName === "معجون سرعت") duration = 30000;
      if (potionName === "معجون محافظ") duration = 10000;

      setTimeout(() => {
        opponentElement.classList.remove(effectClass, "potion-effect-active");
      }, duration);
    }
  }

  setOpponent(opponent) {
    this.opponent = opponent;
    this.createOpponentAirplane();
    this.updateOpponentHealthDisplay();
  }

  setupNetworkHandlers() {
    if (this.networkManager) {
      this.networkManager.onOpponentMove = (percentX, percentY) => {
        if (this.opponentAirplane) {
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
      this.networkManager.onOpponentShoot = (
        planePercentX,
        planePercentY,
        offsetX,
        offsetY,
        rotation,
        isWingman,
        bulletSpec
      ) => {
        if (!this.opponentAirplane) return;
        const opponentPlaneCenterX = (1 - planePercentX) * window.innerWidth;
        const opponentPlaneCenterY = (1 - planePercentY) * window.innerHeight;
        const bulletX = opponentPlaneCenterX - offsetX;
        const bulletY = opponentPlaneCenterY - offsetY;
        const mirroredRotation = -rotation;
        this.createOpponentBullet(
          bulletX,
          bulletY,
          mirroredRotation,
          bulletSpec
        );
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
      this.networkManager.onOpponentPotionActivate = (potionName) => {
        this.applyOpponentPotionEffect(potionName);
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
    const initialX = this.screenWidth / 2 - this.CONFIG.airplane.width / 2;
    const initialY = 50;
    this.opponentAirplane.setPosition(initialX, initialY);
  }

  createOpponentBullet(x, y, rotation = 180, bulletSpec) {
    if (!this.opponentAirplane) return;
    const opponentBulletImage = "./assets/images/bullets/lvl1.png";
    const planeData = window.gameManager.allPlanes.find(
      (p) =>
        p.tier === this.selectedAirplane.tier &&
        p.style === this.selectedAirplane.style
    );
    const bulletSpeed = planeData
      ? planeData.bulletSpeed / 20
      : this.CONFIG.bullets.speed;
    const bullet = this.opponentAirplane.shoot(
      opponentBulletImage,
      bulletSpeed,
      rotation,
      bulletSpec
    );
    if (x !== undefined && y !== undefined) {
      bullet.setPosition(x, y);
    }
    this.opponentBullets.push(bullet);
    this.playSound(this.CONFIG.assets.sound);
  }

  setupScene() {
    this.roadManager = new RoadManager(this.CONFIG);
    this.roadManager.init();
    this.bullets = [];
  }

  createGameObjects() {
    this.airplane = new Airplane(
      this.getAirplaneImage(
        this.selectedAirplane?.image || this.CONFIG.assets.airplane
      ),
      this.CONFIG.airplane.width,
      this.CONFIG.airplane.height
    );
    const playerX = this.screenWidth / 2 - this.CONFIG.airplane.width / 2;
    const playerY = this.screenHeight - this.CONFIG.airplane.height - 50;
    this.airplane.setPosition(playerX, playerY);

    if (this.CONFIG.wingmen.enabled) {
      this.wingman = new AirplaneWingman(this.airplane, {
        ...this.CONFIG.wingmen,
        images: {
          left: this.getAirplaneImage(this.CONFIG.assets.wingmen.left),
          right: this.getAirplaneImage(this.CONFIG.assets.wingmen.right),
        },
        bulletImage: this.getBulletImage(
          this.selectedBullet?.image || this.CONFIG.assets.bullet
        ),
      });
    }
    this.createClouds();
  }

  createHealthDisplays() {
    const gameContainer = document.getElementById("game-container");
    if (!gameContainer) return;

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
    gameContainer.appendChild(this.playerHealthDisplay);

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
    gameContainer.appendChild(this.opponentHealthDisplay);
  }

  updateHealthDisplay() {
    if (this.playerHealthDisplay) {
      this.playerHealthDisplay.innerHTML = `Your Health: ${Math.round(
        this.health
      )}%`;
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
      } Health: ${Math.round(this.opponentHealth)}%`;
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
    this.gameBounds = {
      minX: 0,
      maxX: settings.maxX,
      minY: 0,
      maxY: settings.maxY,
    };
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

  setupEventListeners() {
    const baseInterval = this.CONFIG.bullets.interval;
    const userSpeedLevel = this.userData.speedLevel || 1;
    const actualInterval = baseInterval / (1 + (userSpeedLevel - 1) * 0.1);

    if (this.shootingInterval) {
      clearInterval(this.shootingInterval);
    }

    this.shootingInterval = setInterval(() => {
      const bulletImage = this.getBulletImage(
        this.selectedBullet?.image || this.CONFIG.assets.bullet
      );

      const airplaneKey = `${this.selectedAirplane.tier}_${this.selectedAirplane.style}`;
      const bulletLevel =
        (this.userData.airplaneBulletLevels &&
          this.userData.airplaneBulletLevels[airplaneKey]) ||
        1;

      const bulletSpecs = {
        1: { size: 20, filter: "saturate(3) hue-rotate(200deg)" },
        2: { size: 25, filter: "saturate(5) hue-rotate(15deg)" },
        3: { size: 30, filter: "saturate(4) hue-rotate(320deg)" },
        4: { size: 40, filter: "saturate(3) hue-rotate(250deg)" },
      };
      const spec = bulletSpecs[bulletLevel];

      this.CONFIG.bullets.angles.forEach((angle) => {
        const bullet = this.airplane.shoot(
          bulletImage,
          spec.size,
          this.CONFIG.bullets.speed,
          angle,
          spec.filter
        );
        this.bullets.push(bullet);
      });

      this.playSound(this.CONFIG.assets.sound);

      if (this.networkManager && this.networkManager.sendShoot) {
        const pos = this.airplane.getPosition();
        const percentX = pos.x / window.innerWidth;
        const percentY = pos.y / window.innerHeight;
        this.networkManager.sendShoot(
          percentX,
          percentY,
          180,
          false,
          spec.size,
          spec.filter
        );
      }
    }, actualInterval);
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
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      if (!this.bullets[i].active) {
        this.bullets.splice(i, 1);
      }
    }
    for (let i = this.opponentBullets.length - 1; i >= 0; i--) {
      if (!this.opponentBullets[i].active) {
        this.opponentBullets.splice(i, 1);
      }
    }
  }

  createClouds() {
    for (let i = 0; i < this.CONFIG.clouds.count; i++) {
      setTimeout(() => {
        new Cloud({
          backwardSpeed:
            this.CONFIG.clouds.minSpeed +
            Math.random() *
              (this.CONFIG.clouds.maxSpeed - this.CONFIG.clouds.minSpeed),
          horizontalSpeed: (Math.random() - 0.5) * 2.5,
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
    this.cloudGenerationInterval = setInterval(() => {
      new Cloud({
        backwardSpeed:
          this.CONFIG.clouds.minSpeed +
          Math.random() *
            (this.CONFIG.clouds.maxSpeed - this.CONFIG.clouds.minSpeed),
        horizontalSpeed: (Math.random() - 0.5) * 2.5,
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
    if (!this.opponentAirplane) return;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      if (
        bullet &&
        bullet.active &&
        this.isColliding(bullet, this.opponentAirplane)
      ) {
        this.networkManager.sendHit(bullet.damage);
        bullet.remove();
        this.bullets.splice(i, 1);
      }
    }
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const missile = this.missiles[i];
      if (
        missile &&
        missile.active &&
        this.isColliding(missile, this.opponentAirplane)
      ) {
        this.networkManager.sendHit(missile.damage);
        missile.remove();
        this.missiles.splice(i, 1);
      }
    }
    for (let i = this.opponentBullets.length - 1; i >= 0; i--) {
      const bullet = this.opponentBullets[i];
      if (
        !this.isShielded &&
        bullet &&
        bullet.active &&
        this.isColliding(bullet, this.airplane)
      ) {
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
    if (this.health <= 0) {
      this.showGameOver(false);
    } else if (this.opponentHealth <= 0) {
      this.showGameOver(true);
    }
  }

  isColliding(bullet, airplane) {
    const bulletPos = bullet.getPosition();
    const airplanePos = airplane.getPosition();
    const collisionMargin = 15;
    const bulletCenterX = bulletPos.x + bulletPos.width / 2;
    const bulletCenterY = bulletPos.y + bulletPos.height / 2;
    return (
      bulletCenterX > airplanePos.x + collisionMargin &&
      bulletCenterX < airplanePos.x + airplanePos.width - collisionMargin &&
      bulletCenterY > airplanePos.y + collisionMargin &&
      bulletCenterY < airplanePos.y + airplanePos.height - collisionMargin
    );
  }

  showGameOver(isWinner) {
    clearInterval(this.shootingInterval);
    if (this.wingmanShootingInterval)
      clearInterval(this.wingmanShootingInterval);
    clearInterval(this.opponentShootingInterval);
    clearInterval(this.cloudGenerationInterval);

    // توقف موسیقی بازی
    if (window.musicManager) {
      window.musicManager.stop();
    }

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
    document
      .getElementById("play-again-button")
      .addEventListener("click", () => {
        location.reload();
      });
  }

  showOpponentDisconnected() {
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
    if (this.airplane) this.airplane.remove();
    if (this.wingman) this.wingman.remove();
    if (this.opponentAirplane) this.opponentAirplane.remove();
    if (this.playerHealthDisplay) this.playerHealthDisplay.remove();
    if (this.opponentHealthDisplay) this.opponentHealthDisplay.remove();
    this.bullets.forEach((bullet) => bullet.remove());
    this.missiles.forEach((missile) => missile.remove());
    this.opponentBullets.forEach((bullet) => bullet.remove());
    window.networkManager = null;

    // توقف موسیقی هنگام خروج از صحنه بازی
    if (window.musicManager) {
      window.musicManager.stop();
    }
  }

  handleResize() {
    this.screenWidth = window.innerWidth;
    this.screenHeight = window.innerHeight;
  }
}

window.addEventListener("resize", () => {
  if (window.currentWarScene) {
    window.currentWarScene.handleResize();
  }
});
