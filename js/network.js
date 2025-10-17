import { CONFIG } from "../config.js";

export class NetworkManager {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.userId = null;
    this.opponent = null;
    this.baseURL = CONFIG.BASEURL;
    this.tgid = localStorage.getItem("tgid") || null;
    this.onHealthUpdate = null;
    this.onGameStart = null;
    this.onWaiting = null;
    this.onOpponentMove = null;
    this.onOpponentShoot = null;
    this.onYouHit = null;
    this.onGameOver = null;
    this.onOpponentDisconnected = null;
    // <<< پراپرتی جدید برای مدیریت معجون حریف >>>
    this.onOpponentPotionActivate = null;
    this.onGameCancelled = null;
  }
  setTgid(tgid) {
    this.tgid = tgid;
    localStorage.setItem("tgid", tgid);
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

  // در فایل js/network.js -> داخل کلاس NetworkManager
  async getAirplanes() {
    // FIX: آدرس API را به مسیر جدید و کامل تغییر می‌دهیم
    return this.apiRequest("/api/game-data/airplanes");
  }

  async getBullets() {
    return this.apiRequest("/api/assets/bullets");
  }

  connect() {
    const protocol = this.baseURL.startsWith("https") ? "wss:" : "ws:";
    const host = this.baseURL.replace(/^https?:\/\//, "");
    this.socket = new WebSocket(`${protocol}//${host}/ws`);

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

  async authenticateWithTelegram(initData, referrerTgid) {
    return this.apiRequest("/api/auth/telegram", {
      method: "POST",
      body: JSON.stringify({ initData, referrerTgid }),
    });
  }

  handleMessage(message) {
    switch (message.type) {
      case "waiting":
        if (this.onWaiting) this.onWaiting(message.message);
        break;

      case "game_start":
        this.opponent = message.opponent;
        if (this.onGameStart) {
          // به جای message.opponent، کل آبجکت message را ارسال می‌کنیم
          this.onGameStart(message);
        }
        break;
      case "game_cancelled":
        if (this.onGameCancelled) this.onGameCancelled(message.message);
        break;
      case "opponent_move":
        if (this.onOpponentMove)
          this.onOpponentMove(message.percentX, message.percentY);
        break;

      // در فایل js/network.js -> داخل تابع handleMessage
      // در فایل js/network.js -> داخل تابع handleMessage

      case "opponent_shoot":
        if (this.onOpponentShoot) {
          // Pass the entire message object which contains 'source' and 'details'
          this.onOpponentShoot(message);
        }
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
  userId, // <<-- پارامتر جدید و مهم
  username,
  airplane,
  airplaneName,
  bullets,
  bulletName,
  screenWidth,
  screenHeight,
  potionId,
  airplaneTier,
  airplaneStyle,
  wingman // پارامتر جدید
) {
  if (this.connected) {
    // <<-- اینجا از userId ورودی استفاده می‌کنیم، نه از this.userId
    this.socket.send(
      JSON.stringify({
        type: "login",
        userId: userId, 
        username: username,
        airplane: airplane,
        airplaneName: airplaneName,
        wingman: wingman,
        bullets: bullets,
        bulletName: bulletName,
        screenWidth: screenWidth,
        screenHeight: screenHeight,
        airplaneTier: airplaneTier,
        airplaneStyle: airplaneStyle,
        potionId: potionId || null,
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
  // در فایل js/network.js
  // در فایل js/network.js -> داخل کلاس NetworkManager

  sendShoot(source, details) {
    if (this.connected) {
      const message = {
        type: "shoot",
        userId: this.userId,
        source: source, // e.g., 'main_plane', 'left_wingman', 'right_wingman'
        details: details,
      };
      this.socket.send(JSON.stringify(message));
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

  // در فایل js/network.js
  sendHit(damage) {
    if (this.connected) {
      this.socket.send(
        JSON.stringify({
          type: "hit",
          userId: this.userId,
          damage: damage, // ارسال مقدار damage
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
