import { CONFIG } from "./../config.js";
import { WarScene } from "./warScene.js";
import { NetworkManager } from "./network.js";

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
    this.init();
  }

  // در فایل js/script.js

  async init() {
    document
      .getElementById("cancel-search-container")
      .addEventListener("click", () => this.cancelSearch());

    await this.fetchAllAssets();

    // <<<< شروع بخش اصلاح‌شده >>>>
    const savedAirplaneData = JSON.parse(
      localStorage.getItem("selectedAirplane")
    );
    if (savedAirplaneData) {
      // به جای جستجو با id، از tier و style برای پیدا کردن هواپیمای صحیح استفاده می‌کنیم
      const correctAirplaneObject = this.allPlanes.find(
        (p) =>
          p.tier === savedAirplaneData.tier &&
          p.style === savedAirplaneData.style
      );

      if (correctAirplaneObject) {
        this.selectedAirplane = correctAirplaneObject;
        console.log(
          "Loaded selected airplane from localStorage and verified with master list."
        );
      }
    }
    // <<<< پایان بخش اصلاح‌شده >>>>

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
          this.hideScreen("login-screen");
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

  cancelSearch() {
    console.log("Search cancelled by user.");
    this.hideWaitingMessage();
    if (
      this.networkManager &&
      this.networkManager.socket &&
      this.networkManager.socket.readyState === WebSocket.OPEN
    ) {
      this.networkManager.socket.close();
    }
    this.showScreen("main-menu");
  }

  getDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return "tablet";
    }
    if (
      /Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(
        ua
      )
    ) {
      return "phone";
    }
    return "pc";
  }

  // در فایل js/script.js

  showWaitingMessage(message) {
    const overlay = document.getElementById("waiting-overlay");
    // const imgElement = document.getElementById('waiting-device-image'); // این خط حذف می‌شود
    const textElement = document.getElementById("waiting-message-text");

    const deviceType = this.getDeviceType();
    const imagePath = `assets/images/waiting/${deviceType}.png`;

    // به جای تنظیم src برای تگ <img>، تصویر را به عنوان background-image تنظیم می‌کنیم
    overlay.style.backgroundImage = `url('${imagePath}')`;
    textElement.textContent = message;

    this.hideScreen("main-menu");
    overlay.classList.remove("hidden");
  }

  hideWaitingMessage() {
    const overlay = document.getElementById("waiting-overlay");
    overlay.classList.add("hidden");
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

      const today = new Date().setHours(0, 0, 0, 0);
      const lastReset = new Date(userData.dailyPlay.lastReset).setHours(
        0,
        0,
        0,
        0
      );
      const dailyCount = lastReset < today ? 0 : userData.dailyPlay.count || 0;
      if (dailyCount >= 25) {
        alert("شما به سقف مجاز ۲۵ بازی روزانه خود رسیده‌اید.");
        return;
      }

      this.showWaitingMessage("در حال اتصال به سرور بازی...");
      this.networkManager.connect();

      this.networkManager.onGameStart = (gameData) => this.startGame(gameData);
      this.networkManager.onWaiting = (message) =>
        this.showWaitingMessage(message);
      this.networkManager.onGameCancelled = (message) => {
        this.hideWaitingMessage();
        alert(message);
        this.showScreen("main-menu");
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

      this.showWaitingMessage("در انتظار حریف...");
    } catch (error) {
      console.error("Failed to start game:", error);
      alert("خطا در شروع بازی: " + error.message);
      this.hideWaitingMessage();
      this.showScreen("main-menu");
    }
  }

  async startGame(gameData) {
    try {
      this.userData = JSON.parse(localStorage.getItem("userData"));
      if (!this.userData) throw new Error("User data not found.");

      this.hideWaitingMessage();
      this.showScreen("game-container");

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
    if (element) element.classList.remove("hidden");
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
