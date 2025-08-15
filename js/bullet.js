export class Bullet {
  constructor(imageUrl, x, y, size = 20, speed = 5, rotationDeg = 0) {
    this.size = size;
    this.speed = speed;
    this.rotationDeg = rotationDeg;
    this.active = true;
    this.radians = (rotationDeg * Math.PI) / 180; // Convert to radians once

    // Create bullet element
    this.element = document.createElement("div");
    this.element.className = "bullet";
    this.element.style.width = `${size}px`;
    this.element.style.height = `${size}px`;
    this.element.style.position = "absolute";
    this.element.style.transformOrigin = "center center";

    // Set image with rotation
    if (imageUrl) {
      this.element.style.backgroundImage = `url('${imageUrl}')`;
      this.element.style.backgroundSize = "contain";
      this.element.style.backgroundRepeat = "no-repeat";
      this.element.style.backgroundPosition = "center";
      this.element.style.transform = `rotate(${rotationDeg}deg)`;
    } else {
      this.element.style.backgroundColor = "yellow";
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

    // Calculate movement based on rotation angle
    this.x += Math.sin(this.radians) * this.speed;
    this.y -= Math.cos(this.radians) * this.speed;

    this.setPosition(this.x, this.y);

    // Remove if off screen (all sides)
    if (
      this.y < -this.size ||
      this.y > window.innerHeight ||
      this.x < -this.size ||
      this.x > window.innerWidth
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
}
