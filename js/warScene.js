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
    CONFIG, networkManager, selectedAirplane, selectedBullet, selectedPotion,
    userData, initialHealth, initialOpponentHealth, selectedWingman
  ) {
    this.CONFIG = CONFIG;
    this.networkManager = networkManager;
    this.selectedAirplane = selectedAirplane;
    this.selectedBullet = selectedBullet;
    this.selectedPotion = selectedPotion || null;
    this.selectedWingman = selectedWingman || null;
    this.userData = userData;
    this.opponent = null;
    this.airplane = null;
    this.opponentAirplane = null;
    this.opponentWingman = null;
    this.wingman = null;
    this.roadManager = null;
    
    this.bullets = [];
    this.opponentBullets = [];
    this.missiles = [];
    this.clouds = [];
    
    this.health = initialHealth || 100;
    this.opponentHealth = initialOpponentHealth || 100;
    
    this.isPotionUsed = false;
    this.isShielded = false;
    this.damageMultiplier = 1;
    this.baseShootingInterval = 1200;
    this.shootingInterval = null;
    
    this.activeEffects = { power: 0, speed: 0, shield: 0 };
    window.networkManager = networkManager;

    this.gameLoopId = null;
    this.lastFrameTime = performance.now();
    
    this.boundPotionClickHandler = this.handlePotionClick.bind(this);
  }

  async init() {
    this.setupScene();
    this.createGameObjects();
    this.startShooting();
    this.setupNetworkHandlers();
    this.createHealthDisplays();
    this.setupPotionButton();
    this.startGameLoop();
  }

  handlePotionClick() {
    if (this.isPotionUsed) return;
    this.activatePotion();
    this.isPotionUsed = true;
  }

  setupPotionButton() {
    const potionBtn = document.getElementById("use-potion-btn");
    if (!potionBtn) return;

    let shouldShow = false;
    if (this.selectedPotion && this.selectedPotion._id !== "none") {
      const ownedPotion = this.userData.ownedPotions.find((p) => {
        const potionIdInInventory = p.potion._id || p.potion;
        return potionIdInInventory === this.selectedPotion._id;
      });
      if (ownedPotion && ownedPotion.quantity > 0) {
        shouldShow = true;
      }
    }

    // این خط هرگونه استایل inline مثل display:none را پاک می‌کند
    potionBtn.style.display = "";

    if (shouldShow) {
      potionBtn.innerHTML = `<img src="${this.selectedPotion.imagePath}" alt="${this.selectedPotion.name}">`;
      potionBtn.classList.remove("hidden");
    } else {
      potionBtn.classList.add("hidden");
    }
  }

  updateEffects() {
    const now = Date.now();
    if (!this.airplane || !this.airplane.element) return;
    const airplaneElement = this.airplane.element;

    if (this.activeEffects.power > 0 && now >= this.activeEffects.power) {
      this.damageMultiplier = 1;
      airplaneElement.classList.remove("power-effect");
      this.activeEffects.power = 0;
    }
    if (this.activeEffects.speed > 0 && now >= this.activeEffects.speed) {
      this.setShootingInterval(this.baseShootingInterval);
      airplaneElement.classList.remove("speed-effect");
      this.activeEffects.speed = 0;
    }
    if (this.activeEffects.shield > 0 && now >= this.activeEffects.shield) {
      this.isShielded = false;
      airplaneElement.classList.remove("shield-effect");
      this.activeEffects.shield = 0;
    }
  }

