const BASEURL = "http://localhost:3000";

class MenuManager {
  // در فایل js/menu.js -> داخل کلاس MenuManager
  constructor() {
    this.currentMenu = "main-menu";
    this.userData = null;
    this.allPotions = [];
    this.leaderboardTimer = null; // <<<< این خط جدید را اضافه کنید
    this.init();
  }

  async init() {
    await this.loadMasterData();
    this.bindEvents();
    this.loadUserData();
    this.startDataSync();
  }

  async exchangeStars() {
    const input = document.getElementById("stars-to-exchange-input");
    const starsToSpend = parseInt(input.value, 10);

    if (isNaN(starsToSpend) || starsToSpend <= 0) {
      this.showNotification("لطفاً یک عدد معتبر وارد کنید", "error");
      return;
    }

    try {
      const result = await this.apiRequest("/api/shop/exchange-stars", {
        method: "POST",
        body: JSON.stringify({ starsToSpend }),
      });

      this.showNotification(
        `${starsToSpend} ستاره با موفقیت به سکه تبدیل شد`,
        "success"
      );

      // آپدیت اطلاعات کاربر
      this.userData.coins = result.coins;
      this.userData.stars = result.stars;
      localStorage.setItem("userData", JSON.stringify(this.userData));
      this.updateUI();
      input.value = "";
    } catch (error) {
      const errorData = await error.response.json();
      this.showNotification(errorData.error || "خطا در هنگام تبدیل", "error");
    }
  }
  async loadMasterData() {
    try {
      // لیست تمام معجون ها را یکبار در ابتدای کار می گیریم و ذخیره می کنیم
      this.allPotions = await this.apiRequest(`/api/potions`);
    } catch (error) {
      console.error("Failed to load master potion data:", error);
      this.allPotions = []; // در صورت خطا، یک آرایه خالی قرار می دهیم تا برنامه کرش نکند
    }
  }

  // js/menu.js -> MenuManager
  bindEvents() {
    // Event listeners for main menu buttons
    document
      .getElementById("play-btn")
      .addEventListener("click", () =>
        window.gameManager.initiateGameConnection()
      );
    document
      .getElementById("leaderboard-btn")
      .addEventListener("click", () => this.showLeaderboard());
    document
      .getElementById("shop-btn")
      .addEventListener("click", () => this.showShopMenu());
    document
      .getElementById("upgrade-btn")
      .addEventListener("click", () => this.showUpgradeMenu());
    document
      .getElementById("free-coins-btn")
      .addEventListener("click", () => this.showMenu("free-coins-menu"));

    // <<<< این خط جدید، مشکل اصلی را حل می‌کند >>>>
    document
      .getElementById("selection-btn")
      .addEventListener("click", () => this.showSelectionMenu());

    // Event listener for ALL back buttons
    document.querySelectorAll(".back-btn").forEach((btn) => {
      btn.addEventListener("click", () => this.showMenu("main-menu"));
    });

    // در فایل frontend/js/menu.js -> متد bindEvents

    // ... (بعد از event listener دکمه‌های بازگشت)
    document.querySelectorAll(".leaderboard-tabs .tab-btn").forEach((tab) => {
      tab.addEventListener("click", (e) => this.switchLeaderboardTab(e.target));
    });

    // Event listeners for shop tabs
    document.querySelectorAll(".shop-tabs .tab-btn").forEach((tab) => {
      tab.addEventListener("click", (e) => this.switchShopTab(e.target));
    });

    document
      .getElementById("exchange-stars-btn")
      .addEventListener("click", () => this.exchangeStars());
  }
  // در فایل js/menu.js -> داخل کلاس MenuManager

  // در فایل js/menu.js -> داخل کلاس MenuManager

