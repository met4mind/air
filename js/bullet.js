export class Bullet {
  // در فایل: js/bullet.js
  // این تابع را به طور کامل جایگزین تابع قبلی کنید.

  constructor(
    imageUrl,
    x,
    y,
    size = 20,
    speed = 5,
    rotationDeg = 0,
    isOpponent = false
  ) {
    this.size = size;
    this.speed = speed;
    this.rotationDeg = rotationDeg;
    this.active = true;
    this.isOpponent = isOpponent;
    this.radians = (rotationDeg * Math.PI) / 180;

    this.element = document.createElement("div");
    this.element.className = "bullet";
    this.element.style.width = `${size}px`;
    this.element.style.height = `${size}px`;
    this.element.style.position = "absolute";
    this.element.style.transformOrigin = "center center";

    if (isOpponent) {
      this.element.classList.add("opponent-bullet");
    }

    if (imageUrl) {
      this.element.style.backgroundImage = `url('${imageUrl}')`;
      this.element.style.backgroundSize = "contain";
      this.element.style.backgroundRepeat = "no-repeat";
      this.element.style.backgroundPosition = "center";

      // <<<< تغییر اصلی اینجاست: اضافه کردن 90 درجه به چرخش ظاهری >>>>
      // این کار فقط ظاهر تیر را می‌چرخاند و مسیر حرکت آن را تغییر نمی‌دهد
      this.element.style.transform = `rotate(${rotationDeg + -90}deg)`;
    } else {
      this.element.style.backgroundColor = isOpponent ? "red" : "yellow";
    }

    this.setPosition(x, y);
    document.body.appendChild(this.element);
    this.animate();
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this.element.style.left = `${x - this.size / 2}px`;
    this.element.style.top = `${y - this.size / 2}px`;
  }

  animate() {
    if (!this.active) return;

    // حرکت گلوله بر اساس زاویه - اصلاح شده
    const angleRad = this.radians;
    this.x += Math.sin(angleRad) * this.speed;

    if (this.isOpponent) {
      // گلوله حریف به سمت پایین حرکت می‌کند
      this.y += Math.abs(Math.cos(angleRad)) * this.speed;
    } else {
      // گلوله کاربر به سمت بالا حرکت می‌کند
      this.y -= Math.abs(Math.cos(angleRad)) * this.speed;
    }

    this.setPosition(this.x, this.y);

    // Remove if off screen
    if (
      this.y < -this.size ||
      this.y > window.innerHeight ||
      this.x < -this.size ||
      this.x > window.innerWidth + this.size
    ) {
      this.remove();
      return;
    }

    requestAnimationFrame(this.animate.bind(this));
  }
  remove() {
    this.active = false;
    if (this.element.parentNode) {
      this.element.remove();
    }
  }

  getPosition() {
    const rect = this.element.getBoundingClientRect();
    return {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    };
  }
}
