export class RoadManager {
  constructor(config) {
    this.config = config;
    this.roadElement = null;
  }
  init() {
    this.createRoad();
  }
  createRoad() {
    this.roadElement = document.createElement("div");
    this.roadElement.className = "road";
    const imageUrl = this.config.roads.images[0];
    const img = new Image();
    img.onload = () => {
      this.roadElement.style.backgroundImage = `url('${imageUrl}')`;
      this.roadElement.style.backgroundSize = "100% auto";
      this.roadElement.style.backgroundRepeat = "repeat-y";
      this.roadElement.style.backgroundPosition = "center top";
    };
    img.onerror = () => {
      this.roadElement.style.backgroundColor = "#555";
    };
    img.src = imageUrl;
    document.getElementById("game-container").appendChild(this.roadElement);
  }
  update() {
    if (!this.roadElement) return;
    const currentPos = parseFloat(this.roadElement.style.backgroundPositionY) || 0;
    const newPos = currentPos + this.config.roads.speed;
    this.roadElement.style.backgroundPositionY = `${newPos}px`;
  }
}