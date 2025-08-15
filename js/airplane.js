import { Bullet } from "./bullet.js";

export class Airplane {
  constructor(imageUrl, width = 100, height = 100) {
    this.width = width;
    this.height = height;
    this.isDragging = false;
    this.offsetX = 0;
    this.offsetY = 0;
    this.bullets = [];

    // Create airplane element
    this.element = document.createElement("div");
    this.element.className = "airplane";
    this.element.style.width = `${width}px`;
    this.element.style.height = `${height}px`;
    this.element.style.position = "absolute";
    this.element.style.transformOrigin = "center center";

    this.setImage(imageUrl);
    document.body.appendChild(this.element);
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
    this.element.addEventListener("mousedown", this.handleStart.bind(this));
    this.element.addEventListener(
      "touchstart",
      this.handleTouchStart.bind(this),
      { passive: false }
    );
  }

  handleStart(e) {
    this.isDragging = true;
    const rect = this.element.getBoundingClientRect();
    this.offsetX = e.clientX - rect.left;
    this.offsetY = e.clientY - rect.top;

    document.addEventListener("mousemove", this.handleMove.bind(this));
    document.addEventListener("mouseup", this.handleEnd.bind(this));
    e.preventDefault();
  }

  handleTouchStart(e) {
    this.isDragging = true;
    const touch = e.touches[0];
    const rect = this.element.getBoundingClientRect();
    this.offsetX = touch.clientX - rect.left;
    this.offsetY = touch.clientY - rect.top;

    document.addEventListener("touchmove", this.handleTouchMove.bind(this), {
      passive: false,
    });
    document.addEventListener("touchend", this.handleEnd.bind(this));
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
    this.isDragging = false;
    document.removeEventListener("mousemove", this.handleMove.bind(this));
    document.removeEventListener("mouseup", this.handleEnd.bind(this));
    document.removeEventListener("touchmove", this.handleTouchMove.bind(this));
    document.removeEventListener("touchend", this.handleEnd.bind(this));
  }

  updatePosition(clientX, clientY) {
    const x = clientX - this.offsetX;
    const y = clientY - this.offsetY;
    const maxX = window.innerWidth - this.width;
    const maxY = window.innerHeight - this.height;

    this.element.style.left = `${Math.min(Math.max(0, x), maxX)}px`;
    this.element.style.top = `${Math.min(Math.max(0, y), maxY)}px`;
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

  shoot(bulletImage, size, speed, rotation) {
    const pos = this.getPosition();
    // Calculate center position with proper offsets
    const bulletX = pos.x + pos.width / 2;
    const bulletY = pos.y + pos.height / 2;

    const bullet = new Bullet(
      bulletImage,
      bulletX,
      bulletY,
      size, // size
      speed, // speed
      rotation // rotation
    );

    this.bullets.push(bullet);
    return bullet;
  }

  remove() {
    this.element.remove();
    this.bullets.forEach((bullet) => bullet.remove());
  }
}
