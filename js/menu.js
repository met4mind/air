const BASEURL = "http://localhost:3000";

class MenuManager {
  constructor() {
    this.currentMenu = null; // شروع بدون منوی فعال
    this.userData = null;
    this.allPotions = [];
    this.leaderboardTimer = null;
    this.init();
  }

  async init() {
    await this.loadMasterData();
    this.bindEvents();
    this.loadUserData();
    this.startDataSync();
    // نمایش منوی اصلی در ابتدای بارگذاری
    this.showMenu("main-menu");
  }

  // --- تابع اصلی برای نمایش منو با انیمیشن ---
  showMenu(menuId) {
    if (this.currentMenu === menuId) return;

    // مخفی کردن منوی فعلی
    if (this.currentMenu) {
      const currentMenuEl = document.getElementById(this.currentMenu);
      if (currentMenuEl) {
        currentMenuEl.classList.remove("active");
      }
    }

    // نمایش منوی جدید
    const nextMenuEl = document.getElementById(menuId);
    if (nextMenuEl) {
      nextMenuEl.classList.remove("hidden"); // برای اجرای انیمیشن، ابتدا از حالت display:none خارج می‌کنیم
      // یک تأخیر بسیار کوتاه برای اینکه مرورگر فرصت پردازش داشته باشد
      setTimeout(() => {
        nextMenuEl.classList.add("active");
      }, 10);
    }

    this.currentMenu = menuId;

    // کنترل انیمیشن هواپیما بر اساس منوی فعال
    if (menuId === "main-menu") {
      window.gameManager.startMainMenuAnimation();
    } else {
      window.gameManager.stopMainMenuAnimation();
    }

    this.updateActiveNav(menuId);
  }

