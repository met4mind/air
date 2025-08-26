export class Bullet {
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

    // Create bullet element
    this.element = document.createElement("div");
    this.element.className = "bullet";
    this.element.style.width = `${size}px`;
    this.element.style.height = `${size}px`;
    this.element.style.position = "absolute";
    this.element.style.transformOrigin = "center center";

    // اضافه کردن کلاس برای تشخیص گلوله حریف
    if (isOpponent) {
      this.element.classList.add("opponent-bullet");
    }

    // Set image with rotation
    if (imageUrl) {
      this.element.style.backgroundImage = `url('${imageUrl}')`;
      this.element.style.backgroundSize = "contain";
      this.element.style.backgroundRepeat = "no-repeat";
      this.element.style.backgroundPosition = "center";
      this.element.style.transform = `rotate(${rotationDeg}deg)`;
    } else {
      this.element.style.backgroundColor = isOpponent ? "red" : "yellow";
    }

    // Set initial position (centered)
    this.setPosition(x, y);

    // Add to DOM
    document.body.appendChild(this.element);

    // Start animation
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

    // حرکت گلوله بر اساس زاویه
    if (this.isOpponent) {
      // گلوله حریف به سمت پایین حرکت می‌کند
      this.y += Math.abs(Math.cos(this.radians)) * this.speed;
    } else {
      // گلوله کاربر به سمت بالا حرکت می‌کند
      this.y -= Math.abs(Math.cos(this.radians)) * this.speed;
    }

    this.setPosition(this.x, this.y);

    // Remove if off screen
    if (this.y < -this.size || this.y > window.innerHeight) {
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
