export class OpponentAirplane {
  constructor(imageUrl, width = 100, height = 100, config) {
    this.width = width;
    this.height = height;
    this.x = 0;
    this.y = 0;
    this.CONFIG = config;

    this.element = document.createElement("div");
    this.element.className = "opponent-airplane";
    this.element.style.width = `${width}px`;
    this.element.style.height = `${height}px`;

    this.setImage(imageUrl);
    document.getElementById("game-container").appendChild(this.element);
  }

  setImage(imageUrl) {
    if (imageUrl) {
      this.element.style.backgroundImage = `url('${imageUrl}')`;
      this.element.style.backgroundSize = "contain";
    }
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this.element.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(180deg)`;
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