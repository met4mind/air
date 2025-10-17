// --- js/bullet.js --- (نسخه بهینه شده)
export class Bullet {
  constructor(imageUrl, x, y, size = 20, speed = 5, rotationDeg = 0, isOpponent = false, filter = "none") {
    this.x = x; this.y = y; this.size = size; this.speed = speed;
    this.rotationDeg = rotationDeg; this.active = true;
    this.radians = (rotationDeg * Math.PI) / 180;
    this.element = document.createElement("div");
    this.element.className = "bullet";
    this.element.style.width = `${size}px`;
    this.element.style.height = `${size}px`;
    this.element.style.filter = filter;
    // این دو خط ضروری هستند تا transform درست کار کند
    this.element.style.top = '0'; 
    this.element.style.left = '0';
    this.element.style.willChange = 'transform';
    if (imageUrl) {
      this.element.style.backgroundImage = `url('${imageUrl}')`;
      this.element.style.backgroundSize = "contain";
    }
    this.setPosition(this.x, this.y);
    const gameContainer = document.getElementById("game-container");
    if (gameContainer) gameContainer.appendChild(this.element);
    this.animate();
  }
  setPosition(x, y) {
    this.x = x; this.y = y;
    const visualRotation = this.rotationDeg ;
    this.element.style.transform = `translate3d(${x - this.size / 2}px, ${y - this.size / 2}px, 0) rotate(${visualRotation}deg)`;
  }
  animate() {
    if (!this.active) return;
    this.x += this.speed * Math.cos(this.radians);
    this.y += this.speed * Math.sin(this.radians);
    this.setPosition(this.x, this.y);
    if (this.y < -this.size || this.y > window.innerHeight + this.size || this.x < -this.size || this.x > window.innerWidth + this.size) {
      this.remove(); return;
    }
    requestAnimationFrame(this.animate.bind(this));
  }
  remove() { this.active = false; if (this.element.parentNode) this.element.remove(); }
  getPosition() { return this.element.getBoundingClientRect(); }
}