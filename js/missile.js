export class Missile {
  constructor(options) {
    this.x = options.x || 0;
    this.y = options.y || 0;
    this.target = options.target || null; // The opponent airplane object
    this.missileType = options.missileType || "straight"; // 'straight' or 'homing'
    this.speed = options.speed || 5;
    this.damage = options.damage || 20;
    this.size = options.size || 30; // A base size in pixels
    this.active = true;

    this.element = document.createElement("div");
    this.element.className = "missile";
    this.element.style.position = "absolute";
    this.element.style.width = `${this.size}px`;
    this.element.style.height = `${this.size * 1.5}px`; // Missiles are often rectangular
    this.element.style.backgroundImage = "url('./assets/missiles/missile.png')";
    this.element.style.backgroundSize = "contain";
    this.element.style.backgroundRepeat = "no-repeat";
    this.element.style.backgroundPosition = "center";
    this.element.style.transformOrigin = "center center";

    // Append to the game container, not the body
    const gameContainer = document.getElementById("game-container");
    if (gameContainer) {
      gameContainer.appendChild(this.element);
    } else {
      console.error("Game container not found for missile!");
      return;
    }

    this.setPosition(this.x, this.y);
    this.animate();
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this.element.style.left = `${x - this.size / 2}px`;
    this.element.style.top = `${y - (this.size * 1.5) / 2}px`;
  }

  animate() {
    if (!this.active) return;

    // --- Homing Logic ---
    if (
      this.missileType === "homing" &&
      this.target &&
      this.target.element.parentNode
    ) {
      const targetPos = this.target.getPosition();
      const targetCenterX = targetPos.x + targetPos.width / 2;
      const targetCenterY = targetPos.y + targetPos.height / 2;

      // Calculate angle from missile to target
      const angleRad = Math.atan2(
        targetCenterY - this.y,
        targetCenterX - this.x
      );

      // Update position based on angle and speed
      this.x += Math.cos(angleRad) * this.speed;
      this.y += Math.sin(angleRad) * this.speed;

      // Rotate missile to face the target
      const angleDeg = angleRad * (180 / Math.PI);
      this.element.style.transform = `rotate(${angleDeg}deg)`;
    } else {
      // --- Straight Logic ---
      this.y -= this.speed;
      // Rotate missile to face upwards
      this.element.style.transform = "rotate(-90deg)";
    }

    this.setPosition(this.x, this.y);

    // Remove missile if it goes off-screen
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

  getPosition() {
    const rect = this.element.getBoundingClientRect();
    return {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    };
  }

  remove() {
    this.active = false;
    if (this.element.parentNode) {
      this.element.remove();
    }
  }
}