startGameLoop() {
    const gameLoop = (timestamp) => {
      if (!this.airplane) { // Stop the loop if scene is cleaned up
        return;
      }
      const deltaTime = (timestamp - this.lastFrameTime) / 1000; // Delta time in seconds
      this.lastFrameTime = timestamp;

      // Update all game components with delta time
      this.updateEffects();
      if(this.roadManager) this.roadManager.update(deltaTime);
      this.clouds.forEach(cloud => cloud.update(deltaTime));
      this.updateBullets(deltaTime);
      this.missiles.forEach(missile => missile.update(deltaTime));

      if (this.wingman) this.wingman.update(deltaTime);
      if (this.opponentWingman) this.opponentWingman.update(deltaTime);
      
      this.checkCollisions();

      this.gameLoopId = requestAnimationFrame(gameLoop);
    };
    this.gameLoopId = requestAnimationFrame(gameLoop);
  }

  activatePotion() {
    if (!this.selectedPotion || this.isPotionUsed) return;
    this.networkManager.sendPotionActivate(this.selectedPotion._id);

    const potionBtn = document.getElementById("use-potion-btn");
    if (potionBtn) {
      potionBtn.style.opacity = "0.5";
      potionBtn.style.cursor = "not-allowed";
    }

    const airplaneElement = this.airplane.element;
    let effectClass = "";
    let soundPath = "";
    const effectDuration = 8000;

    switch (this.selectedPotion.name) {
      case "معجون قدرت":
        soundPath = "assets/sounds/potions/power.mp3";
        effectClass = "power-effect";
        airplaneElement.classList.add(effectClass);
        this.damageMultiplier = 2;
        this.activeEffects.power = Date.now() + effectDuration;
        break;
      case "معجون سرعت":
        soundPath = "assets/sounds/potions/speed.mp3";
        effectClass = "speed-effect";
        airplaneElement.classList.add(effectClass);
        this.setShootingInterval(this.baseShootingInterval / 4);
        this.activeEffects.speed = Date.now() + effectDuration;
        break;
      case "معجون محافظ":
        soundPath = "assets/sounds/potions/shield.mp3";
        effectClass = "shield-effect";
        airplaneElement.classList.add(effectClass);
        this.isShielded = true;
        this.activeEffects.shield = Date.now() + effectDuration;
        break;
      case "معجون درمان":
        soundPath = "assets/sounds/potions/heal.mp3";
        airplaneElement.classList.add("heal-aura-effect");
        setTimeout(() => {
          airplaneElement.classList.remove("heal-aura-effect");
        }, 1500);
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
          setTimeout(() => particle.remove(), 2000);
        }
        // *** این خط که مشکل اصلی بود، حذف شد ***
        // potionBtn.style.display = "none";
        break;
    }
    if (soundPath) this.playSound(soundPath);
  }

setShootingInterval(interval) {
    if (this.shootingInterval) {
      clearInterval(this.shootingInterval);
    }
    const planeData = window.gameManager.allPlanes.find(
      (p) =>
        p.tier === this.selectedAirplane.tier &&
        p.style === this.selectedAirplane.style
    );
    if (!planeData || !planeData.projectiles) return;
    
    // Speed is now defined in pixels per second
    const BULLET_SPEED_MULTIPLIER = 3;
    const MISSILE_SPEED_MULTIPLIER = 2.5;

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

    this.shootingInterval = setInterval(() => {
      if (!this.airplane || !this.airplane.element.parentNode) {
        clearInterval(this.shootingInterval);
        return;
      }
      const planePos = this.airplane.getPosition();
      const planeCenterX = planePos.x + planePos.width / 2;
      const planeCenterY = planePos.y + planePos.height / 2;
      const damagePerProjectile =
        totalProjectileCount > 0
          ? (planeData.damage * this.damageMultiplier) / totalProjectileCount
          : 0;

      planeData.projectiles.forEach((proj) => {
        const count = proj.count;
        for (let i = 0; i < count; i++) {
          let startX, startY, angleDeg = -90, offsetX = 0, offsetY = 0;
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
              "./assets/images/bullets/lvl1.png", startX, startY, specSize,
              planeData.bulletSpeed * BULLET_SPEED_MULTIPLIER, angleDeg, false, specFilter
            );
            bullet.damage = damagePerProjectile;
            this.bullets.push(bullet);
          } else if (proj.type === "missile") {
            specSize = missileSizeMap[proj.size] || 30;
            specFilter = "none";
            const missile = new Missile({
              x: startX, y: startY, target: this.opponentAirplane,
              missileType: proj.missileType, speed: planeData.bulletSpeed * MISSILE_SPEED_MULTIPLIER,
              damage: damagePerProjectile, size: specSize,
            });
            this.missiles.push(missile);
          }
          if (this.networkManager) {
            this.networkManager.sendShoot("main_plane", {
              planePercentX: planeCenterX / window.innerWidth,
              planePercentY: planeCenterY / window.innerHeight,
              offsetX: offsetX, offsetY: offsetY, rotation: angleDeg,
              bulletSpec: { size: specSize, filter: specFilter || "none" },
            });
          }
        }
      });
      if (this.wingman) {
        const wingmanBullets = this.wingman.shoot();
        this.bullets.push(...wingmanBullets);
        if (this.networkManager) {
          const wingmanConfig = this.wingman.config;
          const bulletSpec = { size: wingmanConfig.bulletSize, filter: "none" };
          this.networkManager.sendShoot("left_wingman", { bulletSpec });
          this.networkManager.sendShoot("right_wingman", { bulletSpec });
        }
      }
      this.playSound(this.CONFIG.assets.sound);
    }, interval);
  }
