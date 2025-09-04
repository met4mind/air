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
  }

  async init() {
    this.hideScreen("asset-selection");
    this.hideScreen("main-menu");
    this.setupLoginListeners();
  }

  setupNetwork() {
    this.networkManager.onGameStart = (opponent) => {
      this.hideLoginScreen();
      this.startGame(opponent);
    };

    this.networkManager.onWaiting = (message) => {
      this.showWaitingMessage(message);
    };
  }

  setupLoginListeners() {
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
    const tgid = document.getElementById("tgid").value;
    localStorage.setItem("tgid", tgid);

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

        await this.networkManager.register(
          username,
          password,
          confirmPassword,
          tgid
        );
        this.hideScreen("login-screen");
        this.showScreen("main-menu");
        this.startUserDataSync(); // شروع سینک بعد از ثبت نام
      } else {
        const result = await this.networkManager.login(
          username,
          password,
          tgid
        );
        this.networkManager.userId = result._id;
        this.hideScreen("login-screen");
        this.showScreen("main-menu");
        this.startUserDataSync(); // شروع سینک بعد از لاگین
      }
    } catch (error) {
      alert(error.message || "An error occurred during login");
    }
  }

  startUserDataSync() {
    // متوقف کردن interval قبلی اگر وجود داشت
    if (this.userDataInterval) {
      clearInterval(this.userDataInterval);
    }

    const fetchAndSaveUserData = async () => {
      try {
        const userData = await this.networkManager.apiRequest("/api/user");

        // Save individual properties
        Object.keys(userData).forEach((key) => {
          localStorage.setItem(`user_${key}`, JSON.stringify(userData[key]));
        });

        // Save complete object
        localStorage.setItem("userData", JSON.stringify(userData));

        console.log("User data updated:", userData);
        return userData;
      } catch (error) {
        console.error("Error fetching user data:", error);
        const cachedData = localStorage.getItem("userData");
        if (cachedData) {
          return JSON.parse(cachedData);
        }
        throw error;
      }
    };

    // اجرای فوری اولین بار
    fetchAndSaveUserData();

    // تنظیم interval برای هر یک دقیقه
    this.userDataInterval = setInterval(fetchAndSaveUserData, 5000);
  }

  showRegisterForm() {
    this.isRegistering = true;
    document.getElementById("confirm-password").style.display = "block";
    document.getElementById("login-button").textContent = "Register";
  }

  async loadAssets() {
    try {
      await this.networkManager.connect();
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
      this.networkManager.sendLogin(
        this.username,
        selectedAirplane.value,
        selectedAirplane.dataset.name,
        selectedBullet.value,
        selectedBullet.dataset.name,
        window.innerWidth,
        window.innerHeight
      );
      this.showWaitingMessage("Waiting for an opponent...");
    } catch (error) {
      alert("Failed to start game: " + error.message);
    }
  }

  hideScreen(id) {
    document.getElementById(id).classList.add("hidden");
  }

  showScreen(id) {
    document.getElementById(id).classList.remove("hidden");
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

  async startGame(opponent) {
    try {
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

      this.scenes.war = new WarScene(CONFIG, this.networkManager, playerAssets);
      await this.switchScene("war");

      if (this.currentScene && this.currentScene.setOpponent) {
        this.currentScene.setOpponent(opponent);
      }
    } catch (error) {
      console.error("Failed to start game:", error);
      alert("Failed to start game: " + error.message);
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

// شروع بازی وقتی DOM کاملاً لود شد
document.addEventListener("DOMContentLoaded", () => {
  const game = new GameManager();
  game.init();
});
