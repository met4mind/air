import { Bullet } from "./bullet.js";

export class AirplaneWingman {
  constructor(mainAirplane, config) {
    this.mainAirplane = mainAirplane;
    this.config = config;
    this.movementTime = 0;
    this.currentOffset = config.baseXOffset; // استفاده از یک متغیر برای فاصله هر دو طرف
    this.lastMainX = this.mainAirplane.getPosition().x;
    this.lastMainY = this.mainAirplane.getPosition().y;

    // ایجاد همراهان با فاصله یکسان
    this.leftWingman = this.createWingman("left");
    this.rightWingman = this.createWingman("right");

    // شروع انیمیشن
    this.startFollowing();
  }

  createWingman(side) {
    const wingman = document.createElement("div");
    wingman.className = `wingman wingman-${side}`;
    wingman.style.width = `${this.config.width}px`;
    wingman.style.height = `${this.config.height}px`;
    wingman.style.position = "absolute";
    wingman.style.transition = `transform ${this.config.followDelay}ms ease-out`;

    const imgUrl = this.config.images?.[side] || this.config.image;
    if (imgUrl) {
      wingman.style.backgroundImage = `url('${imgUrl}')`;
      wingman.style.backgroundSize = "contain";
      wingman.style.backgroundRepeat = "no-repeat";
      wingman.style.backgroundPosition = "center";
    }

    document.body.appendChild(wingman);
    return wingman;
  }

  startFollowing() {
    const followLoop = () => {
      const mainPos = this.mainAirplane.getPosition();
      const dx = mainPos.x - this.lastMainX;
      const dy = mainPos.y - this.lastMainY;
      const distanceMoved = Math.sqrt(dx * dx + dy * dy);

      // محاسبه شدت حرکت
      const movementIntensity = Math.min(
        1,
        distanceMoved * 0.01 * this.config.movementSensitivity
      );

      if (distanceMoved > 2) {
        // کشیده شدن به سمت هواپیما
        this.currentOffset =
          this.config.baseXOffset -
          movementIntensity * this.config.maxPullDistance;
      } else {
        // بازگشت به موقعیت اصلی
        this.currentOffset +=
          (this.config.baseXOffset - this.currentOffset) *
          this.config.snapBackSpeed;
      }

      this.lastMainX = mainPos.x;
      this.lastMainY = mainPos.y;
      this.updateWingmanPositions(mainPos);

      requestAnimationFrame(followLoop);
    };

    followLoop();
  }

  updateWingmanPositions(mainPos) {
    this.movementTime += this.config.movementSpeed;

    // محاسبه موقعیت همراه چپ
    const leftWaveX =
      Math.sin(this.movementTime) * this.config.movementAmplitude;
    const leftWaveY =
      Math.cos(this.movementTime * 0.8) * this.config.movementAmplitude * 0.5;
    const leftX =
      mainPos.x - this.currentOffset - mainPos.width / 2 + leftWaveX; // تنظیم دقیق موقعیت چپ
    const leftY = mainPos.y + this.config.yOffset + leftWaveY;

    // محاسبه موقعیت همراه راست
    const rightWaveX =
      Math.sin(this.movementTime * 1.2) * this.config.movementAmplitude;
    const rightWaveY =
      Math.cos(this.movementTime * 0.7) * this.config.movementAmplitude * 0.5;
    const rightX =
      mainPos.x +
      mainPos.width +
      this.currentOffset -
      mainPos.width / 2 +
      rightWaveX; // تنظیم دقیق موقعیت راست
    const rightY = mainPos.y + this.config.yOffset + rightWaveY;

    // اعمال موقعیت‌ها
    this.leftWingman.style.transform = `translate(${leftX}px, ${leftY}px)`;
    this.rightWingman.style.transform = `translate(${rightX}px, ${rightY}px)`;
  }

  shoot() {
    const leftPos = this.getWingmanPosition(this.leftWingman);
    const rightPos = this.getWingmanPosition(this.rightWingman);

    const bullets = [];

    bullets.push(
      new Bullet(
        this.config.bulletImage,
        leftPos.x + leftPos.width / 2,
        leftPos.y + leftPos.height / 2,
        this.config.bulletSize,
        this.config.bulletSpeed,
        this.config.bulletAngle
      )
    );

    bullets.push(
      new Bullet(
        this.config.bulletImage,
        rightPos.x + rightPos.width / 2,
        rightPos.y + rightPos.height / 2,
        this.config.bulletSize,
        this.config.bulletSpeed,
        this.config.bulletAngle
      )
    );

    return bullets;
  }

  getWingmanPosition(wingman) {
    const rect = wingman.getBoundingClientRect();
    return {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    };
  }

  remove() {
    if (this.leftWingman.parentNode) this.leftWingman.remove();
    if (this.rightWingman.parentNode) this.rightWingman.remove();
  }
}