  async switchLeaderboardTab(clickedTab) {
    // حذف کلاس active از همه تب‌ها
    document.querySelectorAll(".leaderboard-tabs .tab-btn").forEach((tab) => {
      tab.classList.remove("active");
    });
    // اضافه کردن کلاس active به تب کلیک‌شده
    clickedTab.classList.add("active");

    const type = clickedTab.dataset.type;
    await this.loadLeaderboard(type);
  }
  async showSelectionMenu() {
    this.showMenu("selection-menu");

    const airplaneContainer = document.getElementById(
      "airplane-selection-container"
    );
    const bulletContainer = document.getElementById(
      "bullet-selection-container"
    );
    const potionContainer = document.getElementById(
      "potion-selection-container"
    );

    if (!airplaneContainer || !bulletContainer || !potionContainer) return;

    airplaneContainer.innerHTML =
      '<p class="loading-text">در حال بارگذاری...</p>';
    bulletContainer.innerHTML =
      '<p class="loading-text">در حال بارگذاری...</p>';
    potionContainer.innerHTML =
      '<p class="loading-text">در حال بارگذاری...</p>';

    try {
      const [userData, allPlanes, allBullets, allPotions] = await Promise.all([
        this.apiRequest("/api/user"),
        this.apiRequest("/api/assets/airplanes"),
        this.apiRequest("/api/assets/bullets"),
        this.apiRequest("/api/potions"),
      ]);

      this.userData = userData;

      // ---- نمایش هواپیماها ----
      airplaneContainer.innerHTML = "";
      const userTier = userData.airplaneTier || 1;
      const availablePlanes = allPlanes.filter((plane) => {
        const planeTierMatch = plane.name.match(/Tier (\d+)/);
        return planeTierMatch && parseInt(planeTierMatch[1]) <= userTier;
      });
      availablePlanes.forEach((plane) =>
        airplaneContainer.appendChild(this.createSelectItem(plane, "airplane"))
      );

      // ---- نمایش گلوله‌ها ----
      bulletContainer.innerHTML = "";
      allBullets.forEach((bullet) =>
        bulletContainer.appendChild(this.createSelectItem(bullet, "bullet"))
      );

      // ---- نمایش معجون‌ها ----
      potionContainer.innerHTML = "";
      const nonePotion = {
        id: "none",
        name: "هیچکدام",
        image: "assets/images/potions/none.png",
      };
      potionContainer.appendChild(this.createSelectItem(nonePotion, "potion"));
      if (userData.ownedPotions) {
        userData.ownedPotions.forEach((owned) => {
          const potionInfo = allPotions.find((p) => p._id === owned.potion);
          if (potionInfo && owned.quantity > 0) {
            potionInfo.displayName = `${potionInfo.name} (x${owned.quantity})`;
            potionContainer.appendChild(
              this.createSelectItem(potionInfo, "potion")
            );
          }
        });
      }

      // <<<< اعمال انتخاب‌های ذخیره شده >>>>
      this.applySavedSelections({ allBullets, allPotions });
    } catch (error) {
      console.error("Failed to load equipment:", error);
      // ... (بخش مدیریت خطا)
    }
  }

  // <<<< این تابع کمکی جدید را هم به کلاس MenuManager اضافه کنید >>>>
  // در فایل js/menu.js -> داخل کلاس MenuManager

  applySavedSelections({ allBullets, allPotions }) {
    if (!window.gameManager) return;

    // --- ۱. اعمال انتخاب برای هواپیما ---
    const airplaneContainer = document.getElementById(
      "airplane-selection-container"
    );
    // <<<< حل مشکل اول: همیشه قبل از انتخاب، همه گزینه‌ها را از حالت انتخاب خارج کن >>>>
    airplaneContainer
      .querySelectorAll(".selection-item")
      .forEach((el) => el.classList.remove("selected"));

    const savedAirplane = JSON.parse(localStorage.getItem("selectedAirplane"));
    if (savedAirplane) {
      const itemElement = airplaneContainer.querySelector(
        `.selection-item[data-asset-id="${savedAirplane.id}"]`
      );
      if (itemElement) {
        itemElement.classList.add("selected");
        window.gameManager.selectedAirplane = savedAirplane;
      }
    }

    // --- ۲. اعمال انتخاب برای گلوله (با انتخاب پیش‌فرض) ---
    const bulletContainer = document.getElementById(
      "bullet-selection-container"
    );
    bulletContainer
      .querySelectorAll(".selection-item")
      .forEach((el) => el.classList.remove("selected"));

    let savedBullet = JSON.parse(localStorage.getItem("selectedBullet"));
    let selectedBulletElement = savedBullet
      ? bulletContainer.querySelector(
          `.selection-item[data-asset-id="${savedBullet.id}"]`
        )
      : null;

    // <<<< حل مشکل دوم: اگر هیچ گلوله‌ای انتخاب نشده بود، اولین گزینه را به عنوان پیش‌فرض انتخاب کن >>>>
    if (!selectedBulletElement && allBullets.length > 0) {
      selectedBulletElement = bulletContainer.querySelector(".selection-item"); // اولین آیتم
      const defaultBullet = allBullets.find(
        (b) => b.id == selectedBulletElement.dataset.assetId
      );
      if (defaultBullet) {
        savedBullet = defaultBullet;
        localStorage.setItem("selectedBullet", JSON.stringify(defaultBullet));
      }
    }

    if (selectedBulletElement) {
      selectedBulletElement.classList.add("selected");
      window.gameManager.selectedBullet = savedBullet;
    }

    // --- ۳. اعمال انتخاب برای معجون (با پیش‌فرض "هیچکدام") ---
    const potionContainer = document.getElementById(
      "potion-selection-container"
    );
    potionContainer
      .querySelectorAll(".selection-item")
      .forEach((el) => el.classList.remove("selected"));

    let savedPotion = JSON.parse(localStorage.getItem("selectedPotion"));
    let selectedPotionElement = savedPotion
      ? potionContainer.querySelector(
          `.selection-item[data-asset-id="${savedPotion._id}"]`
        )
      : null;

    if (!selectedPotionElement) {
      selectedPotionElement = potionContainer.querySelector(
        '.selection-item[data-asset-id="none"]'
      );
      savedPotion = null;
      localStorage.setItem("selectedPotion", JSON.stringify(null));
    }

    if (selectedPotionElement) {
      selectedPotionElement.classList.add("selected");
      window.gameManager.selectedPotion = savedPotion;
    }
  }

