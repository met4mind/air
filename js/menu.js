// مدیریت منوها و ناوبری

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
  }

  bindEvents() {
    // دکمه‌های منوی اصلی
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

    // دکمه‌های بازگشت
    document.querySelectorAll(".back-btn").forEach((btn) => {
      btn.addEventListener("click", () => this.showMainMenu());
    });

    // تب‌های فروشگاه
    document.querySelectorAll(".tab-btn").forEach((tab) => {
      tab.addEventListener("click", (e) => this.switchShopTab(e.target));
    });

    // دکمه‌های ارتقاء
    document.querySelectorAll(".upgrade-btn").forEach((btn) => {
      btn.addEventListener("click", (e) =>
        this.upgradeFeature(e.target.dataset.type)
      );
    });

    // دکمه‌های دریافت سکه رایگان
    document
      .getElementById("invite-btn")
      .addEventListener("click", () => this.inviteFriends());
    document.querySelectorAll(".offer-btn").forEach((btn) => {
      btn.addEventListener("click", (e) =>
        this.checkMembership(e.target.dataset.platform)
      );
    });
  }

  async loadUserData() {
    try {
      // دریافت اطلاعات کاربر از سرور
      const tgid = this.getTgId();

      // Use a fallback if server is not available
      try {
        const response = await fetch(`${BASEURL}/api/user?tgid=${tgid}`);
        if (response.ok) {
          this.userData = await response.json();
        } else {
          // Use default data if server is not available
          this.userData = this.getDefaultUserData();
        }
      } catch (error) {
        console.warn("Server not available, using default data");
        this.userData = this.getDefaultUserData();
      }

      this.updateUI();
    } catch (error) {
      console.error("Error loading user data:", error);
      this.userData = this.getDefaultUserData();
      this.updateUI();
    }
  }

  getDefaultUserData() {
    return {
      stars: 0,
      coins: 100,
      damageLevel: 1,
      speedLevel: 1,
      healthLevel: 1,
      airplaneTier: 1,
      username: "Player",
    };
  }

  updateUI() {
    if (!this.userData) return;

    // به روزرسانی اطلاعات کاربر
    document.getElementById(
      "user-stars"
    ).textContent = `${this.userData.stars} ★`;
    document.getElementById(
      "user-coins"
    ).textContent = `${this.userData.coins} سکه`;

    // به روزرسانی سطوح ارتقاء
    document.getElementById("damage-level").textContent =
      this.userData.damageLevel;
    document.getElementById("speed-level").textContent =
      this.userData.speedLevel;
    document.getElementById("health-level").textContent =
      this.userData.healthLevel;
    document.getElementById("airplane-tier").textContent =
      this.userData.airplaneTier;

    // محاسبه هزینه‌های ارتقاء
    document.getElementById("damage-cost").textContent =
      this.userData.damageLevel * 50;
    document.getElementById("speed-cost").textContent =
      this.userData.speedLevel * 40;
    document.getElementById("health-cost").textContent =
      this.userData.healthLevel * 60;
    document.getElementById("airplane-cost").textContent =
      this.userData.airplaneTier * 100;
  }

  showMenu(menuId) {
    // مخفی کردن همه منوها
    document.querySelectorAll(".menu-container").forEach((menu) => {
      menu.classList.add("hidden");
    });

    // نمایش منوی انتخاب شده
    document.getElementById(menuId).classList.remove("hidden");
    this.currentMenu = menuId;

    // بارگذاری محتوای خاص منو
    if (menuId === "leaderboard-menu") {
      this.loadLeaderboard();
    } else if (menuId === "shop-menu") {
      this.loadShopItems();
    }
  }

  showMainMenu() {
    this.showMenu("main-menu");
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
    // مخفی کردن منوها و نمایش بازی
    document.querySelectorAll(".menu-container").forEach((menu) => {
      menu.classList.add("hidden");
    });
    document.getElementById("game-container").classList.remove("hidden");

    // شروع بازی
    if (typeof startGame === "function") {
      startGame();
    }
  }

  async loadLeaderboard() {
    try {
      const response = await fetch(`${BASEURL}/api/leaderboard`);
      const leaderboard = await response.json();
      this.renderLeaderboard(leaderboard);

      // به روزرسانی تایمر
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

  async loadShopItems() {
    try {
      // بارگذاری معجون‌ها
      const response = await fetch(`${BASEURL}/api/potions`);
      const potions = await response.json();
      this.renderPotions(potions);
    } catch (error) {
      console.error("Error loading shop items:", error);
    }
  }

  renderPotions(potions) {
    const container = document.getElementById("potions-tab");
    container.innerHTML = "";

    potions.forEach((potion) => {
      const potionItem = document.createElement("div");
      potionItem.className = "shop-item";

      potionItem.innerHTML = `
                <img src="${potion.imagePath}" alt="${potion.name}">
                <div class="shop-item-info">
                    <h4>${potion.name}</h4>
                    <p>${potion.description}</p>
                    <p>قیمت: ${potion.price} سکه</p>
                </div>
                <button class="buy-btn" data-id="${potion._id}">خرید</button>
            `;

      container.appendChild(potionItem);
    });

    // اضافه کردن event listener برای دکمه‌های خرید
    document.querySelectorAll(".buy-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => this.buyPotion(e.target.dataset.id));
    });
  }

  switchShopTab(clickedTab) {
    // غیرفعال کردن همه تب‌ها
    document.querySelectorAll(".tab-btn").forEach((tab) => {
      tab.classList.remove("active");
    });

    // مخفی کردن همه محتواها
    document.querySelectorAll(".tab-content").forEach((content) => {
      content.classList.remove("active");
    });

    // فعال کردن تب انتخاب شده
    clickedTab.classList.add("active");
    const tabName = clickedTab.dataset.tab;
    document.getElementById(`${tabName}-tab`).classList.add("active");
  }

  async upgradeFeature(featureType) {
    try {
      const response = await fetch(`${BASEURL}/api/upgrade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tgid: this.getTgId(),
          type: featureType,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        alert("ارتقاء با موفقیت انجام شد!");
        this.userData.coins = result.coins;
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
      const response = await fetch(`${BASEURL}/api/shop/buy-potion`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
    // در مینی اپ تلگرام، از ویژگی اشتراک‌گذاری استفاده می‌شود
    if (window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.shareUrl(
        `https://t.me/your_bot_username?start=ref_${this.getTgId()}`,
        "به بازی جنگنده‌های هوایی بپیوندید و ۱۰ سکه رایگان دریافت کنید!"
      );
    } else {
      // برای محیط‌های تست
      prompt(
        "لینک دعوت خود را کپی کنید:",
        `https://t.me/your_bot_username?start=ref_${this.getTgId()}`
      );
    }
  }

  async checkMembership(platform) {
    try {
      const response = await fetch(`${BASEURL}/api/check-membership`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
    // در مینی اپ تلگرام، از WebApp.initData استفاده می‌شود
    if (window.Telegram && window.Telegram.WebApp) {
      return window.Telegram.WebApp.initDataUnsafe.user.id;
    }

    // برای محیط‌های تست، از پارامتر URL استفاده می‌شود
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("tgid") || "test-user";
  }
}

// مقداردهی اولیه منوها هنگام بارگذاری صفحه
document.addEventListener("DOMContentLoaded", () => {
  window.menuManager = new MenuManager();
});
