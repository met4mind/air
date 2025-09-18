import { CONFIG } from "../config.js";

export class NetworkManager {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.userId = null;
    this.opponent = null;
    this.baseURL = CONFIG.BASEURL;

    // <<<< تغییر ۱: tgid را به عنوان یک پراپرتی کلاس اضافه می‌کنیم >>>>
    // در ابتدای کار، tgid را از localStorage می‌خوانیم تا لاگین خودکار کار کند
    this.tgid = localStorage.getItem("tgid") || null;

    // event handlers
    this.onHealthUpdate = null;
    this.onGameStart = null;
    this.onWaiting = null;
    this.onOpponentMove = null;
    this.onOpponentShoot = null;
    this.onYouHit = null;
    this.onGameOver = null;
    this.onOpponentDisconnected = null;
    this.onOpponentPotionActivate = null;
  }
  setTgid(tgid) {
    this.tgid = tgid;
    localStorage.setItem("tgid", tgid); // برای ذخیره‌سازی بین نشست‌ها (sessions)
    console.log(`Tgid in NetworkManager was set to: ${this.tgid}`); // برای دیباگ کردن
  }

  sendPotionActivate(potionId) {
    if (this.connected) {
      this.socket.send(
        JSON.stringify({
          type: "potion_activate",
          userId: this.userId,
          potionId: potionId,
        })
      );
    }
  }
  async apiRequest(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        headers: {
          "Content-Type": "application/json",
          // <<<< تغییر ۳: همیشه از پراپرتی کلاس استفاده می‌کنیم >>>>
          "x-tgid": this.tgid,
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("API request failed:", error);
      throw error;
    }
  }

  async register(username, password, tgid) {
    return this.apiRequest("/api/register", {
      method: "POST",
      body: JSON.stringify({ username, password, tgid }),
    });
  }

  async login(username, password, tgid) {
    return this.apiRequest("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password, tgid }),
    });
  }

  async getAirplanes() {
    return this.apiRequest("/api/assets/airplanes");
  }

  async getBullets() {
    return this.apiRequest("/api/assets/bullets");
  }

  connect() {
    const protocol = this.baseURL.startsWith("https") ? "wss:" : "ws:";
    const host = this.baseURL.replace(/^https?:\/\//, "");
    this.socket = new WebSocket(`${protocol}//${host}`);

    this.socket.onopen = () => {
      this.connected = true;
      console.log("Connected to server");
    };

    this.socket.onmessage = (event) => {
      this.handleMessage(JSON.parse(event.data));
    };

    this.socket.onclose = () => {
      this.connected = false;
      console.log("Disconnected from server");

      if (this.onOpponentDisconnected) {
        this.onOpponentDisconnected();
      }
    };
  }

  handleMessage(message) {
    switch (message.type) {
      case "waiting":
        if (this.onWaiting) this.onWaiting(message.message);
        break;

      case "game_start":
        this.opponent = message.opponent;
        if (this.onGameStart) this.onGameStart(message.opponent);
        break;

      case "opponent_move":
        if (this.onOpponentMove)
          this.onOpponentMove(message.percentX, message.percentY);
        break;

      case "opponent_shoot":
        if (this.onOpponentShoot)
          this.onOpponentShoot(
            message.percentX,
            message.percentY,
            message.rotation,
            message.isWingman
          );
        break;

      case "you_hit":
        if (this.onYouHit) this.onYouHit(message.damage);
        break;

      case "game_over":
        if (this.onGameOver) this.onGameOver(message.result);
        break;

      case "game_settings":
        if (this.onGameSettings) this.onGameSettings(message);
        break;

      case "opponent_disconnected":
        if (this.onOpponentDisconnected) this.onOpponentDisconnected();
        break;

      case "health_update":
        if (this.onHealthUpdate)
          this.onHealthUpdate(message.health, message.opponentHealth);
        break;
      case "health_update":
        if (this.onHealthUpdate)
          this.onHealthUpdate(message.health, message.opponentHealth);
        break;

      // <<<< این case جدید را اضافه کنید >>>>
      case "opponent_potion_activate":
        if (this.onOpponentPotionActivate)
          this.onOpponentPotionActivate(message.potionName);
        break;
    }
  }

  // در network.js
  sendLogin(
    username,
    airplane,
    airplaneName,
    bullets,
    bulletName,
    screenWidth,
    screenHeight,
    potionId // جدید
  ) {
    if (this.connected) {
      this.socket.send(
        JSON.stringify({
          type: "login",
          userId: this.userId,
          username: username,
          airplane: airplane,
          airplaneName: airplaneName,
          bullets: bullets,
          bulletName: bulletName,
          screenWidth: screenWidth,
          screenHeight: screenHeight,
          potionId: potionId || null, // جدید
        })
      );
    }
  }

  // در network.js - تابع sendMove
  // در network.js - تابع sendMove
  sendMove(percentX, percentY) {
    if (this.connected) {
      this.socket.send(
        JSON.stringify({
          type: "move",
          userId: this.userId,
          percentX: percentX,
          percentY: percentY,
        })
      );
    }
  }

  // در network.js - تابع sendShoot
  sendShoot(percentX, percentY, rotation, isWingman = false) {
    if (this.connected) {
      this.socket.send(
        JSON.stringify({
          type: "shoot",
          userId: this.userId,
          percentX: percentX,
          percentY: percentY,
          rotation: rotation,
          isWingman: isWingman,
        })
      );
    }
  }
  // در فایل: js/network.js
  // این تابع جدید را به انتهای کلاس NetworkManager اضافه کنید.

  sendUseHealPotion() {
    if (this.connected) {
      this.socket.send(
        JSON.stringify({
          type: "use_heal_potion",
          userId: this.userId,
        })
      );
    }
  }
  // در network.js - تابع handleMessage

  sendHit(damage) {
    if (this.connected) {
      this.socket.send(
        JSON.stringify({
          type: "hit",
          userId: this.userId,
          damage: damage,
        })
      );
    }
  }

  sendGameOver() {
    if (this.connected) {
      this.socket.send(
        JSON.stringify({
          type: "game_over",
          userId: this.userId,
        })
      );
    }
  }
}
