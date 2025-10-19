export class Airplane {
  constructor(imageUrl, width = 100, height = 100) {
    this.width = width;
    this.height = height;
    this.isDragging = false;
    this.offsetX = 0;
    this.offsetY = 0;
    this.x = 0;
    this.y = 0;

    this.element = document.createElement("div");
    this.element.className = "airplane";
    this.element.style.width = `${width}px`;
    this.element.style.height = `${height}px`;
    this.element.style.touchAction = "none"; // Important for mobile performance

    this.setImage(imageUrl);
    document.getElementById("game-container").appendChild(this.element);
    
    this.boundHandleMove = this.handleMove.bind(this);
    this.boundHandleTouchMove = this.handleTouchMove.bind(this);
    this.boundHandleEnd = this.handleEnd.bind(this);
    this.setupEvents();
  }

  setImage(imageUrl) {
    if (imageUrl) {
      this.element.style.backgroundImage = `url('${imageUrl}')`;
      this.element.style.backgroundSize = "contain";
    }
  }

  setupEvents() {
    this.element.addEventListener("mousedown", this.handleStart.bind(this));
    this.element.addEventListener("touchstart", this.handleStart.bind(this), { passive: false });
  }

  handleStart(e) {
    if (this.isDragging) return;
    this.isDragging = true;
    e.preventDefault();
    
    const event = e.touches ? e.touches[0] : e;
    const rect = this.element.getBoundingClientRect();
    this.offsetX = event.clientX - rect.left;
    this.offsetY = event.clientY - rect.top;

    document.addEventListener("mousemove", this.boundHandleMove);
    document.addEventListener("touchmove", this.boundHandleTouchMove, { passive: false });
    document.addEventListener("mouseup", this.boundHandleEnd);
    document.addEventListener("touchend", this.boundHandleEnd);
  }

  handleMove(e) {
    if (!this.isDragging) return;
    e.preventDefault();
    this.updatePosition(e.clientX, e.clientY);
  }

  handleTouchMove(e) {
    if (!this.isDragging) return;
    e.preventDefault();
    this.updatePosition(e.touches[0].clientX, e.touches[0].clientY);
  }

  handleEnd() {
    if (!this.isDragging) return;
    this.isDragging = false;
    document.removeEventListener("mousemove", this.boundHandleMove);
    document.removeEventListener("touchmove", this.boundHandleTouchMove);
    document.removeEventListener("mouseup", this.boundHandleEnd);
    document.removeEventListener("touchend", this.boundHandleEnd);
  }

  updatePosition(clientX, clientY) {
    let x = clientX - this.offsetX;
    let y = clientY - this.offsetY;

    const maxX = window.innerWidth - this.width;
    const maxY = window.innerHeight - this.height;

    x = Math.max(0, Math.min(x, maxX));
    y = Math.max(0, Math.min(y, maxY));

    this.setPosition(x, y);

    if (window.networkManager) {
      window.networkManager.sendMove(x / window.innerWidth, y / window.innerHeight);
    }
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this.element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  getPosition() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  remove() {
    if (this.element.parentNode) {
      this.element.remove();
    }
  }
}