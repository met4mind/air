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
    this.userData = null;
    this.allPlanes = [];
    this.mainMenuShootingInterval = null;
    this.mainMenuBullets = [];
    this.init();
  }

  async init() {
    document
      .getElementById("cancel-search-container")
      .addEventListener("click", () => this.cancelSearch());

    await this.fetchAllAssets();

    const savedAirplaneData = JSON.parse(
      localStorage.getItem("selectedAirplane")
    );
    if (savedAirplaneData) {
      const correctAirplaneObject = this.allPlanes.find(
        (p) =>
          p.tier === savedAirplaneData.tier &&
          p.style === savedAirplaneData.style
      );
      if (correctAirplaneObject) {
        this.selectedAirplane = correctAirplaneObject;
      }
    }

    this.updateMainMenuAirplaneImage();

    try {
      const savedPotion = localStorage.getItem("selectedPotion");
      this.selectedPotion =
        savedPotion && savedPotion !== "null" ? JSON.parse(savedPotion) : null;
    } catch (error) {
      this.selectedPotion = null;
    }

    const tgid = localStorage.getItem("tgid");
    if (tgid) {
      this.networkManager.setTgid(tgid);
      try {
        const userData = await this.networkManager.apiRequest("/api/user");
        if (userData && userData.username) {
          this.networkManager.userId = userData._id;
          this.username = userData.username;
          this.userData = userData;
          localStorage.setItem("userData", JSON.stringify(userData));
          this.showScreen("main-menu");
          this.startUserDataSync();
        } else {
          this.showScreen("login-screen");
        }
      } catch (error) {
        this.showScreen("login-screen");
      }
    } else {
      this.showScreen("login-screen");
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

  // **تابع showWaitingMessage با کد اصلاح شده**
  showWaitingMessage(message) {
    const overlay = document.getElementById("waiting-overlay");
    const textElement = document.getElementById("waiting-message-text");

    // **اصلاح اصلی: این سه خط کد برای نمایش عکس بازگردانده شد**
    const deviceType = this.getDeviceType();
    const imagePath = `assets/images/waiting/${deviceType}.png`;
    overlay.style.backgroundImage = `url('${imagePath}')`;

    textElement.textContent = message;

    document.querySelector(".footer-nav").style.display = "none";
    if (window.menuManager) window.menuManager.showMenu(null);

    overlay.classList.remove("hidden");
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
    } catch (e) {
      console.error("Failed to fetch all airplanes list.", e);
      this.allPlanes = [];
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
        if (!this.selectedAirplane) {
          alert("خطا: اطلاعات هواپیمای پیش‌فرض یافت نشد!");
          return;
        }
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
        this.selectedAirplane.style
      );
    } catch (error) {
      console.error("Failed to start game:", error);
      alert("خطا در شروع بازی: " + error.message);
      this.hideWaitingMessage();
      document.querySelector(".footer-nav").style.display = "flex";
      if (window.menuManager) window.menuManager.showMenu("main-menu");
    }
  }

  async startGame(gameData) {
    try {
      this.userData = JSON.parse(localStorage.getItem("userData"));
      if (!this.userData) throw new Error("User data not found.");

      this.hideWaitingMessage();

      document.querySelector(".footer-nav").style.display = "none";
      if (window.menuManager) window.menuManager.showMenu(null);
      document.getElementById("game-container").classList.remove("hidden");

      this.scenes.war = new WarScene(
        CONFIG,
        this.networkManager,
        this.selectedAirplane,
        this.selectedBullet,
        this.selectedPotion,
        this.userData,
        gameData.health,
        gameData.opponentHealth
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
    // This function is now simplified, as footer logic is handled elsewhere.
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