  // <<<< این یک متد کمکی جدید است، آن را هم به کلاس MenuManager اضافه کنید >>>>
  // در فایل js/menu.js -> داخل کلاس MenuManager
  createSelectItem(asset, type) {
    const item = document.createElement("div");
    item.className = "selection-item";
    const assetId = asset._id || asset.id; // شناسه منحصر به فرد
    item.dataset.assetId = assetId;

    const imageSrc = asset.imagePath || asset.image;

    item.innerHTML = `
        <img src="${imageSrc}" alt="${asset.name}">
        <p>${asset.displayName || asset.name}</p>
    `;

    item.addEventListener("click", () => {
      document
        .querySelectorAll(`#${type}-selection-container .selection-item`)
        .forEach((el) => el.classList.remove("selected"));
      item.classList.add("selected");

      if (window.gameManager) {
        // <<<< بخش جدید برای ذخیره در localStorage >>>>
        const key = `selected${type.charAt(0).toUpperCase() + type.slice(1)}`; // مثلا: selectedAirplane
        const valueToStore = asset.id === "none" ? null : asset;

        window.gameManager[key] = valueToStore;
        localStorage.setItem(key, JSON.stringify(valueToStore)); // ذخیره کل آبجکت
        console.log(`Saved ${key}:`, valueToStore);
      }
    });
    return item;
  }