startShooting() {
    this.setShootingInterval(this.baseShootingInterval);
  }

  applyOpponentPotionEffect(potionName) {
    if (!this.opponentAirplane) return;
    const opponentElement = this.opponentAirplane.element;
    let effectClass = "";
    let duration = 8000;
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
      case "معجون درمان":
        opponentElement.classList.add("heal-aura-effect");
        setTimeout(() => {
          opponentElement.classList.remove("heal-aura-effect");
        }, 1500);
        for (let i = 0; i < 20; i++) {
          const particle = document.createElement("div");
          particle.className = "heal-particle";
          document.body.appendChild(particle);
          const airplanePos = this.opponentAirplane.getPosition();
          particle.style.left = `${
            airplanePos.x + Math.random() * airplanePos.width
          }px`;
          particle.style.top = `${
            airplanePos.y + Math.random() * airplanePos.height
          }px`;
          setTimeout(() => particle.remove(), 2000);
        }
        duration = 0;
        break;
    }
    if (effectClass) {
      opponentElement.classList.add(effectClass, "potion-effect-active");
      setTimeout(() => {
        opponentElement.classList.remove(effectClass, "potion-effect-active");
      }, duration);
    }
  }

  setOpponent(opponentData) {
    this.opponent = opponentData;
    this.createOpponentAirplane();
    this.updateOpponentHealthDisplay();

    // منطق جدید برای ساخت همراهان حریف
    if (opponentData.wingman && this.CONFIG.wingmen.enabled) {
      this.opponentWingman = new AirplaneWingman(this.opponentAirplane, {
        ...this.CONFIG.wingmen,
        images: {
          left: opponentData.wingman.image,
          right: opponentData.wingman.image,
        },
        isOpponent: true, // <<<< این خط اضافه شد
      });
    }
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
        this.updateGameBounds(settings);
      };
      this.networkManager.onHealthUpdate = (health, opponentHealth) => {
        this.health = health;
        this.opponentHealth = opponentHealth;
        this.updateHealthDisplay();
        this.updateOpponentHealthDisplay();
      };
      this.networkManager.onOpponentShoot = (message) => {
        if (!this.opponentAirplane) return;

        const source = message.source;
        const details = message.details;
        let bulletX, bulletY, rotation;

        switch (source) {
          case "main_plane":
            // بازسازی موقعیت گلوله از روی آفست‌های هواپیمای اصلی حریف
            const opponentPlaneCenterX =
              (1 - details.planePercentX) * window.innerWidth;
            const opponentPlaneCenterY =
              (1 - details.planePercentY) * window.innerHeight;
            bulletX = opponentPlaneCenterX - details.offsetX;
            bulletY = opponentPlaneCenterY - details.offsetY;
            rotation = -details.rotation;
            break;

          case "left_wingman":
          case "right_wingman":
            if (!this.opponentWingman) return; // اگر همراه حریف وجود نداشت، شلیک نکن

            // گرفتن المنت همراه (چپ یا راست) بر اساس پیام دریافتی
            const wingmanElement =
              source === "left_wingman"
                ? this.opponentWingman.leftWingman
                : this.opponentWingman.rightWingman;

            // گرفتن موقعیت لحظه‌ای و دقیق همان همراه روی صفحه ما
            const pos = this.opponentWingman.getWingmanPosition(wingmanElement);

            // گلوله از نوک (پایین) همراه شلیک می‌شود چون ۱۸۰ درجه چرخیده است
            bulletX = pos.x + pos.width / 2;
            bulletY = pos.y + pos.height;
            rotation = 90; // برای حریف، زاویه مستقیم به سمت پایین ۹۰ درجه است
            break;

          default:
            return; // منبع شلیک نامشخص
        }

        // ایجاد گلوله در موقعیت محاسبه‌شده
        this.createOpponentBullet(
          bulletX,
          bulletY,
          rotation,
          details.bulletSpec
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
      this.CONFIG.airplane.height,
      // +++ FIX: Pass the entire CONFIG object +++
      this.CONFIG
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
  }

 createGameObjects() {
    this.airplane = new Airplane(
      this.selectedAirplane?.image || this.CONFIG.assets.airplane,
      this.CONFIG.airplane.width,
      this.CONFIG.airplane.height
    );
    const playerX = window.innerWidth / 2 - this.CONFIG.airplane.width / 2;
    const playerY = window.innerHeight - this.CONFIG.airplane.height - 50;
    this.airplane.setPosition(playerX, playerY);

    if (this.CONFIG.wingmen.enabled && this.selectedWingman) {
      this.wingman = new AirplaneWingman(this.airplane, {
        ...this.CONFIG.wingmen,
        damage: this.selectedWingman.damage,
        images: {
          left: this.selectedWingman.image,
          right: this.selectedWingman.image,
        },
        bulletImage: this.selectedBullet?.image || this.CONFIG.assets.bullet,
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
updateBullets(deltaTime) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
        const bullet = this.bullets[i];
        if (bullet.active) {
            bullet.update(deltaTime);
        } else {
            this.bullets.splice(i, 1);
        }
    }
    for (let i = this.opponentBullets.length - 1; i >= 0; i--) {
        const bullet = this.opponentBullets[i];
        if (bullet.active) {
            bullet.update(deltaTime);
        } else {
            this.opponentBullets.splice(i, 1);
        }
    }
  }
createClouds() {
    for (let i = 0; i < this.CONFIG.clouds.count; i++) {
        const cloud = new Cloud({
            speed: (this.CONFIG.clouds.minSpeed + Math.random() * (this.CONFIG.clouds.maxSpeed - this.CONFIG.clouds.minSpeed)),
            horizontalSpeed: (Math.random() - 0.5) * 2.5,
            size: (this.CONFIG.clouds.minSize + Math.random() * (this.CONFIG.clouds.maxSize - this.CONFIG.clouds.minSize)),
            imageUrl: `./${this.CONFIG.assets.clouds[i % this.CONFIG.assets.clouds.length]}`,
            startX: Math.random() * window.innerWidth,
        });
        this.clouds.push(cloud);
    }
  }
  getCloudImage(cloudPath) {
    return `./${cloudPath}`;
  }
  playSound(soundPath) {
    try {
      const audio = new Audio(`./${soundPath}`);
      audio.volume = 0.3;
      audio.play().catch((e) => {});
    } catch (e) {}
  }

  checkCollisions() {
    if (!this.opponentAirplane || !this.airplane) return;
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

  isColliding(bullet, airplane) {
    if (!bullet || !airplane) return false;
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

  applyDamage(damage) {
    if (this.isShielded) return;
    this.health -= damage;
    this.updateHealthDisplay();
    if (this.health <= 0) {
      this.health = 0;
    }
  }

  showGameOver(isWinner) {
    clearInterval(this.shootingInterval);
    if (this.cloudGenerationInterval)
      clearInterval(this.cloudGenerationInterval);
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
    gameOverDiv.innerHTML = ` <div style="text-align: center; padding: 30px; background: rgba(0,0,0,0.8); border-radius: 15px;"> <h2 style="font-size: 36px; margin-bottom: 20px;">Game Over</h2> <p style="font-size: 24px; margin-bottom: 10px;">You ${
      isWinner ? "Win! 🎉" : "Lose! 😢"
    }</p> <p style="font-size: 18px; margin-bottom: 20px;">Opponent: ${
      this.opponent?.username || "Unknown"
    }</p> <p style="font-size: 16px; margin-bottom: 10px;">Your Health: ${Math.round(
      this.health
    )}% | Opponent Health: ${Math.round(
      this.opponentHealth
    )}%</p> <button id="play-again-button" style="padding: 15px 30px; margin-top: 20px; font-size: 18px; background: #4CAF50; color: white; border: none; border-radius: 8px; cursor: pointer;">Play Again</button> </div> `;
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
    if (this.gameLoopId) {
      cancelAnimationFrame(this.gameLoopId);
      this.gameLoopId = null;
    }
    if (this.shootingInterval) {
      clearInterval(this.shootingInterval);
      this.shootingInterval = null;
    }
    
    // Remove all DOM elements
    if (this.airplane) this.airplane.remove();
    if (this.opponentAirplane) this.opponentAirplane.remove();
    if (this.wingman) this.wingman.remove();
    if (this.opponentWingman) this.opponentWingman.remove();
    this.bullets.forEach(b => b.remove());
    this.opponentBullets.forEach(b => b.remove());
    this.missiles.forEach(m => m.remove());
    this.clouds.forEach(c => c.remove());
    
    // Clear arrays
    this.bullets = [];
    this.opponentBullets = [];
    this.missiles = [];
    this.clouds = [];
    this.airplane = null;

    if (window.musicManager) {
      window.musicManager.stop();
    }
    
    // Remove network handlers to prevent memory leaks
    if(this.networkManager) {
      this.networkManager.onOpponentMove = null;
      this.networkManager.onOpponentShoot = null;
      // ... and so on for all other handlers
    }
    window.networkManager = null;
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
