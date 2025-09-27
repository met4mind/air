import { Bullet } from "./bullet.js";

export class AirplaneWingman {
  constructor(mainAirplane, config) {
    this.mainAirplane = mainAirplane;
    this.config = config;
    this.movementTime = 0;
    this.currentOffset = config.baseXOffset;
    this.lastMainX = this.mainAirplane.getPosition().x;
    this.lastMainY = this.mainAirplane.getPosition().y;

    this.leftWingman = this.createWingman("left");
    this.rightWingman = this.createWingman("right");

    this.startFollowing();
  }

  createWingman(side) {
    const wingman = document.createElement("div");
    wingman.className = `wingman wingman-${side}`;
    wingman.style.width = `${this.config.width}px`;
    wingman.style.height = `${this.config.height}px`;
    wingman.style.position = "absolute";
    wingman.style.transition = `left ${this.config.followDelay}ms ease-out, top ${this.config.followDelay}ms ease-out`;

    // چرخش همراهان حریف
    if (this.config.isOpponent) {
      wingman.style.transform = "rotate(180deg)";
    }

    const imgUrl = this.config.images?.[side] || this.config.image;
    if (imgUrl) {
      wingman.style.backgroundImage = `url('${imgUrl}')`;
      wingman.style.backgroundSize = "contain";
      wingman.style.backgroundRepeat = "no-repeat";
      wingman.style.backgroundPosition = "center";
    }

    document.getElementById("game-container").appendChild(wingman);
    return wingman;
  }

  startFollowing() {
    const followLoop = () => {
      if (!this.mainAirplane || !this.mainAirplane.element.parentNode) {
        this.remove();
        return;
      }

      const mainPos = this.mainAirplane.getPosition();

      // برای همراهان بازیکن، از منطق نرم و پویای دنبال کردن استفاده می‌شود.
      // برای همراهان حریف، از یک فاصله ثابت استفاده می‌شود تا تداخلی پیش نیاید.
      if (!this.config.isOpponent) {
        // منطق حرکت برای بازیکن اصلی
        const dx = mainPos.x - this.lastMainX;
        const dy = mainPos.y - this.lastMainY;
        const distanceMoved = Math.sqrt(dx * dx + dy * dy);
        const movementIntensity = Math.min(
          1,
          distanceMoved * 0.01 * this.config.movementSensitivity
        );

        if (distanceMoved > 2) {
          this.currentOffset =
            this.config.baseXOffset -
            movementIntensity * this.config.maxPullDistance;
        } else {
          this.currentOffset +=
            (this.config.baseXOffset - this.currentOffset) *
            this.config.snapBackSpeed;
        }

        this.lastMainX = mainPos.x;
        this.lastMainY = mainPos.y;
      } else {
        // برای همراهان حریف، همیشه یک فاصله ثابت در نظر بگیر
        this.currentOffset = 20;
      }

      this.updateWingmanPositions(mainPos);
      requestAnimationFrame(followLoop);
    };

    followLoop();
  }

  updateWingmanPositions(mainPos) {
    this.movementTime += this.config.movementSpeed;

    const waveX = Math.sin(this.movementTime) * this.config.movementAmplitude;
    const waveY =
      Math.cos(this.movementTime * 0.8) * this.config.movementAmplitude * 0.5;

    // منطق موقعیت‌یابی بر اساس اینکه همراه برای بازیکن است یا حریف
    if (this.config.isOpponent) {
      // منطق موقعیت‌یابی برای حریف (که هواپیمایش 180 درجه چرخیده)
      const opponentLeftX =
        mainPos.x + mainPos.width + this.currentOffset + waveX;
      const opponentRightX =
        mainPos.x - this.currentOffset - this.config.width + waveX;

      // +++ FIX: The Y position was calculated incorrectly from the bottom of the plane. +++
      // It should be calculated from the top, just like the player's wingman.
      const opponentYPos = mainPos.y + this.config.yOffset + waveY;

      this.leftWingman.style.left = `${opponentLeftX}px`;
      this.leftWingman.style.top = `${opponentYPos}px`;
      this.rightWingman.style.left = `${opponentRightX}px`;
      this.rightWingman.style.top = `${opponentYPos}px`;
    } else {
      // منطق موقعیت‌یابی برای بازیکن اصلی
      const playerLeftX =
        mainPos.x - this.currentOffset - this.config.width + waveX;
      const playerRightX =
        mainPos.x + mainPos.width + this.currentOffset + waveX;
      const playerYPos = mainPos.y + this.config.yOffset + waveY;

      this.leftWingman.style.left = `${playerLeftX}px`;
      this.leftWingman.style.top = `${playerYPos}px`;
      this.rightWingman.style.left = `${playerRightX}px`;
      this.rightWingman.style.top = `${playerYPos}px`;
    }
  }

  shoot() {
    const leftPos = this.getWingmanPosition(this.leftWingman);
    const rightPos = this.getWingmanPosition(this.rightWingman);

    const bullets = [];
    const angle = -90; // زاویه شلیک رو به بالا

    const leftBullet = new Bullet(
      this.config.bulletImage,
      leftPos.x + leftPos.width / 2,
      leftPos.y,
      this.config.bulletSize,
      this.config.bulletSpeed,
      angle
    );
    leftBullet.damage = this.config.damage || 1;
    bullets.push(leftBullet);

    const rightBullet = new Bullet(
      this.config.bulletImage,
      rightPos.x + rightPos.width / 2,
      rightPos.y,
      this.config.bulletSize,
      this.config.bulletSpeed,
      angle
    );
    rightBullet.damage = this.config.damage || 1;
    bullets.push(rightBullet);

    return bullets;
  }

  getWingmanPosition(wingman) {
    return {
      x: wingman.offsetLeft,
      y: wingman.offsetTop,
      width: wingman.offsetWidth,
      height: wingman.offsetHeight,
    };
  }

  remove() {
    if (this.leftWingman && this.leftWingman.parentNode)
      this.leftWingman.remove();
    if (this.rightWingman && this.rightWingman.parentNode)
      this.rightWingman.remove();
  }
}
