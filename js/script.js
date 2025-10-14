import { CONFIG } from "./../config.js";
import { WarScene } from "./warScene.js";
import { NetworkManager } from "./network.js";
import { Bullet } from "./bullet.js";

class GameManager {
  constructor() {
    this.currentScene = null;
    this.scenes = { war: null };
    this.networkManager = new NetworkManager();
    this.isRegistering = false;
    this.username = "";
    this.userDataInterval = null;
    this.selectedPotion = null;
    this.selectedAirplane = null;
    this.selectedBullet = null;
    this.selectedWingman = null; // <<<< پراپرتی جدید
    this.userData = null;
    this.allPlanes = [];
    this.allWingmen = []; // <<<< پراپرتی جدید
    this.mainMenuShootingInterval = null;
    this.mainMenuBullets = [];
    this.init();
  }

async init() {
    document
      .getElementById("cancel-search-container")
      .addEventListener("click", () => this.cancelSearch());

    await this.fetchAllAssets();

    // این شرط بررسی می‌کند که آیا برنامه داخل محیط تلگرام اجرا شده است یا خیر
    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready(); // به تلگرام اعلام می‌کنیم که اپ آماده است
      tg.expand(); // اپ را تمام صفحه می‌کنیم

      const initData = tg.initData || "";
      const initDataUnsafe = tg.initDataUnsafe || {};

      // استخراج کد معرف (referrer) از پارامترهای شروع اپ
      const referrerTgid = initDataUnsafe.start_param || null;

      try {
        // تلاش برای احراز هویت با ارسال داده‌های تلگرام به بک‌اند
        const userData = await this.networkManager.authenticateWithTelegram(
          initData,
          referrerTgid
        );

        if (userData && userData.tgid) {
          this.networkManager.setTgid(userData.tgid);
          this.networkManager.userId = userData._id;
          this.username = userData.username;
          this.userData = userData;
          localStorage.setItem("userData", JSON.stringify(userData));

          // به‌روزرسانی هواپیما و تجهیزات پیش‌فرض بر اساس داده‌های کاربر
          this.updateDefaultSelections();
          this.updateMainMenuAirplaneImage();

          this.startUserDataSync();
          // نمایش منوی اصلی بازی
          if (window.menuManager) window.menuManager.showMenu("main-menu");
        } else {
          // اگر بک‌اند اطلاعات کاربر را برنگرداند
          throw new Error("اطلاعات کاربری از سرور دریافت نشد.");
        }
      } catch (error) {
        // در صورت شکست درخواست احراز هویت، این پیام نمایش داده می‌شود
        console.error("Authentication failed:", error);
        document.body.innerHTML =
          "<h1>خطا در احراز هویت. لطفا اپ را مجددا راه‌اندازی کنید.</h1>";
      }
    } else {
      // این بخش فقط زمانی اجرا می‌شود که اپ مستقیماً در مرورگر باز شود
      document.body.innerHTML =
        "<h1>این اپلیکیشن باید از طریق تلگرام اجرا شود.</h1>";
      console.error("Telegram WebApp context not found.");
    }
  }
  updateDefaultSelections() {
    if (!this.userData) return;

    // انتخاب هواپیمای کاربر
    const savedAirplane = JSON.parse(localStorage.getItem("selectedAirplane"));
    if (savedAirplane) {
      this.selectedAirplane = this.allPlanes.find(
        (p) => p.tier === savedAirplane.tier && p.style === savedAirplane.style
      );
    }
    if (!this.selectedAirplane) {
      this.selectedAirplane = this.allPlanes.find(
        (p) =>
          p.tier === this.userData.airplaneTier &&
          p.style === this.userData.airplaneStyle
      );
    }

    // انتخاب همراه کاربر
    const savedWingman = JSON.parse(localStorage.getItem("selectedWingman"));
    if (savedWingman) {
      this.selectedWingman = this.allWingmen.find(
        (w) => w.level === savedWingman.level
      );
    }
    if (!this.selectedWingman) {
      this.selectedWingman = this.allWingmen.find(
        (w) => w.level === this.userData.wingmanLevel
      );
    }
  }
  updateMainMenuAirplaneImage() {
    const imgElement = document.querySelector(".main-airplane-art");
    if (imgElement) {
      const planeToDisplay =
        this.selectedAirplane ||
        this.allPlanes.find((p) => p.tier === 1 && p.style === 1);
      if (planeToDisplay) {
        imgElement.src = planeToDisplay.image;
      }
    }
  }

  startMainMenuAnimation() {
    this.stopMainMenuAnimation();

    const airplaneEl = document.querySelector(".main-airplane-art");
    const container = document.getElementById("main-menu-animation-container");
    if (!airplaneEl || !container) return;

    const planeData =
      this.selectedAirplane ||
      this.allPlanes.find((p) => p.tier === 1 && p.style === 1);
    if (!planeData || !planeData.projectiles) return;

    const bulletVisuals = {
      blue: { filter: "saturate(3) hue-rotate(200deg)" },
      orange: { filter: "saturate(5) hue-rotate(15deg)" },
      red: { filter: "saturate(4) hue-rotate(320deg)" },
      purple: { filter: "saturate(3) hue-rotate(250deg)" },
    };
    const bulletSizeMap = { 1: 15, 2: 20, 3: 25, 5: 35 };

    this.mainMenuShootingInterval = setInterval(() => {
      const menuRect = container.parentElement.getBoundingClientRect();
      const airplaneRect = airplaneEl.getBoundingClientRect();
      const airplaneRelativeTop = airplaneRect.top - menuRect.top;
      const airplaneRelativeLeft = airplaneRect.left - menuRect.left;

      planeData.projectiles.forEach((proj) => {
        if (proj.type !== "bullet") return;
        const count = proj.count;
        for (let i = 0; i < count; i++) {
          let startX, startY;
          let angleDeg = -90;

          if (proj.from === "nose") {
            const offsetFromCenter = count > 1 ? (i - (count - 1) / 2) * 15 : 0;
            startX =
              airplaneRelativeLeft + airplaneRect.width / 2 + offsetFromCenter;
            startY = airplaneRelativeTop + airplaneRect.height * 0.1;
          } else {
            // wing
            const offsetRatio = proj.offset === "near" ? 0.3 : 0.1;
            const wing = i % 2 === 0 ? -1 : 1;
            startX =
              airplaneRelativeLeft +
              airplaneRect.width / 2 +
              wing * airplaneRect.width * offsetRatio;
            startY = airplaneRelativeTop + airplaneRect.height * 0.4;
          }

          if (proj.pattern === "angled" && count > 1) {
            const spread = 40;
            angleDeg = -90 - spread / 2 + i * (spread / (count - 1));
          }

          const visual = bulletVisuals[proj.color] || {};
          const size = bulletSizeMap[proj.size] || 20;

          const bullet = new Bullet(
            "./assets/images/bullets/lvl1.png",
            startX,
            startY,
            size,
            5,
            angleDeg,
            false,
            visual.filter
          );

          container.appendChild(bullet.element);
          this.mainMenuBullets.push(bullet);
        }
      });
    }, 800);
  }

  stopMainMenuAnimation() {
    clearInterval(this.mainMenuShootingInterval);
    this.mainMenuBullets.forEach((bullet) => bullet.remove());
    this.mainMenuBullets = [];
    const container = document.getElementById("main-menu-animation-container");
    if (container) container.innerHTML = "";
  }

  cancelSearch() {
    this.hideWaitingMessage();
    if (
      this.networkManager &&
      this.networkManager.socket &&
      this.networkManager.socket.readyState === WebSocket.OPEN
    ) {
      this.networkManager.socket.close();
    }
    document.querySelector(".footer-nav").style.display = "flex";
    if (window.menuManager) window.menuManager.showMenu("main-menu");

    if (window.musicManager) {
      window.musicManager.play("menu");
    }
  }

  getDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua))
      return "tablet";
    if (
      /Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(
        ua
      )
    )
      return "phone";
    return "pc";
  }

  showWaitingMessage(message) {
    const overlay = document.getElementById("waiting-overlay");
    const textElement = document.getElementById("waiting-message-text");
    const deviceType = this.getDeviceType();
    const imagePath = `assets/images/waiting/${deviceType}.png`;
    overlay.style.backgroundImage = `url('${imagePath}')`;
    textElement.textContent = message;

    document.querySelector(".footer-nav").style.display = "none";
    if (window.menuManager) window.menuManager.showMenu(null);

    overlay.classList.remove("hidden");

    if (window.musicManager) {
      window.musicManager.play("waiting");
    }
  }

  hideWaitingMessage() {
    document.getElementById("waiting-overlay").classList.add("hidden");
  }

  async fetchAllAssets() {
    try {
      let planes = await this.networkManager.apiRequest(
        "/api/game-data/airplanes"
      );
      this.allPlanes = planes.map((plane) => {
        const nameMatch = plane.name.match(/Tier (\d+) - Model (\d+)/);
        if (nameMatch) {
          plane.tier = parseInt(nameMatch[1]);
          plane.style = parseInt(nameMatch[2]);
          plane.id = `${plane.tier}_${plane.style}`;
        }
        return plane;
      });

      // <<<< دریافت اطلاعات همراهان >>>>
      this.allWingmen = await this.networkManager.apiRequest(
        "/api/game-data/wingmen"
      );
      // <<<< پایان >>>>
    } catch (e) {
      console.error("Failed to fetch all assets.", e);
      this.allPlanes = [];
      this.allWingmen = [];
    }
  }

  async initiateGameConnection() {
    try {
      const userData = JSON.parse(localStorage.getItem("userData"));
      if (!userData) throw new Error("اطلاعات کاربر یافت نشد.");

      if (!this.selectedAirplane) {
        this.selectedAirplane = this.allPlanes.find(
          (p) => p.tier === 1 && p.style === 1
        );
      }
      // اطمینان از وجود همراه پیش‌فرض
      if (!this.selectedWingman) {
        this.selectedWingman = this.allWingmen.find((w) => w.level === 1);
      }

      this.showWaitingMessage("در حال اتصال به سرور بازی...");
      this.networkManager.connect();
      this.networkManager.onGameStart = (gameData) => this.startGame(gameData);
      this.networkManager.onWaiting = (message) => {
        document.getElementById("waiting-message-text").textContent = message;
      };
      this.networkManager.onGameCancelled = (message) => {
        this.hideWaitingMessage();
        alert(message);
        document.querySelector(".footer-nav").style.display = "flex";
        if (window.menuManager) window.menuManager.showMenu("main-menu");
        if (window.musicManager) window.musicManager.play("menu");
      };

      await new Promise((resolve, reject) => {
        const checkConnection = () => {
          if (this.networkManager.connected) resolve();
          else if (
            this.networkManager.socket &&
            this.networkManager.socket.readyState === WebSocket.CLOSED
          ) {
            reject(new Error("اتصال به سرور برقرار نشد."));
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
      });

      this.networkManager.sendLogin(
        userData.username,
        this.selectedAirplane.image,
        this.selectedAirplane.name,
        "assets/images/bullets/lvl1.png",
        "Standard Bullet",
        window.innerWidth,
        window.innerHeight,
        this.selectedPotion ? this.selectedPotion._id : null,
        this.selectedAirplane.tier,
        this.selectedAirplane.style,
        this.selectedWingman // ارسال آبجکت کامل همراه
      );
    } catch (error) {
      console.error("Failed to start game:", error);
      alert("خطا در شروع بازی: " + error.message);
      this.hideWaitingMessage();
      document.querySelector(".footer-nav").style.display = "flex";
      if (window.menuManager) window.menuManager.showMenu("main-menu");
      if (window.musicManager) window.musicManager.play("menu");
    }
  }

  async startGame(gameData) {
    try {
      this.userData = JSON.parse(localStorage.getItem("userData"));
      if (!this.userData) throw new Error("User data not found.");

      this.hideWaitingMessage();

      const appContainer = document.querySelector(".app-container");
      if (appContainer) appContainer.classList.add("hidden-for-game");

      document.querySelector(".footer-nav").style.display = "none";
      if (window.menuManager) window.menuManager.showMenu(null);
      document.getElementById("game-container").classList.remove("hidden");

      if (window.musicManager) {
        window.musicManager.play("war");
      }

      this.scenes.war = new WarScene(
        CONFIG,
        this.networkManager,
        this.selectedAirplane,
        this.selectedBullet,
        this.selectedPotion,
        this.userData,
        gameData.health,
        gameData.opponentHealth,
        this.selectedWingman // <<<< ارسال همراه انتخاب شده به صحنه جنگ
      );

      await this.switchScene("war");
      if (this.currentScene && this.currentScene.setOpponent) {
        this.currentScene.setOpponent(gameData.opponent);
      }
    } catch (error) {
      console.error("Failed to start game:", error);
      alert("Failed to start game: " + error.message);
      document.querySelector(".footer-nav").style.display = "flex";
    }
  }

  cancelSearch() {
    this.hideWaitingMessage();
    if (
      this.networkManager &&
      this.networkManager.socket &&
      this.networkManager.socket.readyState === WebSocket.OPEN
    ) {
      this.networkManager.socket.close();
    }

    const appContainer = document.querySelector(".app-container");
    if (appContainer) appContainer.classList.remove("hidden-for-game");

    document.querySelector(".footer-nav").style.display = "flex";
    if (window.menuManager) window.menuManager.showMenu("main-menu");

    if (window.musicManager) {
      window.musicManager.play("menu");
    }
  }

  startUserDataSync() {
    if (this.userDataInterval) clearInterval(this.userDataInterval);
    const fetchAndSaveUserData = async () => {
      try {
        const userData = await this.networkManager.apiRequest("/api/user");
        localStorage.setItem("userData", JSON.stringify(userData));
        if (window.menuManager) window.menuManager.loadUserData();
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };
    fetchAndSaveUserData();
    this.userDataInterval = setInterval(fetchAndSaveUserData, 15000);
  }

  hideScreen(id) {
    const element = document.getElementById(id);
    if (element) element.classList.add("hidden");
  }

  showScreen(id) {
    const element = document.getElementById(id);
    if (element) {
      element.classList.remove("hidden");
    }
    if (window.menuManager && (id === "main-menu" || id === "login-screen")) {
      window.menuManager.showMenu(id);
    }
  }

  async switchScene(sceneName) {
    if (this.currentScene && this.currentScene.cleanup) {
      await this.currentScene.cleanup();
    }
    this.currentScene = this.scenes[sceneName];
    if (this.currentScene && this.currentScene.init) {
      await this.currentScene.init();
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.gameManager = new GameManager();
});
