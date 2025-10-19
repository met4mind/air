export class Bullet {
  constructor(imageUrl, x, y, size = 20, speed = 300, rotationDeg = 0, isOpponent = false, filter = "none") {
    this.x = x;
    this.y = y;
    this.size = size;
    this.speed = speed; // Speed is now in pixels per second
    this.rotationDeg = rotationDeg;
    this.active = true;
    this.radians = (rotationDeg * Math.PI) / 180;

    this.element = document.createElement("div");
    this.element.className = "bullet";
    this.element.style.width = `${size}px`;
    this.element.style.height = `${size}px`;
    this.element.style.filter = filter;
    
    if (imageUrl) {
      this.element.style.backgroundImage = `url('${imageUrl}')`;
      this.element.style.backgroundSize = "contain";
    }

    this.setPosition(this.x, this.y);

    const gameContainer = document.getElementById("game-container");
    if (gameContainer) gameContainer.appendChild(this.element);
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
    const visualRotation = this.rotationDeg + 90; // Assumes base image points up
    this.element.style.transform = `translate3d(${x - this.size / 2}px, ${y - this.size / 2}px, 0) rotate(${visualRotation}deg)`;
  }

  update(deltaTime) {
    if (!this.active) return;

    // Calculate movement based on speed (pixels per second) and elapsed time
    this.x += this.speed * Math.cos(this.radians) * deltaTime;
    this.y += this.speed * Math.sin(this.radians) * deltaTime;

    this.setPosition(this.x, this.y);

    // Check boundaries and remove if off-screen
    if (this.y < -this.size || this.y > window.innerHeight + this.size || this.x < -this.size || this.x > window.innerWidth + this.size) {
      this.remove();
    }
  }

  remove() {
    this.active = false;
    if (this.element.parentNode) this.element.remove();
  }

  getPosition() {
    // getBoundingClientRect is still best for accurate collision detection
    return this.element.getBoundingClientRect();
  }
}