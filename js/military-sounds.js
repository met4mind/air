// مدیریت صداهای نظامی
class MilitarySoundManager {
  constructor() {
    this.sounds = {};
    this.enabled = true;
    this.init();
  }

  init() {
    // پیش‌بارگذاری صداها
    this.preloadSounds();

    // اضافه کردن event listener برای کلیک‌ها
    this.setupClickListeners();
  }

  preloadSounds() {
    const soundPaths = {
      buttonClick: "assets/sounds/ui/button_click.wav",
      upgrade: "assets/sounds/ui/upgrade.wav",
      purchase: "assets/sounds/ui/purchase.wav",
      tabSwitch: "assets/sounds/ui/tab_switch.wav",
      error: "assets/sounds/ui/error.wav",
      success: "assets/sounds/ui/success.wav",
      radar: "assets/sounds/ui/radar.wav",
    };

    for (const [name, path] of Object.entries(soundPaths)) {
      this.sounds[name] = new Audio(path);
      this.sounds[name].volume = 0.6;
    }
  }

  setupClickListeners() {
    // کلیه دکمه‌ها
    document.addEventListener("click", (e) => {
      if (
        e.target.matches(
          ".menu-btn, .upgrade-btn, .offer-btn, .back-btn, .tab-btn, .nav-btn, .cancel-button"
        )
      ) {
        this.play("buttonClick");
      }
    });

    // تب‌ها
    document.addEventListener("click", (e) => {
      if (e.target.matches(".tab-btn")) {
        this.play("tabSwitch");
      }
    });

    // ارتقاء
    document.addEventListener("click", (e) => {
      if (
        e.target.matches(
          "#confirm-plane-upgrade-btn, #confirm-bullet-upgrade-btn"
        )
      ) {
        this.play("upgrade");
      }
    });

    // خرید
    document.addEventListener("click", (e) => {
      if (e.target.matches(".buy-btn")) {
        this.play("purchase");
      }
    });
  }

  play(soundName) {
    if (!this.enabled || !this.sounds[soundName]) return;

    try {
      // ایجاد یک کپی از صدا برای پخش همزمان
      const sound = this.sounds[soundName].cloneNode();
      sound.volume = this.sounds[soundName].volume;
      sound.play().catch((e) => console.log("Audio play prevented:", e));
    } catch (e) {
      console.log("Audio error:", e);
    }
  }

  toggle(enabled) {
    this.enabled = enabled;
  }
}

// مقداردهی اولیه هنگامی که DOM بارگذاری شد
document.addEventListener("DOMContentLoaded", () => {
  window.militarySoundManager = new MilitarySoundManager();
});
