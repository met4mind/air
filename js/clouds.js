// Updated Cloud class in clouds.js
export class Cloud {
  // در فایل: js/clouds.js
  // این تابع را به طور کامل جایگزین تابع قبلی کنید.

  constructor(options) {
    // <<<< تغییر اصلی اینجاست: اضافه کردن مقادیر پیش‌فرض برای سرعت >>>>
    this.backwardSpeed = options.backwardSpeed || 1.5; // اگر سرعتی تعریف نشده بود، از 1.5 استفاده کن
    this.horizontalSpeed = options.horizontalSpeed || 0; // اگر سرعتی تعریف نشده بود، از 0 استفاده کن

    this.size = options.size;
    this.rotation = options.rotation;
    this.active = true;

    this.element = document.createElement("div");
    this.element.className = "cloud";

    // ... بقیه کدهای constructor بدون تغییر باقی می‌ماند ...
    this.element.style.width = `${this.size}px`;
    this.element.style.height = `${this.size}px`;
    this.element.style.opacity = "0"; // Start invisible
    this.element.style.transition = "opacity 1s ease-in";
    this.element.style.transform = `rotate(${this.rotation}deg)`;

    const img = new Image();
    img.src = options.imageUrl;
    img.onload = () => {
      this.element.style.backgroundImage = `url('${options.imageUrl}')`;
      setTimeout(() => {
        this.element.style.opacity = "1";
      }, 100);
    };
    img.onerror = () => {
      this.element.style.backgroundColor = "rgba(255,255,255,0.5)";
      this.element.style.opacity = "1";
    };

    this.position = {
      x: options.startX,
      y: -this.size - Math.random() * 100,
    };
    this.setPosition(this.position.x, this.position.y);

    document.body.appendChild(this.element);
    this.animate();
  }
  setPosition(x, y) {
    this.position = { x, y };
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
  }

  animate() {
    if (!this.active) return;

    this.position.y += this.backwardSpeed;
    this.position.x += this.horizontalSpeed;

    // Remove if completely off screen at bottom
    if (this.position.y > window.innerHeight + this.size) {
      this.remove();
      return;
    }

    // Horizontal wrapping
    if (this.position.x > window.innerWidth + this.size) {
      this.position.x = -this.size;
    } else if (this.position.x < -this.size) {
      this.position.x = window.innerWidth;
    }

    this.setPosition(this.position.x, this.position.y);
    requestAnimationFrame(this.animate.bind(this));
  }

  remove() {
    this.active = false;
    this.element.style.transition = "opacity 0.5s ease-out";
    this.element.style.opacity = "0";
    setTimeout(() => {
      if (this.element.parentNode) {
        this.element.remove();
      }
    }, 500);
  }
}
