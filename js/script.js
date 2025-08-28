import { CONFIG } from "./../config.js";
import { WarScene } from "./warScene.js";
import { NetworkManager } from "./network.js";

class GameManager {
  constructor() {
    this.currentScene = null;
    this.scenes = {
      war: null,
    };
    this.networkManager = new NetworkManager();
    this.isRegistering = false;
    this.username = "";
  }

  async init() {
    // راه‌اندازی event listeners برای صفحه لاگین
    this.setupLoginListeners();
  }

  setupNetwork() {
    // تنظیم event handlers برای network manager
    this.networkManager.onGameStart = (opponent) => {
      console.log("Game starting with opponent:", opponent);
      this.hideLoginScreen();
      this.startGame(opponent);
    };

    this.networkManager.onWaiting = (message) => {
      console.log("Waiting message:", message);
      this.showWaitingMessage(message);
    };
  }

  setupLoginListeners() {
    // تنظیم event listeners برای دکمه‌های لاگین/ثبت نام
    document
      .getElementById("login-button")
      .addEventListener("click", () => this.handleLogin());
    document
      .getElementById("register-button")
      .addEventListener("click", () => this.showRegisterForm());
    document
      .getElementById("start-game-button")
      .addEventListener("click", () => this.startGameWithSelections());
  }

  async handleLogin() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    if (!username || !password) {
      alert("Please enter both username and password");
      return;
    }

    this.username = username;

