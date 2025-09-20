import { Bullet } from "./bullet.js";

export class OpponentAirplane {
  constructor(imageUrl, width = 100, height = 100, config) {
    this.width = width;
    this.height = height;
    this.bullets = [];
    this.CONFIG = config;
    // Create opponent airplane element
    this.element = document.createElement("div");
    this.element.className = "opponent-airplane";
    this.element.style.width = `${width}px`;
    this.element.style.height = `${height}px`;
    this.element.style.position = "absolute";
    this.element.style.transformOrigin = "center center";
    this.element.style.pointerEvents = "none"; // غیرفعال کردن تعامل

    this.setImage(imageUrl);
    document.getElementById("game-container").appendChild(this.element);
  }

  setImage(imageUrl) {
    if (imageUrl) {
      this.element.style.backgroundImage = `url('${imageUrl}')`;
      this.element.style.backgroundSize = "contain";
      this.element.style.backgroundRepeat = "no-repeat";
      this.element.style.backgroundPosition = "center";
      this.element.style.backgroundColor = "transparent";

      // چرخاندن هواپیمای حریف به سمت پایین
      this.element.style.transform = "rotate(180deg)";
    } else {
      this.element.style.backgroundColor = "blue"; // رنگ متفاوت برای تشخیص
    }
  }

  setPosition(x, y) {
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;

    // ذخیره موقعیت درصدی
    this.percentPosition = {
      x: x / window.innerWidth,
      y: y / window.innerHeight,
    };
  }

  getPosition() {
    return {
      x: parseInt(this.element.style.left) || 0,
      y: parseInt(this.element.style.top) || 0,
      width: this.width,
      height: this.height,
    };
  }

  // تغییر تابع shoot برای پذیرش rotation دلخواه
  // در فایل js/opponentAirplane.js
  // تابع shoot را به طور کامل جایگزین کنید
  shoot(bulletImage, speed, rotation = 180, bulletSpec = {}) {
    const pos = this.getPosition();
    const bulletX = pos.x + pos.width / 2;
    const bulletY = pos.y + pos.height;

    // <<<< اصلاح اصلی اینجاست >>>>
    // حالا به CONFIG دسترسی داریم و کد بدون خطا اجرا می‌شود
    const size =
      bulletSpec.size || (this.CONFIG ? this.CONFIG.bullets.size : 20);
    const filter = bulletSpec.filter || "none";

    const bullet = new Bullet(
      bulletImage,
      bulletX,
      bulletY,
      size,
      speed,
      rotation,
      true, // isOpponent
      filter
    );

    this.bullets.push(bullet);
    return bullet;
  }
  remove() {
    this.element.remove();
    this.bullets.forEach((bullet) => bullet.remove());
  }
}
