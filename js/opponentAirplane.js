import { Bullet } from "./bullet.js";

export class OpponentAirplane {
  constructor(imageUrl, width = 100, height = 100) {
    this.width = width;
    this.height = height;
    this.bullets = [];

    // Create opponent airplane element
    this.element = document.createElement("div");
    this.element.className = "opponent-airplane";
    this.element.style.width = `${width}px`;
    this.element.style.height = `${height}px`;
    this.element.style.position = "absolute";
    this.element.style.transformOrigin = "center center";
    this.element.style.pointerEvents = "none"; // غیرفعال کردن تعامل

    this.setImage(imageUrl);
    document.body.appendChild(this.element);
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
  shoot(bulletImage, size, speed, rotation = 180) {
    const pos = this.getPosition();
    // Calculate center position with proper offsets
    const bulletX = pos.x + pos.width / 2;
    const bulletY = pos.y + pos.height;

    // گلوله‌های حریف با rotation مشخص شده شلیک می‌شوند
    const bullet = new Bullet(
      bulletImage,
      bulletX,
      bulletY,
      size,
      speed,
      rotation, // استفاده از rotation ارسال شده
      true // isOpponent
    );

    this.bullets.push(bullet);
    return bullet;
  }

  remove() {
    this.element.remove();
    this.bullets.forEach((bullet) => bullet.remove());
  }
}
