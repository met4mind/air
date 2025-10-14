export class Bullet {
  // در فایل: js/bullet.js
  // این تابع را به طور کامل جایگزین تابع قبلی کنید.

  // در فایل js/bullet.js
  // در فایل js/bullet.js
  // در فایل js/bullet.js

  // در فایل js/bullet.js

constructor(
    imageUrl,
    x,
    y,
    size = 20,
    speed = 5,
    rotationDeg = 0,
    isOpponent = false,
    filter = "none"
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
    // این دو خط حذف یا کامنت می‌شوند چون دیگر به صورت مستقیم استفاده نمی‌شوند
    // this.element.style.left = '0px';
    // this.element.style.top = '0px';
    this.element.style.transformOrigin = "center center";
    this.element.style.filter = filter;

    if (isOpponent) {
      this.element.classList.add("opponent-bullet");
    }

    if (imageUrl) {
      this.element.style.backgroundImage = `url('${imageUrl}')`;
      this.element.style.backgroundSize = "contain";
      this.element.style.backgroundRepeat = "no-repeat";
      this.element.style.backgroundPosition = "center";
    } else {
      this.element.style.backgroundColor = isOpponent ? "red" : "yellow";
    }

    // مقدار اولیه transform را اینجا ست می‌کنیم
    this.element.style.transform = `rotate(${rotationDeg}deg)`;
    
    this.setPosition(x, y);

    const gameContainer = document.getElementById("game-container");
    if (gameContainer) {
      gameContainer.appendChild(this.element);
    } else {
      document.body.appendChild(this.element);
    }

    this.animate();
  }
setPosition(x, y) {
    this.x = x;
    this.y = y;
    // به جای top و left، از transform استفاده می‌کنیم
    this.element.style.transform = `translate3d(${x - this.size / 2}px, ${y - this.size / 2}px, 0) rotate(${this.rotationDeg}deg)`;
  }
  animate() {
    if (!this.active) return;

    // <<<< شروع بخش اصلاح‌شده با منطق صحیح ریاضی >>>>
    const angleRad = this.radians;

    // محاسبه حرکت در محور X و Y با فرمول استاندارد
    // Math.cos برای محور افقی (X) و Math.sin برای محور عمودی (Y)
    this.x += this.speed * Math.cos(angleRad);
    this.y += this.speed * Math.sin(angleRad);

    this.setPosition(this.x, this.y);
    // <<<< پایان بخش اصلاح‌شده >>>>

    // حذف گلوله در صورت خروج از صفحه
    if (
      this.y < -this.size ||
      this.y > window.innerHeight + this.size ||
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
