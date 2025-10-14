import { Bullet } from "./bullet.js";

export class OpponentAirplane {
  constructor(imageUrl, width = 100, height = 100, config) {
    this.width = width;
    this.height = height;
    this.bullets = [];
    this.CONFIG = config;

    this.element = document.createElement("div");
    this.element.className = "opponent-airplane";
    this.element.style.width = `${width}px`;
    this.element.style.height = `${height}px`;
    this.element.style.position = "absolute";
    this.element.style.transformOrigin = "center center";
    this.element.style.pointerEvents = "none";

    this.setImage(imageUrl);
    document.getElementById("game-container").appendChild(this.element);
  }

  setImage(imageUrl) {
    if (imageUrl) {
      this.element.style.backgroundImage = `url('${imageUrl}')`;
      this.element.style.backgroundSize = "contain";
      this.element.style.backgroundRepeat = "no-repeat";
      this.element.style.backgroundPosition = "center";
      this.element.style.backgroundColor = "transparent";
    } else {
      this.element.style.backgroundColor = "blue";
    }
  }

  // تابع setPosition با transform بهینه شده است
  setPosition(x, y) {
    // ترکیب حرکت و چرخش در یک transform
    this.element.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(180deg)`;

    this.percentPosition = {
      x: x / window.innerWidth,
      y: y / window.innerHeight,
    };
  }

  getPosition() {
    const rect = this.element.getBoundingClientRect();
    return {
      x: rect.left,
      y: rect.top,
      width: this.width,
      height: this.height,
    };
  }
  
  shoot(bulletImage, speed, rotation = 180, bulletSpec = {}) {
    const pos = this.getPosition();
    const bulletX = pos.x + pos.width / 2;
    const bulletY = pos.y + pos.height;
    
    const size = bulletSpec.size || (this.CONFIG ? this.CONFIG.bullets.size : 20);
    const filter = bulletSpec.filter || "none";

    const bullet = new Bullet(
      bulletImage,
      bulletX,
      bulletY,
      size,
      speed,
      rotation,
      true, // isOpponent
      filter
    );

    this.bullets.push(bullet);
    return bullet;
  }
  
  remove() {
    if (this.element && this.element.parentNode) {
        this.element.remove();
    }
    this.bullets.forEach((bullet) => bullet.remove());
  }
}
