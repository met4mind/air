import { CONFIG } from "./../config.js";
import { WarScene } from "./warScene.js";

class GameManager {
  constructor() {
    this.currentScene = null;
    this.scenes = {
      war: null,
      // می‌توانید صحنه‌های دیگر را اینجا اضافه کنید
      // menu: null,
      // shop: null,
      // gameOver: null
    };
  }

  async init() {
    // مقداردهی اولیه صحنه‌ها
    this.scenes.war = new WarScene(CONFIG);

    // شروع با صحنه جنگ
    await this.switchScene("war");

    // می‌توانید بعداً صحنه‌ها را تغییر دهید:
    // setTimeout(() => this.switchScene('menu'), 5000);
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
