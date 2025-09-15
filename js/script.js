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
    this.userData = null; // اضافه کردن این خط
  }
  async init() {
    this.selectedAirplane = JSON.parse(
      localStorage.getItem("selectedAirplane")
    );
    this.selectedBullet = JSON.parse(localStorage.getItem("selectedBullet"));

    // بارگذاری معجون انتخاب شده
    try {
      const savedPotion = localStorage.getItem("selectedPotion");
      if (savedPotion && savedPotion !== "null") {
        this.selectedPotion = JSON.parse(savedPotion);
      } else {
        this.selectedPotion = null;
      }
    } catch (error) {
      console.error("Error loading selected potion:", error);
      this.selectedPotion = null;
    }
    const tgid = localStorage.getItem("tgid");

    if (tgid) {
      // Attempt to automatically log in with the stored tgid
      try {
        const userData = await this.networkManager.apiRequest("/api/user");
        if (userData && userData.username) {
          this.networkManager.userId = userData._id;
          this.username = userData.username;
          localStorage.setItem("userData", JSON.stringify(userData));

          this.hideScreen("login-screen");
          this.showScreen("main-menu");
          this.startUserDataSync();
          console.log("Auto-login successful. User:", userData.username);
        } else {
          // If user data is incomplete, fall back to the login screen
          this.showScreen("login-screen");
        }
      } catch (error) {
        // If API call fails (e.g., invalid tgid), fall back to the login screen
        console.error("Auto-login failed:", error);
        this.showScreen("login-screen");
      }
    } else {
      // If no tgid is found in localStorage, show the login screen
      this.showScreen("login-screen");
    }

    this.setupLoginListeners();
    this.setupMenuListeners();
  }

  setupMenuListeners() {
    document
      .getElementById("play-btn")
      .addEventListener("click", () => this.initiateGameConnection());
    document
      .getElementById("selection-btn")
      .addEventListener("click", () => this.showSelectionMenu()); // اضافه کردن این خط
  }

  async showSelectionMenu() {
    this.hideScreen("main-menu");
    this.showScreen("selection-menu");
    await this.fetchUserData();
    await this.displayOwnedAssets(); // تبدیل به async
  }

  async displayOwnedAssets() {
    await this.displayAirplanes();
    await this.displayBullets();
    await this.displayPotions();
  }

  async displayAirplanes() {
    const container = document.getElementById("airplane-selection-container");
    container.innerHTML = "";

    try {
      // دریافت اطلاعات هواپیماها از سرور
      const airplanesData = await this.networkManager
        .apiRequest("/api/assets/airplanes")
        .then((data) => {
          return data.map((e) => {
            const parts = e.name.split("-");
            e.tier = parseInt(parts[0].replace("Tier", "").trim());
            e.style = parseInt(parts[1].replace("Model", "").trim());
            return e;
          });
        });

      // فیلتر کردن هواپیماهای قابل دسترسی بر اساس tier کاربر
      const userTier = this.userData.airplaneTier || 1;
      const userStyle = this.userData.airplaneStyle || 1;

      const availableAirplanes = [];

      // اضافه کردن هواپیماهای tierهای پایین‌تر
      for (let tier = 1; tier <= userTier; tier++) {
        const tierAirplanes = airplanesData.filter((a) => a.tier === tier);

        // برای tier فعلی کاربر، فقط استایل‌های تا شماره userStyle را نمایش می‌دهیم
        if (tier === userTier) {
          tierAirplanes.forEach((airplane) => {
            if (airplane.style <= userStyle) {
              availableAirplanes.push(airplane);
            }
          });
        } else {
          // برای tierهای پایین‌تر، همه استایل‌ها را نمایش می‌دهیم
          availableAirplanes.push(...tierAirplanes);
        }
      }

      // نمایش هواپیماها
      if (availableAirplanes.length > 0) {
        availableAirplanes.forEach((airplane) => {
          const item = document.createElement("div");
          item.className = "selection-item";
          item.innerHTML = `<img src="${airplane.image}" alt="${airplane.name}"/><p>${airplane.name}</p>`;
          item.addEventListener("click", () => {
            document
              .querySelectorAll("#airplane-selection-container .selection-item")
              .forEach((el) => el.classList.remove("selected"));
            item.classList.add("selected");
            this.selectAsset("airplane", airplane, container);
          });
          container.appendChild(item);

          // انتخاب پیش‌فرض آخرین هواپیما
          if (airplane.tier === userTier && airplane.style === userStyle) {
            item.classList.add("selected");
            this.selectedAirplane = airplane;
            localStorage.setItem("selectedAirplane", JSON.stringify(airplane));
          }
        });
      } else {
        container.innerHTML =
          "<p style='color: #fff; text-align: center;'>هیچ هواپیمایی در دسترس نیست</p>";
      }
    } catch (error) {
      console.error("Failed to load airplanes:", error);
      container.innerHTML =
        "<p style='color: #fff; text-align: center;'>خطا در بارگذاری هواپیماها</p>";
    }
  }

  async displayBullets() {
    const container = document.getElementById("bullet-selection-container");
    container.innerHTML = "";

    try {
      // دریافت اطلاعات گلوله‌ها از سرور
      const bulletsData = await this.networkManager.apiRequest(
        "/api/assets/bullets"
      );

      // نمایش همه گلوله‌ها
      if (bulletsData && bulletsData.length > 0) {
        bulletsData.forEach((bullet) => {
          const item = document.createElement("div");
          item.className = "selection-item";
          item.innerHTML = `<img src="${bullet.image}" alt="${bullet.name}"/><p>${bullet.name}</p>`;
          item.addEventListener("click", () => {
            document
              .querySelectorAll("#bullet-selection-container .selection-item")
              .forEach((el) => el.classList.remove("selected"));
            item.classList.add("selected");
            this.selectAsset("bullet", bullet, container);
          });
          container.appendChild(item);

          // انتخاب پیش‌فرض اولین گلوله
          if (!this.selectedBullet && bulletsData.indexOf(bullet) === 0) {
            item.classList.add("selected");
            this.selectedBullet = bullet;
            localStorage.setItem("selectedBullet", JSON.stringify(bullet));
          }
        });
      } else {
        container.innerHTML =
          "<p style='color: #fff; text-align: center;'>هیچ گلوله‌ای در دسترس نیست</p>";
      }
    } catch (error) {
      console.error("Failed to load bullets:", error);
      container.innerHTML =
        "<p style='color: #fff; text-align: center;'>خطا در بارگذاری گلوله‌ها</p>";
    }
  }

  async displayPotions() {
    const container = document.getElementById("potion-selection-container");

    // ذخیره گزینه "هیچکدام" اگر وجود دارد
    let noneItem = container.querySelector('[data-potion-id="none"]');

    // فقط معجون‌های واقعی را پاک کنید، نه گزینه "هیچکدام" را
    const potionItems = container.querySelectorAll(
      '.selection-item:not([data-potion-id="none"])'
    );
    potionItems.forEach((item) => item.remove());

    // اگر گزینه "هیچکدام" وجود ندارد، آن را ایجاد کنید
    if (!noneItem) {
      noneItem = document.createElement("div");
      noneItem.className = "selection-item";
      noneItem.dataset.potionId = "none";
      noneItem.innerHTML = `
      <img src="assets/images/potions/none.png" alt="هیچکدام"/>
      <p>هیچکدام</p>
    `;
      noneItem.addEventListener("click", () => {
        this.selectPotion(null);
      });
      container.appendChild(noneItem);
    }

    // بررسی آیا کاربر معجونی دارد یا نه
    const hasPotions =
      this.userData &&
      this.userData.ownedPotions &&
      this.userData.ownedPotions.some((p) => p.quantity > 0);

    if (hasPotions) {
      try {
        // دریافت همه معجون‌ها از سرور
        const allPotions = await this.networkManager.apiRequest(
          "/api/potions/"
        );
        this.allPotions = allPotions;

        // نمایش معجون‌های موجود کاربر
        for (const ownedPotion of this.userData.ownedPotions) {
          if (ownedPotion.quantity > 0) {
            // پیدا کردن اطلاعات کامل معجون از لیست همه معجون‌ها
            const potionData = allPotions.find(
              (p) => p._id === ownedPotion.potion
            );

            if (potionData) {
              const item = document.createElement("div");
              item.className = "selection-item";
              item.dataset.potionId = ownedPotion.potion;
              item.innerHTML = `
              <img src="${potionData.imagePath || potionData.image}" alt="${
                potionData.name
              }" 
                   onerror="this.src='assets/images/potions/default.png'"/>
              <p>${potionData.name} (${ownedPotion.quantity})</p>
            `;

              item.addEventListener("click", () => {
                this.selectPotion({
                  _id: ownedPotion.potion,
                  ...potionData,
                });
              });

              container.appendChild(item);
            }
          }
        }
      } catch (error) {
        console.error("Error loading potions:", error);
      }
    }

    // بعد از بارگذاری، انتخاب قبلی را اعمال کنید
    this.applyPotionSelection();
  }

  // متد جدید برای اعمال انتخاب معجون
  applyPotionSelection() {
    const container = document.getElementById("potion-selection-container");
    if (!container) return;

    // حذف کلاس selected از همه آیتم‌ها
    container.querySelectorAll(".selection-item").forEach((el) => {
      el.classList.remove("selected");
    });

    // اعمال انتخاب بر اساس معجون انتخاب شده
    if (this.selectedPotion) {
      const selectedItem = container.querySelector(
        `[data-potion-id="${this.selectedPotion._id}"]`
      );
      if (selectedItem) {
        selectedItem.classList.add("selected");
      } else {
        // اگر معجون انتخاب شده موجود نیست، گزینه "هیچکدام" را انتخاب کن
        const noneItem = container.querySelector('[data-potion-id="none"]');
        if (noneItem) {
          noneItem.classList.add("selected");
          this.selectedPotion = null;
          localStorage.removeItem("selectedPotion");
        }
      }
    } else {
      // انتخاب گزینه "هیچکدام"
      const noneItem = container.querySelector('[data-potion-id="none"]');
      if (noneItem) {
        noneItem.classList.add("selected");
      }
    }
  }

  // متد selectPotion (اگر قبلا ندارید اضافه کنید)
  selectPotion(potion) {
    const container = document.getElementById("potion-selection-container");
    if (!container) return;

    // حذف کلاس selected از همه آیتم‌ها
    container.querySelectorAll(".selection-item").forEach((el) => {
      el.classList.remove("selected");
    });

    // اضافه کردن کلاس selected به آیتم انتخاب شده
    if (potion) {
      const selectedItem = container.querySelector(
        `[data-potion-id="${potion._id}"]`
      );
      if (selectedItem) {
        selectedItem.classList.add("selected");
      }
    } else {
      // انتخاب گزینه "هیچکدام"
      const noneItem = container.querySelector('[data-potion-id="none"]');
      if (noneItem) {
        noneItem.classList.add("selected");
      }
    }

    // ذخیره انتخاب
    this.selectedPotion = potion;
    if (potion) {
      localStorage.setItem("selectedPotion", JSON.stringify(potion));
    } else {
      localStorage.removeItem("selectedPotion");
    }

    console.log("Potion selected:", potion ? potion.name : "None");
  }

  async fetchUserData() {
    try {
      const userData = await this.networkManager.apiRequest("/api/user");
      if (userData) {
        this.userData = userData;
        localStorage.setItem("userData", JSON.stringify(userData));
        this.updateUserInfoUI();
        console.log("User data fetched:", this.userData);
      }
    } catch (error) {
      console.error("Failed to fetch user data:", error);
    }
  }
  updateUserInfoUI() {
    if (!this.userData) return;

    // به روزرسانی منوی اصلی
    const mainMenuStars = document.querySelector("#main-menu #user-stars");
    const mainMenuCoins = document.querySelector("#main-menu #user-coins");

    if (mainMenuStars) {
      mainMenuStars.textContent = `${this.userData.stars} ★`;
    }
    if (mainMenuCoins) {
      mainMenuCoins.textContent = `${this.userData.coins} سکه`;
    }

    // به روزرسانی منوی انتخاب دارایی
    const selectionMenuStars = document.querySelector(
      "#selection-menu #user-stars"
    );
    const selectionMenuCoins = document.querySelector(
      "#selection-menu #user-coins"
    );

    if (selectionMenuStars) {
      selectionMenuStars.textContent = `${this.userData.stars} ★`;
    }
    if (selectionMenuCoins) {
      selectionMenuCoins.textContent = `${this.userData.coins} سکه`;
    }

    console.log("User info updated:", this.userData.coins, "coins");
  }

  hideWaitingMessage() {
    const waitingDiv = document.getElementById("waiting-message");
    if (waitingDiv) waitingDiv.style.display = "none";
  }

  setupMenuListeners() {
    document
      .getElementById("play-btn")
      .addEventListener("click", () => this.initiateGameConnection());
    document
      .getElementById("selection-btn")
      .addEventListener("click", () => this.showSelectionMenu());

    // اضافه کردن event listener برای دکمه بازگشت
    document.querySelectorAll(".back-btn").forEach((btn) => {
      btn.addEventListener("click", () => this.showMainMenu());
    });
  }

  // اضافه کردن متد showMainMenu
  showMainMenu() {
    this.hideScreen("selection-menu");
    this.showScreen("main-menu");
  }

  setupLoginListeners() {
    document
      .getElementById("login-button")
      .addEventListener("click", () => this.handleLogin());
    document
      .getElementById("register-button")
      .addEventListener("click", () => this.showRegisterForm());
  }

  async handleLogin() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const tgid = document.getElementById("tgid").value;

    if (!username || !password || !tgid) {
      alert("لطفاً تمام فیلدها را پر کنید.");
      return;
    }

    localStorage.setItem("tgid", tgid);
    this.username = username;

    try {
      let result;
      if (this.isRegistering) {
        const confirmPassword =
          document.getElementById("confirm-password").value;
        if (password !== confirmPassword) {
          alert("رمزهای عبور مطابقت ندارند.");
          return;
        }

        result = await this.networkManager.register(username, password, tgid);

        alert("ثبت‌نام موفقیت‌آمیز بود! لطفاً وارد شوید.");
        this.isRegistering = false;
        document.getElementById("confirm-password").style.display = "none";
        document.getElementById("login-button").textContent = "ورود";
      } else {
        result = await this.networkManager.login(username, password, tgid);
        this.networkManager.userId = result._id;
        this.hideScreen("login-screen");
        this.showScreen("main-menu");
        this.startUserDataSync();
      }
    } catch (error) {
      alert(error.message || "خطا در هنگام ورود یا ثبت‌نام");
    }
  }

  startUserDataSync() {
    if (this.userDataInterval) {
      clearInterval(this.userDataInterval);
    }
    const fetchAndSaveUserData = async () => {
      try {
        const userData = await this.networkManager.apiRequest("/api/user");
        localStorage.setItem("userData", JSON.stringify(userData));

        if (window.menuManager) {
          window.menuManager.loadUserData();
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };
    fetchAndSaveUserData();
    this.userDataInterval = setInterval(fetchAndSaveUserData, 15000);
  }

  showRegisterForm() {
    this.isRegistering = true;
    document.getElementById("confirm-password").style.display = "block";
    document.getElementById("login-button").textContent = "تکمیل ثبت‌نام";
  }

  async initiateGameConnection() {
    try {
      this.showWaitingMessage("در حال اتصال به سرور بازی...");
      this.networkManager.connect();
      this.networkManager.onGameStart = (opponent) => this.startGame(opponent);
      this.networkManager.onWaiting = (message) =>
        this.showWaitingMessage(message);

      await new Promise((resolve, reject) => {
        const checkConnection = () => {
          if (this.networkManager.connected) {
            resolve();
          } else if (
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

      const userData = JSON.parse(localStorage.getItem("userData"));
      this.networkManager.sendLogin(
        userData.username,
        "assets/images/airplanes/Tier 1/1.png",
        "F-16",
        "assets/images/bullets/lvl1.png",
        "Standard",
        window.innerWidth,
        window.innerHeight,
        this.selectedPotion ? this.selectedPotion.potion : null
      );
      this.showWaitingMessage("در انتظار حریف...");
    } catch (error) {
      console.error("Failed to start game:", error);
      alert("خطا در شروع بازی: " + error.message);
      this.hideWaitingMessage();
    }
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
      this.hideWaitingMessage();
      this.hideScreen("main-menu");
      this.showScreen("game-container");

      const playerAssets = {
        airplane:
          this.selectedAirplane?.image ||
          "assets/images/airplanes/Tier 1/1.png",
        bullets: this.selectedBullet?.image || "assets/images/bullets/lvl1.png",
      };

      this.scenes.war = new WarScene(
        CONFIG,
        this.networkManager,
        playerAssets,
        this.selectedPotion
      );

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

document.addEventListener("DOMContentLoaded", () => {
  window.gameManager = new GameManager();
  window.gameManager.init();
});