  // --- تابع کمکی برای مدیریت کلاس active در نویگیشن ---
  updateActiveNav(activeMenuId) {
    const menuToNavButtonMap = {
      "main-menu": "main-menu-btn",
      "shop-menu": "shop-btn",
      "selection-menu": "selection-btn",
      "leaderboard-menu": "leaderboard-btn",
      "free-coins-menu": "free-coins-btn",
      "upgrade-menu": "selection-btn", // ارتقا بخشی از تجهیزات است
    };

    const activeBtnId = menuToNavButtonMap[activeMenuId];
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.classList.remove("active");
    });

    if (activeBtnId) {
      const activeBtn = document.getElementById(activeBtnId);
      if (activeBtn) activeBtn.classList.add("active");
    }
  }

  // --- اتصال رویدادها ---
  bindEvents() {
    document
      .getElementById("play-btn")
      .addEventListener("click", () =>
        window.gameManager.initiateGameConnection()
      );

    // نویگیشن پایین صفحه
    document
      .getElementById("main-menu-btn")
      .addEventListener("click", () => this.showMenu("main-menu"));
    document
      .getElementById("shop-btn")
      .addEventListener("click", () => this.showShopMenu());
    document
      .getElementById("selection-btn")
      .addEventListener("click", () => this.showSelectionMenu());
    document
      .getElementById("leaderboard-btn")
      .addEventListener("click", () => this.showLeaderboard());
    document
      .getElementById("free-coins-btn")
      .addEventListener("click", () => this.showMenu("free-coins-menu"));

    const goToUpgradeBtn = document.getElementById("go-to-upgrade-btn");
    if (goToUpgradeBtn) {
      goToUpgradeBtn.addEventListener("click", () => this.showUpgradeMenu());
    }

    const leaderboardTabsContainer = document.querySelector(
      "#leaderboard-menu .leaderboard-tabs"
    );
    if (leaderboardTabsContainer) {
      leaderboardTabsContainer.addEventListener("click", (e) => {
        const clickedTab = e.target.closest(".tab-btn");
        if (clickedTab) this.switchLeaderboardTab(clickedTab);
      });
    }
  }

  // --- توابع کمکی برای انیمیشن و لودر ---
  insertLoader(container) {
    container.innerHTML = '<div class="loader"></div>';
  }

  animateListItems(containerSelector) {
    const items = document.querySelectorAll(`${containerSelector} > *`);
    items.forEach((item, index) => {
      item.style.animationDelay = `${index * 0.05}s`;
    });
  }

  // --- توابع نمایش هر منو ---
  async showShopMenu() {
    this.showMenu("shop-menu");
    await this.loadShopItems();
  }

  async showLeaderboard() {
    this.showMenu("leaderboard-menu");
    await this.loadLeaderboard("daily");
  }

  async showSelectionMenu() {
    this.showMenu("selection-menu");
    const airplaneContainer = document.getElementById(
      "airplane-selection-container"
    );
    // <<<< کانتینر جدید برای همراهان >>>>
    const wingmanContainer = document.getElementById(
      "wingman-selection-container"
    );
    const potionContainer = document.getElementById(
      "potion-selection-container"
    );
    if (!airplaneContainer || !potionContainer || !wingmanContainer) return;

    this.insertLoader(airplaneContainer);
    this.insertLoader(wingmanContainer);
    this.insertLoader(potionContainer);

    try {
      // <<<< دریافت دیتای همراهان از API >>>>
      const [userData, allPotions, allWingmen] = await Promise.all([
        this.apiRequest("/api/user"),
        this.apiRequest("/api/potions"),
        this.apiRequest("/api/game-data/wingmen"),
      ]);
      this.userData = userData;
      const allPlanes = window.gameManager.allPlanes;

      airplaneContainer.innerHTML = "";
      const availablePlanes = allPlanes.filter(
        (p) =>
          p.tier &&
          (p.tier < userData.airplaneTier ||
            (p.tier === userData.airplaneTier &&
              p.style <= userData.airplaneStyle))
      );
      availablePlanes.forEach((p) =>
        airplaneContainer.appendChild(this.createSelectItem(p, "airplane"))
      );
      this.animateListItems("#airplane-selection-container");

      // <<<< کد جدید برای نمایش همراهان >>>>
      wingmanContainer.innerHTML = "";
      const availableWingmen = allWingmen.filter(
        (w) => w.level <= userData.wingmanLevel
      );
      availableWingmen.forEach((w) =>
        wingmanContainer.appendChild(this.createSelectItem(w, "wingman"))
      );
      this.animateListItems("#wingman-selection-container");
      // <<<< پایان کد جدید >>>>

      potionContainer.innerHTML = "";
      const nonePotion = {
        _id: "none",
        name: "هیچکدام",
        imagePath: "assets/images/potions/none.png",
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
      this.animateListItems("#potion-selection-container");

      this.applySavedSelections({ allPlanes, allPotions, allWingmen });
    } catch (error) {
      console.error("Failed to load equipment:", error);
      airplaneContainer.innerHTML = "<p>خطا در بارگذاری.</p>";
      wingmanContainer.innerHTML = "<p>خطا در بارگذاری.</p>";
      potionContainer.innerHTML = "<p>خطا در بارگذاری.</p>";
    }
  }

  async showUpgradeMenu() {
    this.showMenu("upgrade-menu");
    const container = document.getElementById("upgrade-content");
    if (!container) return;

    container.innerHTML = `
            <div class="shop-tabs">
                <button class="tab-btn active" data-tab="airplane-upgrade">هواپیما</button>
                <button class="tab-btn" data-tab="bullet-upgrade">گلوله</button>
                <button class="tab-btn" data-tab="wingman-upgrade">همراه</button>
            </div>
            <div class="upgrade-tabs-content">
                <div id="airplane-upgrade-tab" class="tab-content active"><div class="loader"></div></div>
                <div id="bullet-upgrade-tab" class="tab-content"><div class="loader"></div></div>
                <div id="wingman-upgrade-tab" class="tab-content"><div class="loader"></div></div>
            </div>`;

    container.querySelectorAll(".tab-btn").forEach((tab) => {
      tab.addEventListener("click", (e) => {
        container
          .querySelectorAll(".tab-btn")
          .forEach((t) => t.classList.remove("active"));
        container
          .querySelectorAll(".tab-content")
          .forEach((c) => c.classList.remove("active"));
        e.target.classList.add("active");
        document
          .getElementById(`${e.target.dataset.tab}-tab`)
          .classList.add("active");
      });
    });

    this.renderAirplaneUpgradeTab();
    this.renderBulletUpgradeTab();
    this.renderWingmanUpgradeTab();
  }

  async renderWingmanUpgradeTab() {
    const container = document.getElementById("wingman-upgrade-tab");
    if (!container) return;

    try {
      const allWingmen = window.gameManager.allWingmen;
      const userData = await this.apiRequest("/api/user");
      this.userData = userData;

      const currentLevel = userData.wingmanLevel || 1;
      const currentWingman = allWingmen.find((w) => w.level === currentLevel);

      if (!currentWingman) {
        container.innerHTML = "<p>خطا در دریافت اطلاعات همراه.</p>";
        return;
      }

      const nextWingman = allWingmen.find((w) => w.level === currentLevel + 1);

      let upgradeHTML = "";
      if (nextWingman) {
        const cost = currentWingman.upgradeCost;
        const canAfford = userData.coins >= cost;
        upgradeHTML = `
                <div class="upgrade-info" style="display: flex; justify-content: space-around; align-items: center; margin-bottom: 20px;">
                    <div class="plane-display" style="text-align: center;">
                        <h4>فعلی: ${currentWingman.name}</h4>
                        <img src="${currentWingman.image}" alt="${
          currentWingman.name
        }" style="width:100px; height:auto;">
                        <p style="font-size: 0.9em;">قدرت: ${
                          currentWingman.damage
                        }</p>
                    </div>
                    <div class="upgrade-arrow" style="font-size: 2.5em;">→</div>
                    <div class="plane-display" style="text-align: center;">
                        <h4>بعدی: ${nextWingman.name}</h4>
                        <img src="${nextWingman.image}" alt="${
          nextWingman.name
        }" style="width:100px; height:auto;">
                        <p style="font-size: 0.9em;">قدرت: ${
                          nextWingman.damage
                        }</p>
                    </div>
                </div>
                <div class="upgrade-action" style="text-align:center;">
                    <p class="cost" style="margin-bottom: 10px;">هزینه ارتقا: ${cost} سکه</p>
                    <button id="confirm-wingman-upgrade-btn" class="menu-btn primary" ${
                      !canAfford ? "disabled" : ""
                    }>
                        ${canAfford ? "ارتقا" : "سکه ناکافی"}
                    </button>
                </div>`;
      } else {
        upgradeHTML = `
                <div class="upgrade-info" style="text-align:center;">
                    <div class="plane-display">
                        <h4>همراه شما</h4>
                        <img src="${currentWingman.image}" alt="${currentWingman.name}" style="width:120px; height:auto;">
                        <p>${currentWingman.name}</p>
                    </div>
                </div>
                <p class="max-level" style="text-align:center; margin-top: 20px; color: var(--color-accent);">همراه شما به آخرین سطح ارتقا رسیده است!</p>`;
      }

      container.innerHTML = upgradeHTML;

      if (nextWingman) {
        document
          .getElementById("confirm-wingman-upgrade-btn")
          .addEventListener("click", async () => {
            try {
              const result = await this.apiRequest("/api/upgrade", {
                method: "POST",
                body: JSON.stringify({ type: "wingman" }),
              });
              this.userData = result.user;
              localStorage.setItem("userData", JSON.stringify(result.user));
              this.updateUI();
              this.showNotification("همراه با موفقیت ارتقا یافت!", "success");
              this.renderWingmanUpgradeTab(); // رفرش کردن تب
            } catch (error) {
              this.showNotification("ارتقا ناموفق بود.", "error");
            }
          });
      }
    } catch (error) {
      container.innerHTML = "<p>خطا در بارگذاری اطلاعات ارتقا.</p>";
      console.error("Error rendering wingman upgrade tab:", error);
    }
  }
  async loadMasterData() {
    try {
      this.allPotions = await this.apiRequest(`/api/potions`);
    } catch (error) {
      console.error("Failed to load master potion data:", error);
      this.allPotions = [];
    }
  }

  async switchLeaderboardTab(clickedTab) {
    document
      .querySelectorAll(".leaderboard-tabs .tab-btn")
      .forEach((tab) => tab.classList.remove("active"));
    clickedTab.classList.add("active");
    await this.loadLeaderboard(clickedTab.dataset.type);
  }

  applySavedSelections({ allPlanes, allWingmen }) {
    if (!window.gameManager || !this.userData) return;

    const airplaneContainer = document.getElementById(
      "airplane-selection-container"
    );
    airplaneContainer
      .querySelectorAll(".selection-item")
      .forEach((el) => el.classList.remove("selected"));

    let airplaneToSelect = null;
    const savedAirplaneData = JSON.parse(
      localStorage.getItem("selectedAirplane")
    );
    if (savedAirplaneData && allPlanes) {
      airplaneToSelect = allPlanes.find(
        (p) =>
          p.tier === savedAirplaneData.tier &&
          p.style === savedAirplaneData.style
      );
    }
    if (!airplaneToSelect) {
      airplaneToSelect = allPlanes.find(
        (p) =>
          p.tier === this.userData.airplaneTier &&
          p.style === this.userData.airplaneStyle
      );
    }

    if (airplaneToSelect) {
      const assetId = `${airplaneToSelect.tier}_${airplaneToSelect.style}`;
      const itemElement = airplaneContainer.querySelector(
        `.selection-item[data-asset-id="${assetId}"]`
      );
      if (itemElement) itemElement.classList.add("selected");
      window.gameManager.selectedAirplane = airplaneToSelect;
      localStorage.setItem(
        "selectedAirplane",
        JSON.stringify(airplaneToSelect)
      );
      window.gameManager.updateMainMenuAirplaneImage();
    }

    // <<<< کد جدید برای اعمال انتخاب ذخیره شده همراه >>>>
    const wingmanContainer = document.getElementById(
      "wingman-selection-container"
    );
    wingmanContainer
      .querySelectorAll(".selection-item")
      .forEach((el) => el.classList.remove("selected"));

    let wingmanToSelect = null;
    const savedWingmanData = JSON.parse(
      localStorage.getItem("selectedWingman")
    );
    if (savedWingmanData && allWingmen) {
      wingmanToSelect = allWingmen.find(
        (w) => w.level === savedWingmanData.level
      );
    }
    // اگر کاربر همراهی با سطح بالاتر داشت، آن را به عنوان پیش‌فرض انتخاب کن
    if (!wingmanToSelect) {
      wingmanToSelect = allWingmen.find(
        (w) => w.level === this.userData.wingmanLevel
      );
    }

    if (wingmanToSelect) {
      const itemElement = wingmanContainer.querySelector(
        `.selection-item[data-asset-id="${wingmanToSelect.level}"]`
      );
      if (itemElement) itemElement.classList.add("selected");
      window.gameManager.selectedWingman = wingmanToSelect;
      localStorage.setItem("selectedWingman", JSON.stringify(wingmanToSelect));
    }
    // <<<< پایان کد جدید >>>>

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
      : potionContainer.querySelector('.selection-item[data-asset-id="none"]');
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

  createSelectItem(asset, type) {
    const item = document.createElement("div");
    item.className = "selection-item";
    const assetId =
      type === "airplane"
        ? `${asset.tier}_${asset.style}`
        : type === "wingman"
        ? asset.level
        : asset._id || asset.id;
    item.dataset.assetId = assetId;
    const imageSrc = asset.imagePath || asset.image;
    item.innerHTML = `<img src="${imageSrc}" alt="${asset.name}"><p>${
      asset.displayName || asset.name
    }</p>`;
    item.addEventListener("click", () => {
      document
        .querySelectorAll(`#${type}-selection-container .selection-item`)
        .forEach((el) => el.classList.remove("selected"));
      item.classList.add("selected");
      if (window.gameManager) {
        const key = `selected${type.charAt(0).toUpperCase() + type.slice(1)}`;
        const valueToStore = assetId === "none" ? null : asset;
        window.gameManager[key] = valueToStore;
        localStorage.setItem(key, JSON.stringify(valueToStore));
        if (type === "airplane") {
          window.gameManager.updateMainMenuAirplaneImage();
        }
      }
    });
    return item;
  }

  loadUserData() {
    try {
      const savedData = localStorage.getItem("userData");
      if (savedData) {
        this.userData = JSON.parse(savedData);
        this.updateUI();
        const savedPotion = localStorage.getItem("selectedPotion");
        window.gameManager.selectedPotion =
          savedPotion && savedPotion !== "null"
            ? JSON.parse(savedPotion)
            : null;
        this.selectedPotion = window.gameManager.selectedPotion;
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  }

  updateUI() {
    if (!this.userData) return;
    const statsHTML = `<span id="user-coins">⛁ ${this.userData.coins}</span><span id="user-stars">★ ${this.userData.stars}</span>`;
    document.querySelectorAll(".user-stats-display").forEach((display) => {
      display.innerHTML = statsHTML;
    });
  }

  startDataSync() {
    setInterval(() => this.loadUserData(), 5000);
  }

  async renderAirplaneUpgradeTab() {
    const container = document.getElementById("airplane-upgrade-tab");
    if (!container) return;
    try {
      if (
        !window.gameManager ||
        !window.gameManager.allPlanes ||
        window.gameManager.allPlanes.length === 0
      ) {
        container.innerHTML =
          "<p>اطلاعات هواپیما یافت نشد. لطفا صفحه را رفرش کنید.</p>";
        return;
      }
      const userData = await this.apiRequest("/api/user");
      const allPlanes = window.gameManager.allPlanes;
      this.userData = userData;
      const currentTier = userData.airplaneTier || 1;
      const currentStyle = userData.airplaneStyle || 1;
      const currentPlane = allPlanes.find(
        (p) => p.tier === currentTier && p.style === currentStyle
      );
      if (!currentPlane) {
        container.innerHTML =
          "<p>خطا: هواپیمای فعلی شما در لیست هواپیماها یافت نشد.</p>";
        return;
      }
      const currentIndex = allPlanes.findIndex(
        (p) => p.tier === currentTier && p.style === currentStyle
      );
      const nextPlane =
        currentIndex !== -1 && currentIndex < allPlanes.length - 1
          ? allPlanes[currentIndex + 1]
          : null;
      let upgradeHTML = "";
      if (nextPlane) {
        const cost = nextPlane.price;
        const canAfford = userData.coins >= cost;
        upgradeHTML = `
                    <div class="upgrade-info" style="display: flex; justify-content: space-around; align-items: center; margin-bottom: 20px;">
                        <div class="plane-display" style="text-align: center;">
                            <h4>فعلی</h4>
                            <img src="${currentPlane.image}" alt="${
          currentPlane.name
        }" style="width:100px; height:auto;">
                            <p style="font-size: 0.8em;">${
                              currentPlane.name
                            }</p>
                        </div>
                        <div class="upgrade-arrow" style="font-size: 2.5em;">→</div>
                        <div class="plane-display" style="text-align: center;">
                            <h4>بعدی</h4>
                            <img src="${nextPlane.image}" alt="${
          nextPlane.name
        }" style="width:100px; height:auto;">
                            <p style="font-size: 0.8em;">${nextPlane.name}</p>
                        </div>
                    </div>
                    <div class="upgrade-action" style="text-align:center;">
                        <p class="cost" style="margin-bottom: 10px;">هزینه ارتقا: ${cost} سکه</p>
                        <button id="confirm-plane-upgrade-btn" class="menu-btn primary" ${
                          !canAfford ? "disabled" : ""
                        }>
                            ${canAfford ? "ارتقا" : "سکه ناکافی"}
                        </button>
                    </div>`;
      } else {
        upgradeHTML = `
                    <div class="upgrade-info" style="text-align:center;">
                        <div class="plane-display">
                            <h4>هواپیمای شما</h4>
                            <img src="${currentPlane.image}" alt="${currentPlane.name}" style="width:120px; height:auto;">
                            <p>${currentPlane.name}</p>
                        </div>
                    </div>
                    <p class="max-level" style="text-align:center; margin-top: 20px; color: var(--color-accent);">شما به آخرین سطح ارتقا رسیده‌اید!</p>`;
      }
      container.innerHTML = upgradeHTML;
      if (nextPlane) {
        const upgradeButton = document.getElementById(
          "confirm-plane-upgrade-btn"
        );
        if (upgradeButton) {
          upgradeButton.addEventListener("click", async () => {
            try {
              const result = await this.apiRequest("/api/upgrade", {
                method: "POST",
                body: JSON.stringify({ type: "airplane" }),
              });
              if (result && result.user) {
                this.userData = result.user;
                localStorage.setItem("userData", JSON.stringify(result.user));
                this.updateUI();
              }
              this.showNotification("هواپیما با موفقیت ارتقا یافت!", "success");
              this.renderAirplaneUpgradeTab();
            } catch (error) {
              const errorData = await error.response.json();
              this.showNotification(
                errorData.error || "ارتقا ناموفق بود.",
                "error"
              );
            }
          });
        }
      }
    } catch (error) {
      container.innerHTML = "<p>خطا در بارگذاری اطلاعات.</p>";
      console.error("Error rendering airplane upgrade tab:", error);
    }
  }

  async renderBulletUpgradeTab() {
    const container = document.getElementById("bullet-upgrade-tab");
    if (!container) return;
    const selectedAirplane = window.gameManager.selectedAirplane;
    if (!selectedAirplane) {
      container.innerHTML =
        "<p>ابتدا یک هواپیما از منوی 'انتخاب تجهیزات' انتخاب کنید.</p>";
      return;
    }
    try {
      const userData = await this.apiRequest("/api/user");
      this.userData = userData;
      const airplaneKey = `${selectedAirplane.tier}_${selectedAirplane.style}`;
      const currentLevel =
        (userData.airplaneBulletLevels &&
          userData.airplaneBulletLevels[airplaneKey]) ||
        1;
      const bulletSpecs = {
        1: {
          size: 20,
          filter: "saturate(3) hue-rotate(200deg)",
          name: "آبی (سطح ۱)",
        },
        2: {
          size: 25,
          filter: "saturate(5) hue-rotate(15deg)",
          name: "نارنجی (سطح ۲)",
        },
        3: {
          size: 30,
          filter: "saturate(4) hue-rotate(320deg)",
          name: "قرمز (سطح ۳)",
        },
        4: {
          size: 40,
          filter: "saturate(3) hue-rotate(250deg)",
          name: "بنفش (سطح ۴)",
        },
      };
      const currentSpec = bulletSpecs[currentLevel];
      const nextSpec = currentLevel < 4 ? bulletSpecs[currentLevel + 1] : null;
      let visualHTML = `
                <div class="upgrade-info" style="display: flex; justify-content: space-around; align-items: center; margin-bottom: 20px; min-height: 120px;">
                    <div class="bullet-display" style="text-align: center;">
                        <h4>فعلی</h4>
                        <div id="current-bullet-preview" style="width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; margin: 0 auto;"></div>
                        <p>${currentSpec.name}</p>
                    </div>`;
      if (nextSpec) {
        visualHTML += `
                    <div class="upgrade-arrow" style="font-size: 2.5em;">→</div>
                    <div class="bullet-display" style="text-align: center;">
                        <h4>بعدی</h4>
                        <div id="next-bullet-preview" style="width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; margin: 0 auto;"></div>
                        <p>${nextSpec.name}</p>
                    </div>`;
      }
      visualHTML += `</div>`;
      let actionHTML = "";
      if (nextSpec) {
        const BaseValue = 1000;
        const cost = Math.ceil(
          BaseValue * 0.06 * Math.pow(1.12, currentLevel - 1)
        );
        const canAfford = userData.coins >= cost;
        actionHTML = `
                    <div class="upgrade-action" style="text-align:center;">
                        <p class="cost">هزینه ارتقا: ${cost} سکه</p>
                        <button id="confirm-bullet-upgrade-btn" class="menu-btn primary" ${
                          !canAfford ? "disabled" : ""
                        }>
                            ${canAfford ? "ارتقا" : "سکه ناکافی"}
                        </button>
                    </div>`;
      } else {
        actionHTML = `<p class="max-level">این هواپیما به حداکثر سطح ارتقا گلوله رسیده‌ است.</p>`;
      }
      container.innerHTML = `
                <div class="upgrade-item" style="text-align:center;">
                    <h3>ارتقا گلوله برای: <span style="color: var(--color-accent);">${selectedAirplane.name}</span></h3>
                </div>
                ${visualHTML}
                ${actionHTML}`;
      const createBulletPreview = (spec) => {
        const bulletDiv = document.createElement("div");
        bulletDiv.style.backgroundImage =
          "url('./assets/images/bullets/lvl1.png')";
        bulletDiv.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
        bulletDiv.style.backgroundSize = "contain";
        bulletDiv.style.backgroundRepeat = "no-repeat";
        bulletDiv.style.backgroundPosition = "center";
        bulletDiv.style.width = `${spec.size}px`;
        bulletDiv.style.height = `${spec.size}px`;
        bulletDiv.style.filter = spec.filter;
        bulletDiv.style.transform = "rotate(-90deg)";
        return bulletDiv;
      };
      document
        .getElementById("current-bullet-preview")
        .appendChild(createBulletPreview(currentSpec));
      if (nextSpec) {
        document
          .getElementById("next-bullet-preview")
          .appendChild(createBulletPreview(nextSpec));
        document
          .getElementById("confirm-bullet-upgrade-btn")
          .addEventListener("click", async () => {
            try {
              const result = await this.apiRequest("/api/upgrade", {
                method: "POST",
                body: JSON.stringify({
                  type: "bullet",
                  airplaneTier: selectedAirplane.tier,
                  airplaneStyle: selectedAirplane.style,
                }),
              });
              if (result && result.user) {
                this.userData = result.user;
                localStorage.setItem("userData", JSON.stringify(result.user));
                this.updateUI();
              }
              this.showNotification("گلوله با موفقیت ارتقا یافت!", "success");
              this.renderBulletUpgradeTab();
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
      container.innerHTML = "<p>خطا در بارگذاری اطلاعات.</p>";
      console.error("Error rendering bullet upgrade tab:", error);
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
        const error = new Error(`HTTP error! status: ${response.status}`);
        error.response = response;
        throw error;
      }
      return await response.json();
    } catch (error) {
      console.error("API request failed:", error);
      throw error;
    }
  }

  async loadLeaderboard(type = "daily") {
    try {
      this.insertLoader(document.getElementById("leaderboard-content"));
      document.getElementById("leaderboard-podium").innerHTML = "";
      const leaderboard = await this.apiRequest(
        `/api/leaderboard?type=${type}`
      );
      this.renderLeaderboard(leaderboard);
      if (leaderboard) this.updateResetTimer(leaderboard.endDate);
    } catch (error) {
      console.error(`Error loading ${type} leaderboard:`, error);
      document.getElementById("leaderboard-content").innerHTML =
        "<p>خطا در بارگذاری</p>";
    }
  }

  renderLeaderboard(leaderboard) {
    const podiumContainer = document.getElementById("leaderboard-podium");
    const listContainer = document.getElementById("leaderboard-content");
    const userRankContainer = document.getElementById("user-rank-display");
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
    this.updateResetTimer(leaderboard.endDate);
    const rankings = leaderboard.rankings;
    const podiumPlayers = rankings.slice(0, 3);
    podiumPlayers.forEach((player, index) => {
      const rank = index + 1;
      const podiumItem = document.createElement("div");
      podiumItem.className = `podium-item rank-${rank}`;
      const score = (player.wins || 0) - (player.losses || 0);
      podiumItem.innerHTML = `<div class="podium-name">${
        player.user?.username || "Unknown"
      }</div><div class="podium-score">امتیاز: ${score}</div>`;
      podiumContainer.appendChild(podiumItem);
    });
    this.animateListItems("#leaderboard-podium");

    const otherPlayers = rankings.slice(3);
    otherPlayers.forEach((player, index) => {
      const rank = index + 4;
      const listItem = document.createElement("div");
      listItem.className = "leaderboard-item";
      const wins = player.wins || 0;
      const losses = player.losses || 0;
      const score = wins - losses;
      listItem.innerHTML = `<div class="leaderboard-rank">${rank}</div><div class="leaderboard-user"><strong>${
        player.user?.username || "Unknown"
      }</strong><div class="leaderboard-score"><span>امتیاز: ${score}</span> <small>(برد: ${wins} / باخت: ${losses})</small></div></div>`;
      listContainer.appendChild(listItem);
    });
    this.animateListItems("#leaderboard-content");

    const userIndex = rankings.findIndex(
      (p) => p.user && p.user._id === this.userData._id
    );
    if (userIndex !== -1) {
      const userRankData = rankings[userIndex];
      const rank = userIndex + 1;
      const wins = userRankData.wins || 0;
      const losses = userRankData.losses || 0;
      const score = wins - losses;
      userRankContainer.innerHTML = `<div class="leaderboard-rank">${rank}</div><div class="leaderboard-user"><strong>(شما) ${this.userData.username}</strong><div class="leaderboard-score"><span>امتیاز: ${score}</span> <small>(برد: ${wins} / باخت: ${losses})</small></div></div>`;
    }
  }

  updateResetTimer(endDate) {
    const timerElement = document.getElementById("reset-timer");
    if (!timerElement) return;
    if (this.leaderboardTimer) clearInterval(this.leaderboardTimer);
    const endTime = new Date(endDate).getTime();
    const updateTimer = () => {
      const distance = endTime - new Date().getTime();
      if (distance < 0) {
        timerElement.textContent = "۰۰:۰۰:۰۰";
        clearInterval(this.leaderboardTimer);
        return;
      }
      const days = Math.floor(distance / 86400000);
      const hours = Math.floor((distance % 86400000) / 3600000);
      const minutes = Math.floor((distance % 3600000) / 60000);
      const seconds = Math.floor((distance % 60000) / 1000);
      timerElement.textContent =
        days > 0
          ? `${days} روز و ${String(hours).padStart(2, "0")} ساعت`
          : `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
              2,
              "0"
            )}:${String(seconds).padStart(2, "0")}`;
    };
    updateTimer();
    this.leaderboardTimer = setInterval(updateTimer, 1000);
  }

  async loadShopItems() {
    const container = document.getElementById("potions-tab");
    if (!container) return;
    this.insertLoader(container);
    try {
      const potions = await this.apiRequest("/api/potions");
      if (!potions || potions.length === 0) {
        container.innerHTML = "<p>هیچ معجونی در فروشگاه موجود نیست.</p>";
        return;
      }
      container.innerHTML = "";
      potions.forEach((potion) => {
        const item = document.createElement("div");
        item.className = "selection-item";
        item.innerHTML = `<img src="${potion.imagePath}" alt="${potion.name}"><p>${potion.name}</p><span class="price">${potion.price} سکه</span><button class="buy-btn menu-btn">خرید</button>`;
        item
          .querySelector(".buy-btn")
          .addEventListener("click", () =>
            this.buyPotion(potion._id, potion.name, potion.price)
          );
        container.appendChild(item);
      });
      this.animateListItems("#potions-tab");
    } catch (error) {
      console.error("Error loading shop items:", error);
      container.innerHTML = "<p>خطا در بارگذاری فروشگاه.</p>";
    }
  }

  async buyPotion(potionId, potionName, potionPrice) {
    try {
      this.userData = await this.apiRequest("/api/user");
      if (this.userData.coins < potionPrice) {
        this.showNotification("سکه شما کافی نیست!", "error");
        window.militarySoundManager.play("error");
        return;
      }
      const result = await this.apiRequest("/api/shop/buy-potion", {
        method: "POST",
        body: JSON.stringify({ potionId, quantity: 1 }),
      });
      this.userData.coins = result.coins;
      localStorage.setItem("userData", JSON.stringify(this.userData));
      this.updateUI();
      this.showNotification(
        `معجون ${potionName} با موفقیت خریداری شد`,
        "success"
      );
      window.militarySoundManager.play("purchase");
    } catch (error) {
      this.showNotification("خطا در هنگام خرید", "error");
      window.militarySoundManager.play("error");
      console.error("Error buying potion:", error);
    }
  }

  showNotification(message, type = "info") {
    const container = document.getElementById("notification-container");
    if (!container) return;
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.textContent = message;
    container.appendChild(notification);
    setTimeout(() => notification.remove(), 3900);
  }

  getTgId() {
    if (window.Telegram && window.Telegram.WebApp) {
      return window.Telegram.WebApp.initDataUnsafe.user.id.toString();
    }
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("tgid") || localStorage.getItem("tgid") || "12345678";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.menuManager = new MenuManager();
});
