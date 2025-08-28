import { CONFIG } from "../config.js";

export class NetworkManager {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.userId = null;
    this.opponent = null;
    this.baseURL = CONFIG.BASEURL;

    // event handlers
    this.onHealthUpdate = null;
    this.onGameStart = null;
    this.onWaiting = null;
    this.onOpponentMove = null;
    this.onOpponentShoot = null;
    this.onYouHit = null;
    this.onGameOver = null;
    this.onOpponentDisconnected = null;
  }

  async apiRequest(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        headers: {
          "Content-Type": "application/json",
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

  async register(username, password, confirmPassword) {
    return this.apiRequest("/api/register", {
      method: "POST",
      body: JSON.stringify({ username, password, confirmPassword }),
    });
  }

  async login(username, password) {
    return this.apiRequest("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
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
        if (this.onOpponentMove) this.onOpponentMove(message.x, message.y);
        break;

      case "opponent_shoot":
        if (this.onOpponentShoot)
          this.onOpponentShoot(message.x, message.y, message.rotation);
        break;

      case "you_hit":
        if (this.onYouHit) this.onYouHit(message.damage);
        break;

      case "game_over":
        if (this.onGameOver) this.onGameOver(message.result);
        break;

      case "opponent_disconnected":
        if (this.onOpponentDisconnected) this.onOpponentDisconnected();
        break;

      case "health_update":
        if (this.onHealthUpdate)
          this.onHealthUpdate(message.health, message.opponentHealth);
        break;
    }
  }

  sendLogin(username, airplane, airplaneName, bullets, bulletName) {
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
        })
      );
    }
  }

  sendShoot(x, y, rotation, isWingman = false) {
    if (this.connected) {
      this.socket.send(
        JSON.stringify({
          type: "shoot",
          userId: this.userId,
          x: x,
          y: y,
          rotation: rotation,
          isWingman: isWingman,
        })
      );
    }
  }

  sendMove(x, y) {
    if (this.connected) {
      this.socket.send(
        JSON.stringify({
          type: "move",
          userId: this.userId,
          x: x,
          y: y,
        })
      );
    }
  }
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
