export class RoadManager {
  constructor(config) {
    this.config = config;
    this.currentRoadIndex = 0;
    this.roadElement = null;
    this.isTransitioning = false;
    this.setupCloudCover();
  }

  setupCloudCover() {
    this.cloudCover = document.createElement("div");
    this.cloudCover.className = "cloud-cover";
    document.body.appendChild(this.cloudCover);
  }

  init() {
    this.createRoad(this.config.roads.images[0]);
    this.startRoadRotation();
  }

  createRoad(imageUrl) {
    if (this.roadElement) {
      this.roadElement.remove();
    }

    this.roadElement = document.createElement("div");
    this.roadElement.className = "road";

    const img = new Image();
    img.onload = () => {
      this.roadElement.style.backgroundImage = `url('${imageUrl}')`;
      this.roadElement.style.backgroundSize = "100% auto";
      this.roadElement.style.backgroundRepeat = "repeat-y";
      this.roadElement.style.backgroundPosition = "center top";
    };
    img.onerror = () => {
      console.error("Failed to load road image:", imageUrl);
      this.roadElement.style.backgroundColor = "#555";
    };
    img.src = imageUrl;

    document.body.appendChild(this.roadElement);
  }

  startRoadRotation() {
    setInterval(() => {
      if (this.isTransitioning) return;
      this.isTransitioning = true;

      // Show cloud cover
      this.cloudCover.style.background = "rgba(255,255,255,0.8)";

      setTimeout(() => {
        // Move to next road image
        this.currentRoadIndex =
          (this.currentRoadIndex + 1) % this.config.roads.images.length;
        this.createRoad(this.config.roads.images[this.currentRoadIndex]);

        // Hide cloud cover
        this.cloudCover.style.background = "rgba(255,255,255,0)";
        this.isTransitioning = false;
      }, this.config.roads.transitionDuration / 2);
    }, 30000); // Change road every 30 seconds
  }

  update() {
    if (this.isTransitioning || !this.roadElement) return;

    const currentPos =
      parseFloat(this.roadElement.style.backgroundPositionY) || 0;
    const newPos = currentPos + this.config.roads.speed;

    // Reset position when we've scrolled one full image height
    if (newPos >= this.config.roads.height) {
      this.roadElement.style.backgroundPositionY = "0px";
    } else {
      this.roadElement.style.backgroundPositionY = `${newPos}px`;
    }
  }
}