    try {
      if (this.isRegistering) {
        const confirmPassword =
          document.getElementById("confirm-password").value;
        if (password !== confirmPassword) {
          alert("Passwords do not match");
          return;
        }

        await this.networkManager.register(username, password, confirmPassword);
        await this.loadAssets();
      } else {
        const result = await this.networkManager.login(username, password);
        this.networkManager.userId = result.user._id;
        await this.loadAssets();
      }
    } catch (error) {
      alert(error.message || "An error occurred during login");
    }
  }

  showRegisterForm() {
    this.isRegistering = true;
    document.getElementById("confirm-password").style.display = "block";
    document.getElementById("login-button").textContent = "Register";
  }

  async loadAssets() {
    try {
      // ابتدا به WebSocket متصل شو
      await this.networkManager.connect();

      // سپس event handlers را تنظیم کن
      this.setupNetwork();

      const airplanes = await this.networkManager.getAirplanes();
      const bullets = await this.networkManager.getBullets();

      this.displayAssets(airplanes, bullets);

      document.getElementById("login-form").style.display = "none";
      document.getElementById("asset-selection").style.display = "block";
    } catch (error) {
      alert("Failed to load assets: " + error.message);
    }
  }

  displayAssets(airplanes, bullets) {
    const airplaneList = document.getElementById("airplane-list");
    airplaneList.innerHTML = "";

    if (airplanes.length === 0) {
      airplaneList.innerHTML = "<p>No airplanes available</p>";
    } else {
      airplanes.forEach((airplane) => {
        const div = document.createElement("div");
        div.className = "asset-item";
        div.innerHTML = `
          <input type="radio" name="airplane" value="${airplane.image}" id="airplane-${airplane.id}" data-name="${airplane.name}">
          <label for="airplane-${airplane.id}">
            <img src="./${airplane.image}" alt="${airplane.name}" onerror="this.style.display='none'">
            ${airplane.name}
          </label>
        `;
        airplaneList.appendChild(div);
      });
    }

    const bulletList = document.getElementById("bullet-list");
    bulletList.innerHTML = "";

    if (bullets.length === 0) {
      bulletList.innerHTML = "<p>No bullets available</p>";
    } else {
      bullets.forEach((bullet) => {
        const div = document.createElement("div");
        div.className = "asset-item";
        div.innerHTML = `
          <input type="radio" name="bullet" value="${bullet.image}" id="bullet-${bullet.id}" data-name="${bullet.name}">
          <label for="bullet-${bullet.id}">
            <img src="./${bullet.image}" alt="${bullet.name}" onerror="this.style.display='none'">
            ${bullet.name}
          </label>
        `;
        bulletList.appendChild(div);
      });
    }

    // به طور پیش فرض اولین آیتم را انتخاب کن
    const firstAirplane = document.querySelector('input[name="airplane"]');
    const firstBullet = document.querySelector('input[name="bullet"]');

    if (firstAirplane) firstAirplane.checked = true;
    if (firstBullet) firstBullet.checked = true;
  }

  async startGameWithSelections() {
    const selectedAirplane = document.querySelector(
      'input[name="airplane"]:checked'
    );
    const selectedBullet = document.querySelector(
      'input[name="bullet"]:checked'
    );

    if (!selectedAirplane || !selectedBullet) {
      alert("Please select both an airplane and bullets");
      return;
    }

    try {
      this.showWaitingMessage("Connecting to game server...");

      // اطلاعات را به سرور ارسال کن
      this.networkManager.sendLogin(
        this.username,
        selectedAirplane.value,
        selectedAirplane.dataset.name,
        selectedBullet.value,
        selectedBullet.dataset.name
      );

      // منتظر بمان تا بازی شروع شود
      this.showWaitingMessage("Waiting for an opponent...");
    } catch (error) {
      alert("Failed to start game: " + error.message);
    }
  }

  hideLoginScreen() {
    document.getElementById("login-screen").style.display = "none";
    const waitingDiv = document.getElementById("waiting-message");
    if (waitingDiv) waitingDiv.style.display = "none";
  }

  showWaitingMessage(message) {
    let waitingDiv = document.getElementById("waiting-message");

    if (!waitingDiv) {
      waitingDiv = document.createElement("div");
      waitingDiv.id = "waiting-message";
      waitingDiv.style.position = "fixed";
      waitingDiv.style.top = "50%";
      waitingDiv.style.left = "50%";
      waitingDiv.style.transform = "translate(-50%, -50%)";
      waitingDiv.style.background = "rgba(0,0,0,0.8)";
      waitingDiv.style.color = "white";
      waitingDiv.style.padding = "20px";
      waitingDiv.style.borderRadius = "8px";
      waitingDiv.style.zIndex = "101";
      waitingDiv.style.textAlign = "center";
      document.body.appendChild(waitingDiv);
    }

    waitingDiv.innerHTML = `<p>${message}</p>`;
    waitingDiv.style.display = "block";
  }

  // در تابع startGame تغییرات زیر را اعمال کنید:
  async startGame(opponent) {
    console.log("Starting game with opponent:", opponent);

    try {
      // دریافت اطلاعات انتخاب کاربر
      const selectedAirplane = document.querySelector(
        'input[name="airplane"]:checked'
      );
      const selectedBullet = document.querySelector(
        'input[name="bullet"]:checked'
      );

      const playerAssets = {
        airplane: selectedAirplane?.value,
        bullets: selectedBullet?.value,
        airplaneName: selectedAirplane?.dataset.name,
        bulletName: selectedBullet?.dataset.name,
      };

      this.networkManager.onHealthUpdate = (health, opponentHealth) => {
        if (this.currentScene && this.currentScene.setHealth) {
          this.currentScene.setHealth(health, opponentHealth);
        }
      };
      // ایجاد صحنه جنگ با اطلاعات انتخاب کاربر
      this.scenes.war = new WarScene(CONFIG, this.networkManager, playerAssets);

      // شروع با صحنه جنگ
      await this.switchScene("war");

      // انتقال اطلاعات حریف به صحنه جنگ
      if (this.currentScene && this.currentScene.setOpponent) {
        this.currentScene.setOpponent(opponent);
      }
    } catch (error) {
      console.error("Failed to start game:", error);
      alert("Failed to start game: " + error.message);
    }
  }

  async switchScene(sceneName) {
    // تمیز کردن صحنه فعلی
    if (this.currentScene && this.currentScene.cleanup) {
      await this.currentScene.cleanup();
    }

    // تنظیم صحنه جدید
    this.currentScene = this.scenes[sceneName];

    // راه‌اندازی صحنه جدید
    if (this.currentScene && this.currentScene.init) {
      await this.currentScene.init();
    }
  }
}

// شروع بازی وقتی DOM کاملاً لود شد
document.addEventListener("DOMContentLoaded", () => {
  const game = new GameManager();
  game.init();
});
