const BASEURL = "http://localhost:3000";

class MenuManager {
  constructor() {
    this.currentMenu = "main-menu";
    this.userData = null;
    this.allPotions = [];
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
      const [userData, allPlanes] = await Promise.all([
        this.apiRequest("/api/user"),
        this.apiRequest("/api/assets/airplanes"),
      ]);
      this.userData = userData;

      const currentTier = userData.airplaneTier || 1;
      const currentPlane = allPlanes.find((p) =>
        p.name.includes(`Tier ${currentTier}`)
      );
      const nextPlane = allPlanes.find((p) =>
        p.name.includes(`Tier ${currentTier + 1}`)
      );

      let upgradeHTML = "";
      if (nextPlane) {
        const cost = currentTier * 100;
        const canAfford = userData.coins >= cost;
        upgradeHTML = `
                    <div class="upgrade-info">
                        <div class="plane-display">
                            <h3>هواپیمای فعلی</h3>
                            <img src="${
                              currentPlane.image
                            }" alt="Current Plane"><p>Tier ${currentTier}</p>
                        </div>
                        <div class="upgrade-arrow">→</div>
                        <div class="plane-display">
                            <h3>ارتقا به</h3>
                            <img src="${
                              nextPlane.image
                            }" alt="Next Plane"><p>Tier ${currentTier + 1}</p>
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
      } else {
        upgradeHTML = `
                    <div class="upgrade-info"><div class="plane-display">
                        <h3>هواپیمای شما</h3><img src="${currentPlane.image}" alt="Current Plane"><p>Tier ${currentTier}</p>
                    </div></div>
                    <p class="max-level">شما به بالاترین سطح ارتقا رسیده‌اید!</p>
                `;
      }

      container.innerHTML = upgradeHTML;

      if (nextPlane) {
        document
          .getElementById("confirm-upgrade-btn")
          .addEventListener("click", async () => {
            try {
              await this.apiRequest("/api/upgrade", {
                method: "POST",
                body: JSON.stringify({ type: "airplane" }),
              });
              window.soundManager.play("upgrade");
              this.showUpgradeMenu();
            } catch (error) {
              window.soundManager.play("error");
              alert("ارتقا ناموفق بود.");
            }
          });
      }
    } catch (error) {
      container.innerHTML = "<p>خطا در دریافت اطلاعات ارتقا.</p>";
    }
  }

  showShopMenu() {
    this.showMenu("shop-menu");
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

  renderLeaderboard(leaderboard) {
    const container = document.getElementById("leaderboard-content");
    const userRankContainer = document.getElementById("user-rank-display");
    container.innerHTML = "";
    userRankContainer.innerHTML = "شما در این رتبه‌بندی حضور ندارید.";

    if (!this.userData || !leaderboard || !leaderboard.rankings) return;

    let userFound = false;

    leaderboard.rankings.forEach((item, index) => {
      const rankItem = document.createElement("div");
      const rankClass = index < 3 ? `rank-${index + 1}` : "";
      rankItem.className = `leaderboard-item ${rankClass}`;

      // <<<< بخش جدید برای نمایش امتیاز، برد و باخت >>>>
      const wins = item.wins || 0;
      const losses = item.losses || 0;
      const score = wins - losses;

      rankItem.innerHTML = `
            <div class="leaderboard-rank">${index + 1}</div>
            <div class="leaderboard-user">
                <strong>${item.user?.username || "Unknown"}</strong>
                <div class="leaderboard-score">
                    <span>امتیاز: ${score}</span>
                    <small>(برد: ${wins} / باخت: ${losses})</small>
                </div>
            </div>
        `;
      container.appendChild(rankItem);

      if (item.user && item.user._id === this.userData._id) {
        userFound = true;
        userRankContainer.innerHTML = `
                <div class="leaderboard-rank">${index + 1}</div>
                <div class="leaderboard-user">
                    <strong>(شما) ${this.userData.username}</strong>
                    <div class="leaderboard-score">
                       <span>امتیاز: ${score}</span>
                       <small>(برد: ${wins} / باخت: ${losses})</small>
                    </div>
                </div>
            `;
      }
    });

    if (!userFound) {
      // اگر کاربر در لیست نبود، آمار کلی او را نمایش بده (اختیاری)
      const totalScore =
        (this.userData.wins || 0) - (this.userData.losses || 0);
      userRankContainer.innerHTML = `
          <div class="leaderboard-rank">--</div>
          <div class="leaderboard-user">
              <strong>(شما) ${this.userData.username}</strong>
              <div class="leaderboard-score">
                 <span>امتیاز کل: ${totalScore}</span>
              </div>
          </div>
      `;
    }
  }

  updateResetTimer(endDate) {
    const timerElement = document.getElementById("reset-timer");
    const endTime = new Date(endDate).getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const distance = endTime - now;

      if (distance < 0) {
        timerElement.textContent = "۰۰:۰۰:۰۰";
        return;
      }

      const hours = Math.floor(
        (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      timerElement.textContent = `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    };

    updateTimer();
    setInterval(updateTimer, 1000);
  }

  // در فایل menu.js - متد loadShopItems را با این کد جایگزین کنید
  // در فایل js/menu.js -> کلاس MenuManager

  // تابع loadShopItems را با این کد جایگزین کنید
  async loadShopItems() {
    const container = document.getElementById("potions-tab");
    if (!container) return;
    container.innerHTML = "در حال بارگذاری...";
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
        item.innerHTML = `
                <img src="${potion.imagePath}" alt="${potion.name}">
                <p>${potion.name}</p>
                <span class="price">${potion.price} سکه</span>
                <button class="buy-btn menu-btn">خرید</button>
            `;
        item
          .querySelector(".buy-btn")
          .addEventListener("click", () =>
            this.buyPotion(potion._id, potion.name, potion.price)
          );
        container.appendChild(item);
      });
    } catch (error) {
      container.innerHTML = "<p>خطا در بارگذاری فروشگاه.</p>";
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

  async buyPotion(potionId, potionName, potionPrice) {
    try {
      if (this.userData.coins < potionPrice) {
        this.showNotification("سکه شما کافی نیست!", "error");
        window.soundManager.play("error");
        return;
      }

      const result = await this.apiRequest("/api/shop/buy-potion", {
        method: "POST",
        body: JSON.stringify({ potionId, quantity: 1 }),
      });

      // آپدیت اطلاعات کاربر
      this.userData.coins = result.coins;
      localStorage.setItem("userData", JSON.stringify(this.userData));
      this.updateUI();

      this.showNotification(`معجون ${potionName} خریداری شد`, "success");
      window.soundManager.play("purchase");
    } catch (error) {
      const errorData = await error.response?.json();
      this.showNotification(errorData?.error || "خطا در هنگام خرید", "error");
      window.soundManager.play("error");
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
  switchShopTab(clickedTab) {
    // 1. Remove active class from all tab buttons
    document.querySelectorAll(".shop-tabs .tab-btn").forEach((tab) => {
      tab.classList.remove("active");
    });
    // 2. Add active class to the clicked button
    clickedTab.classList.add("active");

    // 3. Hide all tab content
    document
      .querySelectorAll(".shop-content .tab-content")
      .forEach((content) => {
        content.classList.remove("active");
      });

    // 4. Show the corresponding tab content
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