  // در تابع loadUserData
  loadUserData() {
    try {
      const savedData = localStorage.getItem("userData");
      if (savedData) {
        this.userData = JSON.parse(savedData);
        this.updateUI();

        // بارگذاری معجون انتخاب شده از localStorage
        const savedPotion = localStorage.getItem("selectedPotion");
        if (savedPotion && savedPotion !== "null") {
          try {
            window.gameManager.selectedPotion = JSON.parse(savedPotion);
            this.selectedPotion = window.gameManager.selectedPotion;
          } catch (error) {
            console.error("Error parsing selected potion:", error);
            window.gameManager.selectedPotion = null;
            this.selectedPotion = null;
          }
        } else {
          window.gameManager.selectedPotion = null;
          this.selectedPotion = null;
        }
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  }

  startDataSync() {
    setInterval(() => {
      this.loadUserData();
    }, 5000);
  }

  updateUI() {
    if (!this.userData) return;

    // به روزرسانی منوی اصلی
    const mainMenuStars = document.querySelector("#main-menu #user-stars");
    const mainMenuCoins = document.querySelector("#main-menu #user-coins");

    if (mainMenuStars) {
      mainMenuStars.textContent = `${this.userData.stars} ★`;
    }
    if (mainMenuCoins) {
      mainMenuCoins.textContent = `${this.userData.coins} ⛁`;
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
      selectionMenuCoins.textContent = `${this.userData.coins} ⛁`;
    }
  }

  displayOwnedPotions() {
    const container = document.getElementById("potion-selection-container");
    container.innerHTML = "";

    if (
      this.userData &&
      this.userData.ownedPotions &&
      this.userData.ownedPotions.length > 0
    ) {
      this.userData.ownedPotions.forEach((p) => {
        const potionInfo = this.allPotions.find((ap) => ap._id === p.potion);
        if (potionInfo && p.quantity > 0) {
          const potionEl = document.createElement("div");
          potionEl.className = "selection-item owned-potion-item";
          potionEl.dataset.potionId = p.potion;
          potionEl.innerHTML = `
          <img src="${potionInfo.imagePath}" alt="${potionInfo.name}">
          <p>${potionInfo.name} (x${p.quantity})</p>
        `;

          potionEl.addEventListener("click", () => {
            document
              .querySelectorAll(".selection-item")
              .forEach((el) => el.classList.remove("selected"));
            potionEl.classList.add("selected");
            this.selectedPotion = {
              potion: p.potion,
              ...potionInfo,
            };
            window.gameManager.selectedPotion = this.selectedPotion;
          });
          container.appendChild(potionEl);
        }
      });
    } else {
      const noPotionMessage = document.createElement("p");
      noPotionMessage.textContent = "معجونی در اختیار ندارید";
      noPotionMessage.style.color = "#fff";
      noPotionMessage.style.textAlign = "center";
      noPotionMessage.style.marginTop = "10px";
      container.appendChild(noPotionMessage);
    }
  }

  displayOwnedAirplanes() {
    const container = document.getElementById("owned-airplane-list");
    const selectionContainer = document.getElementById(
      "airplane-selection-container"
    );
    container.innerHTML = "";

    if (
      this.userData &&
      this.userData.ownedAirplanes &&
      this.userData.ownedAirplanes.length > 0
    ) {
      selectionContainer.classList.remove("hidden");
      this.userData.ownedAirplanes.forEach((a) => {
        const airplaneInfo = this.allAirplanes.find(
          (ap) => ap._id === a.airplane
        );
        if (airplaneInfo && a.quantity > 0) {
          const airplaneEl = document.createElement("div");
          airplaneEl.className = "owned-airplane-item owned-asset-item";
          airplaneEl.dataset.airplaneId = a.airplane;
          airplaneEl.innerHTML = `<img src="${airplaneInfo.imagePath}" alt="${airplaneInfo.name}" title="${airplaneInfo.name} (x${a.quantity})">`;

          airplaneEl.addEventListener("click", () => {
            document
              .querySelectorAll(".owned-airplane-item")
              .forEach((el) => el.classList.remove("selected"));
            airplaneEl.classList.add("selected");
            this.selectedAirplane = {
              airplane: a.airplane,
              ...airplaneInfo,
            };
            window.gameManager.selectedAirplane = this.selectedAirplane;
          });
          container.appendChild(airplaneEl);
        }
      });
    } else {
      selectionContainer.classList.add("hidden");
    }
  }

  displayOwnedBullets() {
    const container = document.getElementById("owned-bullet-list");
    const selectionContainer = document.getElementById(
      "bullet-selection-container"
    );
    container.innerHTML = "";

    if (
      this.userData &&
      this.userData.ownedBullets &&
      this.userData.ownedBullets.length > 0
    ) {
      selectionContainer.classList.remove("hidden");
      this.userData.ownedBullets.forEach((b) => {
        const bulletInfo = this.allBullets.find((ab) => ab._id === b.bullet);
        if (bulletInfo && b.quantity > 0) {
          const bulletEl = document.createElement("div");
          bulletEl.className = "owned-bullet-item owned-asset-item";
          bulletEl.dataset.bulletId = b.bullet;
          bulletEl.innerHTML = `<img src="${bulletInfo.imagePath}" alt="${bulletInfo.name}" title="${bulletInfo.name} (x${b.quantity})">`;

          bulletEl.addEventListener("click", () => {
            document
              .querySelectorAll(".owned-bullet-item")
              .forEach((el) => el.classList.remove("selected"));
            bulletEl.classList.add("selected");
            this.selectedBullet = {
              bullet: b.bullet,
              ...bulletInfo,
            };
            window.gameManager.selectedBullet = this.selectedBullet;
          });
          container.appendChild(bulletEl);
        }
      });
    } else {
      selectionContainer.classList.add("hidden");
    }
  }

  // در فایل js/menu.js -> داخل کلاس MenuManager
  // در فایل js/menu.js -> داخل کلاس MenuManager

  async showShopMenu() {
    this.showMenu("shop-menu");
    await this.loadShopItems();
  }
  showMenu(menuId) {
    document.querySelectorAll(".menu-container").forEach((menu) => {
      menu.classList.add("hidden");
    });
    const activeMenu = document.getElementById(menuId);
    if (activeMenu) {
      activeMenu.classList.remove("hidden");
    }
  }

  // در فایل: js/menu.js

  showMainMenu() {
    this.showMenu("main-menu");
    this.displayOwnedPotions();
    // this.displayOwnedAirplanes(); // <<<< این خط را حذف یا کامنت کنید
    // this.displayOwnedBullets(); // <<<< این خط را حذف یا کامنت کنید
  }
  // در فایل js/menu.js -> داخل کلاس MenuManager

  async showLeaderboard() {
    this.showMenu("leaderboard-menu");
    // به صورت پیش‌فرض لیدربورد روزانه را بارگذاری کن
    await this.loadLeaderboard("daily");
  }

  async showUpgradeMenu() {
    this.showMenu("upgrade-menu");
    const container = document.getElementById("upgrade-content");
    if (!container) return;
    container.innerHTML = "در حال بارگذاری اطلاعات...";

    try {
      // دریافت همزمان اطلاعات کاربر و لیست تمام هواپیماها
      const userData = await this.apiRequest("/api/user");
      // window.gameManager.allPlanes باید از قبل بارگذاری شده باشد
      const allPlanes = window.gameManager.allPlanes;

      this.userData = userData;

      const currentTier = userData.airplaneTier || 1;
      const currentStyle = userData.airplaneStyle || 1;

      // تعریف تعداد مدل‌ها برای هر تایر (باید با بک‌اند یکسان باشد)
      const maxStylesPerTier = { 1: 14, 2: 20, 3: 19, 4: 9 };

      // پیدا کردن هواپیمای فعلی
      const currentPlane = allPlanes.find((plane) => {
        const name = plane.name.toLowerCase();
        return (
          name.includes(`tier ${currentTier}`) &&
          name.includes(`model ${currentStyle}`)
        );
      });

      let nextPlane = null;
      let nextTier = currentTier;
      let nextStyle = currentStyle;

      // پیدا کردن هواپیمای بعدی برای ارتقا
      if (currentStyle < maxStylesPerTier[currentTier]) {
        // ارتقا به مدل بعدی در همین تایر
        nextStyle++;
      } else if (currentTier < 4) {
        // ارتقا به تایر بعدی، مدل ۱
        nextTier++;
        nextStyle = 1;
      }

      if (nextTier !== currentTier || nextStyle !== currentStyle) {
        nextPlane = allPlanes.find((plane) => {
          const name = plane.name.toLowerCase();
          return (
            name.includes(`tier ${nextTier}`) &&
            name.includes(`model ${nextStyle}`)
          );
        });
      }

      let upgradeHTML = "";

      if (nextPlane && currentPlane) {
        const cost = currentTier * 100 + currentStyle * 20; // فرمول هزینه مطابق با بک‌اند
        const canAfford = userData.coins >= cost;
        upgradeHTML = `
          <div class="upgrade-info">
            <div class="plane-display">
              <h3>هواپیمای فعلی</h3>
              <img src="${currentPlane.image}" alt="${currentPlane.name}">
              <p>${currentPlane.name}</p>
            </div>
            <div class="upgrade-arrow">→</div>
            <div class="plane-display">
              <h3>ارتقا به</h3>
              <img src="${nextPlane.image}" alt="${nextPlane.name}">
              <p>${nextPlane.name}</p>
            </div>
          </div>
          <div class="upgrade-action">
            <p class="cost">هزینه ارتقا: ${cost} سکه</p>
            <button id="confirm-upgrade-btn" class="menu-btn primary" ${
              !canAfford ? "disabled" : ""
            }>
              ${canAfford ? "ارتقا" : "سکه ناکافی"}
            </button>
          </div>
        `;
      } else if (currentPlane) {
        // اگر هواپیمای بعدی وجود نداشت، یعنی به حداکثر سطح رسیده است
        upgradeHTML = `
          <div class="upgrade-info">
            <div class="plane-display">
              <h3>هواپیمای شما</h3>
              <img src="${currentPlane.image}" alt="${currentPlane.name}">
              <p>${currentPlane.name}</p>
            </div>
          </div>
          <p class="max-level">شما به آخرین لول هواپیما رسیدید!</p>
        `;
      } else {
        upgradeHTML = "<p>خطا: هواپیمای فعلی یافت نشد.</p>";
      }

      container.innerHTML = upgradeHTML;

      // افزودن Event Listener فقط در صورتی که دکمه ارتقا وجود داشته باشد
      if (nextPlane) {
        document
          .getElementById("confirm-upgrade-btn")
          .addEventListener("click", async () => {
            try {
              const result = await this.apiRequest("/api/upgrade", {
                method: "POST",
                body: JSON.stringify({ type: "airplane" }),
              });
              // آپدیت اطلاعات کاربر و نمایش مجدد صفحه ارتقا
              this.userData = result.user;
              this.showNotification("ارتقا با موفقیت انجام شد!", "success");
              this.showUpgradeMenu();
            } catch (error) {
              const errorData = await error.response.json();
              this.showNotification(
                errorData.error || "ارتقا ناموفق بود.",
                "error"
              );
            }
          });
      }
    } catch (error) {
      container.innerHTML = "<p>خطا در دریافت اطلاعات ارتقا.</p>";
      console.error("Error showing upgrade menu:", error);
    }
  }

  showFreeCoinsMenu() {
    this.showMenu("free-coins-menu");
  }

  startGame() {
    document.querySelectorAll(".menu-container").forEach((menu) => {
      menu.classList.add("hidden");
    });
    document.getElementById("game-container").classList.remove("hidden");

    if (typeof startGame === "function") {
      startGame();
    }
  }

  async apiRequest(endpoint, options = {}) {
    try {
      const response = await fetch(`${BASEURL}${endpoint}`, {
        headers: {
          "Content-Type": "application/json",
          "x-tgid": this.getTgId(),
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("API request failed:", error);
      throw error;
    }
  }

  async loadLeaderboard(type = "daily") {
    try {
      const leaderboard = await this.apiRequest(
        `/api/leaderboard?type=${type}`
      );
      this.renderLeaderboard(leaderboard);
      if (leaderboard) {
        this.updateResetTimer(leaderboard.endDate);
      }
    } catch (error) {
      console.error(`Error loading ${type} leaderboard:`, error);
      document.getElementById("leaderboard-content").innerHTML =
        "<p>خطا در بارگذاری</p>";
    }
  }

  // در فایل js/menu.js -> کلاس MenuManager
  // در فایل frontend/js/menu.js

  // در فایل js/menu.js -> داخل کلاس MenuManager

  renderLeaderboard(leaderboard) {
    const podiumContainer = document.getElementById("leaderboard-podium");
    const listContainer = document.getElementById("leaderboard-content");
    const userRankContainer = document.getElementById("user-rank-display");

    // پاک کردن محتوای قبلی
    podiumContainer.innerHTML = "";
    listContainer.innerHTML = "";
    userRankContainer.innerHTML = "شما در این رتبه‌بندی حضور ندارید.";

    if (
      !this.userData ||
      !leaderboard ||
      !leaderboard.rankings ||
      leaderboard.rankings.length === 0
    ) {
      podiumContainer.innerHTML = "<p>هنوز رتبه‌ای ثبت نشده است.</p>";
      return;
    }

    // ۱. آپدیت تایمر با زمان باقی‌مانده صحیح
    this.updateResetTimer(leaderboard.endDate);

    const rankings = leaderboard.rankings;
    let userRank = null;

    // ۲. ساخت سکوی قهرمانی برای نفرات اول تا سوم
    const podiumPlayers = rankings.slice(0, 3);
    podiumPlayers.forEach((player, index) => {
      const rank = index + 1;
      const podiumItem = document.createElement("div");
      podiumItem.className = `podium-item rank-${rank}`;

      const score = (player.wins || 0) - (player.losses || 0);

      podiumItem.innerHTML = `
            <div class="podium-name">${player.user?.username || "Unknown"}</div>
            <div class="podium-score">امتیاز: ${score}</div>
        `;
      podiumContainer.appendChild(podiumItem);
    });

    // ۳. ساخت لیست برای نفرات چهارم به بعد
    const otherPlayers = rankings.slice(3);
    otherPlayers.forEach((player, index) => {
      const rank = index + 4;
      const listItem = document.createElement("div");
      listItem.className = "leaderboard-item";

      const wins = player.wins || 0;
      const losses = player.losses || 0;
      const score = wins - losses;

      listItem.innerHTML = `
            <div class="leaderboard-rank">${rank}</div>
            <div class="leaderboard-user">
                <strong>${player.user?.username || "Unknown"}</strong>
                <div class="leaderboard-score">
                    <span>امتیاز: ${score}</span>
                    <small>(برد: ${wins} / باخت: ${losses})</small>
                </div>
            </div>
        `;
      listContainer.appendChild(listItem);
    });

    // ۴. پیدا کردن و نمایش رتبه کاربر فعلی
    const userIndex = rankings.findIndex(
      (p) => p.user && p.user._id === this.userData._id
    );
    if (userIndex !== -1) {
      const userRankData = rankings[userIndex];
      const rank = userIndex + 1;
      const wins = userRankData.wins || 0;
      const losses = userRankData.losses || 0;
      const score = wins - losses;

      userRankContainer.innerHTML = `
            <div class="leaderboard-rank">${rank}</div>
            <div class="leaderboard-user">
                <strong>(شما) ${this.userData.username}</strong>
                <div class="leaderboard-score">
                   <span>امتیاز: ${score}</span>
                   <small>(برد: ${wins} / باخت: ${losses})</small>
                </div>
            </div>
        `;
    }
  }

  // در فایل js/menu.js -> داخل کلاس MenuManager

  updateResetTimer(endDate) {
    const timerElement = document.getElementById("reset-timer");
    if (!timerElement) return; // اگر عنصر تایمر وجود نداشت، خارج شو

    // <<<< بخش اصلاح‌شده: پاک کردن تایمر قبلی >>>>
    if (this.leaderboardTimer) {
      clearInterval(this.leaderboardTimer);
    }
    // <<<< پایان بخش اصلاح‌شده >>>>

    const endTime = new Date(endDate).getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const distance = endTime - now;

      if (distance < 0) {
        timerElement.textContent = "۰۰:۰۰:۰۰";
        clearInterval(this.leaderboardTimer); // تایمر را متوقف کن
        return;
      }

      // محاسبه زمان باقی‌مانده (روز، ساعت، دقیقه، ثانیه)
      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      // نمایش زمان بر اساس مقدار آن
      if (days > 0) {
        timerElement.textContent = `${days} روز و ${hours
          .toString()
          .padStart(2, "0")} ساعت`;
      } else {
        timerElement.textContent = `${hours
          .toString()
          .padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
          .toString()
          .padStart(2, "0")}`;
      }
    };

    updateTimer(); // اجرای اولیه
    // ذخیره تایمر جدید در متغیر کلاس
    this.leaderboardTimer = setInterval(updateTimer, 1000);
  }
  // در فایل menu.js - متد loadShopItems را با این کد جایگزین کنید
  // در فایل js/menu.js -> کلاس MenuManager

  // تابع loadShopItems را با این کد جایگزین کنید
  // در فایل js/menu.js -> داخل کلاس MenuManager
  async loadShopItems() {
    const container = document.getElementById("potions-tab");
    if (!container) return;

    container.innerHTML = '<p class="loading-text">در حال بارگذاری...</p>';
    try {
      const potions = await this.apiRequest("/api/potions");

      if (!potions || potions.length === 0) {
        container.innerHTML = "<p>هیچ معجونی در فروشگاه موجود نیست.</p>";
        return;
      }

      container.innerHTML = ""; // پاک کردن پیام "در حال بارگذاری"
      potions.forEach((potion) => {
        const item = document.createElement("div");
        item.className = "selection-item";
        item.innerHTML = `
                <img src="${potion.imagePath}" alt="${potion.name}">
                <p>${potion.name}</p>
                <span class="price">${potion.price} سکه</span>
                <button class="buy-btn menu-btn">خرید</button>
            `;
        // اضافه کردن رویداد کلیک برای دکمه خرید
        item
          .querySelector(".buy-btn")
          .addEventListener("click", () =>
            this.buyPotion(potion._id, potion.name, potion.price)
          );
        container.appendChild(item);
      });
    } catch (error) {
      console.error("Error loading shop items:", error);
      container.innerHTML =
        '<p class="error-text">خطا در بارگذاری فروشگاه.</p>';
    }
  }

  // تابع buyPotion را با این کد جایگزین کنید

  // در فایل menu.js - بهبود متد renderPotions
  // در فایل menu.js - متد renderPotions را با این کد جایگزین کنید
  renderPotions(potions) {
    const container = document.getElementById("potions-tab");
    container.innerHTML = "";

    // بررسی کنید که potions یک آرایه است
    if (!Array.isArray(potions) || potions.length === 0) {
      container.innerHTML =
        "<p class='no-items'>هیچ معجونی در فروشگاه موجود نیست.</p>";
      return;
    }

    // ایجاد یک گرید برای نمایش معجون‌ها
    const gridContainer = document.createElement("div");
    gridContainer.className = "potions-grid";

    potions.forEach((potion) => {
      const potionItem = document.createElement("div");
      potionItem.className = "shop-item";

      potionItem.innerHTML = `
      <img src="${potion.imagePath}" alt="${
        potion.name
      }" onerror="this.src='assets/images/potions/heal.png'">
      <div class="shop-item-info">
        <h4>${potion.name}</h4>
        <p>${potion.description}</p>
        <p class="potion-effect">${potion.effect}</p>
        <p class="shop-item-price">قیمت: ${potion.price} سکه</p>
      </div>
      <button class="buy-btn" data-id="${potion._id}" 
              ${this.userData.coins < potion.price ? "disabled" : ""}>
        خرید
      </button>
    `;

      gridContainer.appendChild(potionItem);
    });

    container.appendChild(gridContainer);

    // اضافه کردن event listener برای دکمه‌های خرید
    document.querySelectorAll(".buy-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const potionId = e.target.closest(".buy-btn").dataset.id;
        this.buyPotion(potionId);
      });
    });
  }

  // بهبود متد buyPotion برای نمایش بهتر نتیجه خرید

  // در menu.js این تنها نسخه buyPotion باشد

  // در فایل js/menu.js -> داخل کلاس MenuManager
  async buyPotion(potionId, potionName, potionPrice) {
    try {
      // ابتدا اطلاعات کاربر را آپدیت می‌کنیم تا موجودی سکه دقیق باشد
      this.userData = await this.apiRequest("/api/user");

      if (this.userData.coins < potionPrice) {
        this.showNotification("سکه شما کافی نیست!", "error");
        window.soundManager.play("error");
        return;
      }

      const result = await this.apiRequest("/api/shop/buy-potion", {
        method: "POST",
        body: JSON.stringify({ potionId, quantity: 1 }),
      });

      // آپدیت اطلاعات کاربر در کلاینت
      this.userData.coins = result.coins;
      localStorage.setItem("userData", JSON.stringify(this.userData));
      this.updateUI();

      this.showNotification(
        `معجون ${potionName} با موفقیت خریداری شد`,
        "success"
      );
      window.soundManager.play("purchase");
    } catch (error) {
      this.showNotification("خطا در هنگام خرید", "error");
      window.soundManager.play("error");
      console.error("Error buying potion:", error);
    }
  }
  // اضافه کردن متد کمکی برای نمایش نوتیفیکیشن
  // در فایل js/menu.js -> کلاس MenuManager
  showNotification(message, type = "info") {
    const container = document.getElementById("notification-container");
    if (!container) return;

    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.textContent = message;

    container.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3900); // کمی کمتر از زمان انیمیشن
  }

