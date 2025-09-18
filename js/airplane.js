// در فایل: js/airplane.js
// کل محتوای این فایل را با کد زیر جایگزین کنید.

import { Bullet } from "./bullet.js";

export class Airplane {
  constructor(imageUrl, width = 100, height = 100) {
    this.width = width;
    this.height = height;
    this.isDragging = false;
    this.offsetX = 0;
    this.offsetY = 0;
    this.bullets = [];

    // مرحله ۱: متدهای کنترل‌کننده رویداد را یکبار برای همیشه bind می‌کنیم
    // و آن‌ها را در پراپرتی‌های کلاس ذخیره می‌کنیم تا همیشه به یک تابع واحد دسترسی داشته باشیم.
    this.boundHandleMove = this.handleMove.bind(this);
    this.boundHandleTouchMove = this.handleTouchMove.bind(this);
    this.boundHandleEnd = this.handleEnd.bind(this);
    this.boundHandleStart = this.handleStart.bind(this);
    this.boundHandleTouchStart = this.handleTouchStart.bind(this);

    // ساختن عنصر هواپیما
    this.element = document.createElement("div");
    this.element.className = "airplane";
    this.element.style.width = `${width}px`;
    this.element.style.height = `${height}px`;
    this.element.style.position = "absolute";
    this.element.style.transformOrigin = "center center";

    this.setImage(imageUrl);
    document.getElementById("game-container").appendChild(this.element);
    this.setupEvents();
  }

  setImage(imageUrl) {
    if (imageUrl) {
      this.element.style.backgroundImage = `url('${imageUrl}')`;
      this.element.style.backgroundSize = "contain";
      this.element.style.backgroundRepeat = "no-repeat";
      this.element.style.backgroundPosition = "center";
      this.element.style.backgroundColor = "transparent";
    } else {
      this.element.style.backgroundColor = "red";
    }
  }

  setupEvents() {
    // اینجا از متدهای bind شده برای شروع درگ استفاده می‌کنیم
    this.element.addEventListener("mousedown", this.boundHandleStart);
    this.element.addEventListener("touchstart", this.boundHandleTouchStart, {
      passive: false,
    });
  }

  handleStart(e) {
    if (this.isDragging) return; // جلوگیری از شروع درگ جدید وقتی یکی در جریان است
    this.isDragging = true;

    const rect = this.element.getBoundingClientRect();
    this.offsetX = e.clientX - rect.left;
    this.offsetY = e.clientY - rect.top;

    // مرحله ۲: برای اضافه کردن listener ها از متدهای bind شده در constructor استفاده می‌کنیم
    document.addEventListener("mousemove", this.boundHandleMove);
    document.addEventListener("mouseup", this.boundHandleEnd);
    e.preventDefault();
  }

  handleTouchStart(e) {
    if (this.isDragging) return;
    this.isDragging = true;

    const touch = e.touches[0];
    const rect = this.element.getBoundingClientRect();
    this.offsetX = touch.clientX - rect.left;
    this.offsetY = touch.clientY - rect.top;

    document.addEventListener("touchmove", this.boundHandleTouchMove, {
      passive: false,
    });
    document.addEventListener("touchend", this.boundHandleEnd);
    e.preventDefault();
  }

  handleMove(e) {
    if (!this.isDragging) return;
    this.updatePosition(e.clientX, e.clientY);
    e.preventDefault();
  }

  handleTouchMove(e) {
    if (!this.isDragging) return;
    const touch = e.touches[0];
    this.updatePosition(touch.clientX, touch.clientY);
    e.preventDefault();
  }

  handleEnd() {
    if (!this.isDragging) return;
    this.isDragging = false;

    // مرحله ۳: برای حذف listener ها دقیقاً از همان متدهای bind شده استفاده می‌کنیم
    // این کار تضمین می‌کند که listener ها به درستی حذف شوند
    document.removeEventListener("mousemove", this.boundHandleMove);
    document.removeEventListener("mouseup", this.boundHandleEnd);
    document.removeEventListener("touchmove", this.boundHandleTouchMove);
    document.removeEventListener("touchend", this.boundHandleEnd);
  }

  updatePosition(clientX, clientY) {
    const x = clientX - this.offsetX;
    const y = clientY - this.offsetY;

    const maxX = window.innerWidth - this.width;
    const maxY = window.innerHeight - this.height;

    this.element.style.left = `${Math.min(Math.max(0, x), maxX)}px`;
    this.element.style.top = `${Math.min(Math.max(0, y), maxY)}px`;

    this.percentPosition = {
      x: (parseInt(this.element.style.left) || 0) / window.innerWidth,
      y: (parseInt(this.element.style.top) || 0) / window.innerHeight,
    };

    if (window.networkManager) {
      window.networkManager.sendMove(
        this.percentPosition.x,
        this.percentPosition.y
      );
    }
  }

  setPosition(x, y) {
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
  }

  getPosition() {
    return {
      x: parseInt(this.element.style.left) || 0,
      y: parseInt(this.element.style.top) || 0,
      width: this.width,
      height: this.height,
    };
  }

  shoot(bulletImage, size, speed, rotation = 0) {
    const pos = this.getPosition();
    const bulletX = pos.x + pos.width / 2;
    const bulletY = pos.y;

    const bullet = new Bullet(
      bulletImage,
      bulletX,
      bulletY,
      size,
      speed,
      rotation
    );

    this.bullets.push(bullet);
    return bullet;
  }

  remove() {
    this.element.remove();
    this.bullets.forEach((bullet) => bullet.remove());
  }
}
