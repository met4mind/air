const BASEURL = "http://localhost:3000";

class MenuManager {
  constructor() {
    this.currentMenu = "main-menu";
    this.userData = null;
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadUserData();
    this.startDataSync();
  }

  bindEvents() {
    document
      .getElementById("play-btn")
      .addEventListener("click", () => this.startGame());
    document
      .getElementById("leaderboard-btn")
      .addEventListener("click", () => this.showLeaderboard());
    document
      .getElementById("upgrade-btn")
      .addEventListener("click", () => this.showUpgradeMenu());
    document
      .getElementById("shop-btn")
      .addEventListener("click", () => this.showShopMenu());
    document
      .getElementById("free-coins-btn")
      .addEventListener("click", () => this.showFreeCoinsMenu());

    document.querySelectorAll(".back-btn").forEach((btn) => {
      btn.addEventListener("click", () => this.showMainMenu());
    });

    document.querySelectorAll(".tab-btn").forEach((tab) => {
      tab.addEventListener("click", (e) => this.switchShopTab(e.target));
    });

    document.querySelectorAll(".upgrade-btn").forEach((btn) => {
      btn.addEventListener("click", (e) =>
        this.upgradeFeature(e.target.dataset.type)
      );
    });

    document
      .getElementById("invite-btn")
      .addEventListener("click", () => this.inviteFriends());
    document.querySelectorAll(".offer-btn").forEach((btn) => {
      btn.addEventListener("click", (e) =>
        this.checkMembership(e.target.dataset.platform)
      );
    });
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
    await this.loadShopItems(); // تغییر: اطمینان از بارگذاری آیتم‌ها
  }

  showMenu(menuId) {
    document.querySelectorAll(".menu-container").forEach((menu) => {
      menu.classList.add("hidden");
    });

    document.getElementById(menuId).classList.remove("hidden");
    this.currentMenu = menuId;

    if (menuId === "leaderboard-menu") {
      this.loadLeaderboard();
    } else if (menuId === "shop-menu") {
      this.loadShopItems();
    }
  }

  showMainMenu() {
    this.showMenu("main-menu");
    this.displayOwnedPotions();
    this.displayOwnedAirplanes();
    this.displayOwnedBullets();
  }

  showLeaderboard() {
    this.showMenu("leaderboard-menu");
  }