  // اضافه کردن متد کمکی برای پیدا کردن معجون بر اساس ID
  getPotionById(potionId) {
    // این متد فرضی است - باید با داده‌های واقعی پر شود
    const potions = this.getAvailablePotions(); // باید پیاده‌سازی شود
    return potions.find((p) => p._id === potionId);
  }
  // در فایل js/menu.js -> داخل کلاس MenuManager

  // در فایل js/menu.js -> داخل کلاس MenuManager

  switchShopTab(clickedTab) {
    // ۱. کلاس 'active' را از همه دکمه‌های تب حذف کن
    document.querySelectorAll(".shop-tabs .tab-btn").forEach((tab) => {
      tab.classList.remove("active");
    });
    // ۲. کلاس 'active' را به دکمه کلیک‌شده اضافه کن
    clickedTab.classList.add("active");

    // ۳. کلاس 'active' را از همه پنل‌های محتوا حذف کن (مهم‌ترین بخش)
    document
      .querySelectorAll(".shop-content .tab-content")
      .forEach((content) => {
        content.classList.remove("active");
      });

    // ۴. پنل محتوای مربوط به تب کلیک‌شده را پیدا کرده و آن را نمایش بده
    const tabId = clickedTab.getAttribute("data-tab");
    const activeContent = document.getElementById(`${tabId}-tab`);
    if (activeContent) {
      activeContent.classList.add("active");
    }
  }
  async upgradeFeature(featureType) {
    try {
      const response = await this.apiRequest(`/api/upgrade`, {
        method: "POST",
        body: JSON.stringify({
          tgid: this.getTgId(),
          type: featureType,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        alert("ارتقاء با موفقیت انجام شد!");
        this.userData.coins = result.coins;
        localStorage.setItem("userData", JSON.stringify(this.userData));
        this.updateUI();
      } else {
        alert(result.error);
      }
    } catch (error) {
      console.error("Error upgrading feature:", error);
      alert("خطا در ارتقاء ویژگی");
    }
  }

  inviteFriends() {
    if (window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.shareUrl(
        `https://t.me/your_bot_username?start=ref_${this.getTgId()}`,
        "به بازی جنگنده‌های هوایی بپیوندید و ۱۰ سکه رایگان دریافت کنید!"
      );
    } else {
      prompt(
        "لینک دعوت خود را کپی کنید:",
        `https://t.me/your_bot_username?start=ref_${this.getTgId()}`
      );
    }
  }

  async checkMembership(platform) {
    try {
      const response = await this.apiRequest(`/api/check-membership`, {
        method: "POST",
        body: JSON.stringify({
          tgid: this.getTgId(),
          platform,
          username: this.userData.username,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        alert(
          `عضویت شما تأیید شد! ${
            platform === "telegram" ? 10 : platform === "instagram" ? 15 : 20
          } سکه به حساب شما اضافه شد.`
        );
        this.userData.coins = result.coins;
        localStorage.setItem("userData", JSON.stringify(this.userData));
        this.updateUI();
      } else {
        alert(result.error);
      }
    } catch (error) {
      console.error("Error checking membership:", error);
      alert("خطا در بررسی عضویت");
    }
  }

  getTgId() {
    if (window.Telegram && window.Telegram.WebApp) {
      return window.Telegram.WebApp.initDataUnsafe.user.id;
    }

    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("tgid") || localStorage.getItem("tgid");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.menuManager = new MenuManager();
});
