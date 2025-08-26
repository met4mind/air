// server.js
const WebSocket = require("ws");
const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

// اتصال به MongoDB
mongoose.connect("mongodb://localhost:27017/airplaneGame", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// مدل کاربر
const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  airplane: String,
  bullets: String,
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
});

const User = mongoose.model("User", UserSchema);

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware برای پردازش JSON
app.use(cors());
app.use(express.json());

// API برای ثبت نام و لاگین
app.post("/api/register", async (req, res) => {
  try {
    const { username, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const user = new User({ username, password });
    await user.save();

    res.json({ message: "User created successfully" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    res.json({ message: "Login successful", user });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// API برای دریافت اطلاعات هواپیماها و گلوله‌ها
app.get("/api/assets/airplanes", (req, res) => {
  // این اطلاعات می‌تواند از دیتابیس یا فایل config لود شود
  res.json([
    {
      id: 1,
      name: "Tier 1 - Model 1",
      image: "assets/images/airplanes/Tier 1/1.png",
    },
    {
      id: 2,
      name: "Tier 1 - Model 2",
      image: "assets/images/airplanes/Tier 1/2.png",
    },
    // ... سایر هواپیماها
  ]);
});

app.get("/api/assets/bullets", (req, res) => {
  res.json([
    { id: 1, name: "Level 1", image: "assets/images/bullets/lvl1.png" },
    { id: 2, name: "Level 2", image: "assets/images/bullets/lvl2.png" },
    // ... سایر گلوله‌ها
  ]);
});

// مدیریت اتصالات WebSocket
const players = {};
const waitingPlayers = [];

wss.on("connection", (ws) => {
  console.log("Player connected");

  ws.on("message", async (data) => {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case "login":
          // ذخیره اطلاعات کاربر
          players[message.userId] = {
            ws,
            userId: message.userId,
            username: message.username,
            airplane: message.airplane,
            bullets: message.bullets,
            position: { x: 0, y: 0 },
          };

          // اضافه کردن به لیست انتظار یا شروع بازی
          if (waitingPlayers.length > 0) {
            const opponentId = waitingPlayers.pop();
            startGame(message.userId, opponentId);
          } else {
            waitingPlayers.push(message.userId);
            ws.send(
              JSON.stringify({
                type: "waiting",
                message: "Waiting for an opponent...",
              })
            );
          }
          break;

        case "move":
          // به روزرسانی موقعیت و ارسال به حریف
          if (players[message.userId] && players[message.userId].opponent) {
            const opponentId = players[message.userId].opponent;
            if (players[opponentId]) {
              players[opponentId].ws.send(
                JSON.stringify({
                  type: "opponent_move",
                  x: message.x,
                  y: message.y,
                })
              );
            }
          }
          break;

        case "shoot":
          // ارسال اطلاعات شلیک به حریف
          if (players[message.userId] && players[message.userId].opponent) {
            const opponentId = players[message.userId].opponent;
            if (players[opponentId]) {
              players[opponentId].ws.send(
                JSON.stringify({
                  type: "opponent_shoot",
                  x: message.x,
                  y: message.y,
                  rotation: message.rotation,
                })
              );
            }
          }
          break;

        case "hit":
          // ثبت آسیب به حریف
          if (players[message.userId] && players[message.userId].opponent) {
            const opponentId = players[message.userId].opponent;
            if (players[opponentId]) {
              players[opponentId].ws.send(
                JSON.stringify({
                  type: "you_hit",
                  damage: message.damage,
                })
              );
            }
          }
          break;

        case "game_over":
          // پایان بازی و ثبت نتیجه
          if (players[message.userId] && players[message.userId].opponent) {
            const opponentId = players[message.userId].opponent;

            // آپدیت آمار برد و باخت
            await User.findByIdAndUpdate(message.userId, { $inc: { wins: 1 } });
            await User.findByIdAndUpdate(opponentId, { $inc: { losses: 1 } });

            if (players[opponentId]) {
              players[opponentId].ws.send(
                JSON.stringify({
                  type: "game_over",
                  result: "lose",
                })
              );
            }

            // حذف بازیکنان از لیست
            delete players[message.userId];
            delete players[opponentId];
          }
          break;
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }
  });

  ws.on("close", () => {
    // مدیریت قطع ارتباط
    for (const userId in players) {
      if (players[userId].ws === ws) {
        const opponentId = players[userId].opponent;
        if (opponentId && players[opponentId]) {
          players[opponentId].ws.send(
            JSON.stringify({
              type: "opponent_disconnected",
            })
          );
        }
        delete players[userId];

        // حذف از لیست انتظار
        const index = waitingPlayers.indexOf(userId);
        if (index > -1) {
          waitingPlayers.splice(index, 1);
        }
        break;
      }
    }
  });
});

function startGame(player1Id, player2Id) {
  players[player1Id].opponent = player2Id;
  players[player2Id].opponent = player1Id;

  // ارسال اطلاعات شروع بازی به هر دو بازیکن
  players[player1Id].ws.send(
    JSON.stringify({
      type: "game_start",
      opponent: {
        username: players[player2Id].username,
        airplane: players[player2Id].airplane,
        bullets: players[player2Id].bullets,
      },
    })
  );

  players[player2Id].ws.send(
    JSON.stringify({
      type: "game_start",
      opponent: {
        username: players[player1Id].username,
        airplane: players[player1Id].airplane,
        bullets: players[player1Id].bullets,
      },
    })
  );
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