  showUpgradeMenu() {
    this.showMenu("upgrade-menu");
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

  async loadLeaderboard() {
    try {
      const leaderboard = await this.apiRequest(`/api/leaderboard`); // تغییر: await مستقیم
      this.renderLeaderboard(leaderboard);
      this.updateResetTimer(leaderboard.endDate);
    } catch (error) {
      console.error("Error loading leaderboard:", error);
    }
  }

  renderLeaderboard(leaderboard) {
    const container = document.getElementById("leaderboard-content");
    container.innerHTML = "";

    leaderboard.rankings.forEach((item, index) => {
      const rankItem = document.createElement("div");
      rankItem.className = "leaderboard-item";

      const rankClass = index < 3 ? `rank-${index + 1}` : "";

      rankItem.innerHTML = `
                <div class="leaderboard-rank ${rankClass}">${index + 1}</div>
                <div class="leaderboard-user">
                    <strong>${item.user.first_name} ${
        item.user.last_name || ""
      }</strong>
                    <span class="leaderboard-stars">${item.stars} ★</span>
                </div>
            `;

      container.appendChild(rankItem);
    });
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
  async loadShopItems() {
    try {
      const potions = await this.apiRequest(`/api/potions`);
      this.allPotions = potions; // جدید: کش کردن اطلاعات
      this.renderPotions(potions);
      this.displayOwnedPotions(); // جدید: آپدیت لیست معجون‌های قابل انتخاب
    } catch (error) {
      console.error("Error loading shop items:", error);
      this.showNotification("خطا در بارگذاری معجون‌ها", "error");
    }
  }

  async buyPotion(potionId) {
    try {
      const potion = this.allPotions.find((p) => p._id === potionId);
      if (!potion) {
        this.showNotification("معجون مورد نظر یافت نشد!", "error");
        return;
      }
      if (this.userData.coins < potion.price) {
        this.showNotification("سکه کافی برای خرید این معجون ندارید!", "error");
        return;
      }

      const result = await this.apiRequest(`/api/shop/buy-potion`, {
        // تغییر: await مستقیم
        method: "POST",
        body: JSON.stringify({ potionId, quantity: 1 }),
      });

      this.showNotification(
        `معجون ${potion.name} با موفقیت خریداری شد!`,
        "success"
      );
      // آپدیت مستقیم اطلاعات کاربر از پاسخ سرور
      this.userData.coins = result.coins;
      localStorage.setItem("userData", JSON.stringify(this.userData));
      this.loadUserData(); // به‌روزرسانی کامل
      await this.loadShopItems(); // رفرش کردن فروشگاه برای غیرفعال کردن دکمه‌ها
    } catch (error) {
      console.error("Error buying potion:", error);
      this.showNotification(error.message || "خطا در ارتباط با سرور", "error");
    }
  }

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
  async buyPotion(potionId) {
    try {
      const potion = this.getPotionById(potionId); // فرض می‌کنیم این متد وجود دارد
      if (!potion) {
        this.showNotification("معجون مورد نظر یافت نشد!", "error");
        return;
      }

      if (this.userData.coins < potion.price) {
        this.showNotification("سکه کافی برای خرید این معجون ندارید!", "error");
        return;
      }

      const response = await this.apiRequest(`/api/shop/buy-potion`, {
        method: "POST",
        body: JSON.stringify({
          tgid: this.getTgId(),
          potionId,
          quantity: 1,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        this.showNotification(
          `معجون ${potion.name} با موفقیت خریداری شد!`,
          "success"
        );
        this.userData.coins = result.coins;
        localStorage.setItem("userData", JSON.stringify(this.userData));
        this.updateUI();

        // به‌روزرسانی وضعیت دکمه‌های خرید
        this.loadShopItems();
      } else {
        this.showNotification(result.error || "خطا در خرید معجون", "error");
      }
    } catch (error) {
      console.error("Error buying potion:", error);
      this.showNotification("خطا در ارتباط با سرور", "error");
    }
  }

  // اضافه کردن متد کمکی برای نمایش نوتیفیکیشن
  showNotification(message, type = "info") {
    // ایجاد یا استفاده از سیستم نوتیفیکیشن موجود
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.textContent = message;

    // اضافه کردن به DOM
    document.body.appendChild(notification);

    // حذف خودکار پس از چند ثانیه
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  // اضافه کردن متد کمکی برای پیدا کردن معجون بر اساس ID
  getPotionById(potionId) {
    // این متد فرضی است - باید با داده‌های واقعی پر شود
    const potions = this.getAvailablePotions(); // باید پیاده‌سازی شود
    return potions.find((p) => p._id === potionId);
  }
  switchShopTab(clickedTab) {
    document.querySelectorAll(".tab-btn").forEach((tab) => {
      tab.classList.remove("active");
    });

    document.querySelectorAll(".tab-content").forEach((content) => {
      content.classList.remove("active");
    });

    clickedTab.classList.add("active");
    const tabName = clickedTab.dataset.tab;
    document.getElementById(`${tabName}-tab`).classList.add("active");
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

  async buyPotion(potionId) {
    try {
      const response = await this.apiRequest(`/api/shop/buy-potion`, {
        method: "POST",
        body: JSON.stringify({
          tgid: this.getTgId(),
          potionId,
          quantity: 1,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        alert("خرید با موفقیت انجام شد!");
        this.userData.coins = result.coins;
        localStorage.setItem("userData", JSON.stringify(this.userData));
        this.updateUI();
      } else {
        alert(result.error);
      }
    } catch (error) {
      console.error("Error buying potion:", error);
      alert("خطا در خرید معجون");
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
