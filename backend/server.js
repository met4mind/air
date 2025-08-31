const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");
const config = require("./config");

const apiRoutes = require("./routes/api");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// اتصال به MongoDB
mongoose
  .connect(config.mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });

// Routes
app.use("/api", apiRoutes);

// WebSocket Game Logic
const players = {};
const waitingPlayers = [];
const gameRooms = {};

wss.on("connection", (ws) => {
  console.log("Player connected");

  ws.on("message", async (data) => {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case "login":
          players[message.userId] = {
            ws,
            userId: message.userId,
            username: message.username,
            airplane: message.airplane,
            bullets: message.bullets,
            screenSize: {
              width: message.screenWidth || 1920,
              height: message.screenHeight || 1080,
            },
            airplaneWidth: 100,
            airplaneHeight: 100,
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
          if (players[message.userId] && players[message.userId].opponent) {
            const opponentId = players[message.userId].opponent;
            if (players[opponentId]) {
              players[opponentId].ws.send(
                JSON.stringify({
                  type: "opponent_move",
                  percentX: message.percentX,
                  percentY: message.percentY,
                })
              );
            }
          }
          break;

        case "shoot":
          if (players[message.userId] && players[message.userId].opponent) {
            const opponentId = players[message.userId].opponent;
            if (players[opponentId]) {
              players[opponentId].ws.send(
                JSON.stringify({
                  type: "opponent_shoot",
                  percentX: message.percentX,
                  percentY: message.percentY,
                  rotation: message.rotation,
                  isWingman: message.isWingman || false,
                })
              );
            }
          }
          break;

        case "hit":
          if (players[message.userId] && players[message.userId].opponent) {
            const roomId = players[message.userId].roomId;
            const room = gameRooms[roomId];

            setTimeout(async () => {
              if (room) {
                // تشخیص اینکه کدام بازیکن آسیب دیده (همیشه حریف آسیب میبیند)
                const targetPlayerId = players[message.userId].opponent;
                const damage = message.damage || 10;

                // کاهش سلامت بازیکن هدف
                if (room.player1.id === targetPlayerId) {
                  room.player1.health = Math.max(
                    0,
                    room.player1.health - damage
                  );
                } else if (room.player2.id === targetPlayerId) {
                  room.player2.health = Math.max(
                    0,
                    room.player2.health - damage
                  );
                }

                // ارسال وضعیت سلامت به هر دو بازیکن
                players[message.userId].ws.send(
                  JSON.stringify({
                    type: "health_update",
                    health:
                      room.player1.id === message.userId
                        ? room.player1.health
                        : room.player2.health,
                    opponentHealth:
                      room.player1.id === message.userId
                        ? room.player2.health
                        : room.player1.health,
                  })
                );

                players[targetPlayerId].ws.send(
                  JSON.stringify({
                    type: "health_update",
                    health:
                      room.player1.id === targetPlayerId
                        ? room.player1.health
                        : room.player2.health,
                    opponentHealth:
                      room.player1.id === targetPlayerId
                        ? room.player2.health
                        : room.player1.health,
                  })
                );

                // بررسی پایان بازی
                if (room.player1.health <= 0 || room.player2.health <= 0) {
                  const winnerId =
                    room.player1.health > 0 ? room.player1.id : room.player2.id;
                  const loserId =
                    room.player1.health > 0 ? room.player2.id : room.player1.id;

                  // آپدیت آمار برد و باخت
                  try {
                    const User = require("./models/user");
                    await User.findByIdAndUpdate(winnerId, {
                      $inc: { wins: 1 },
                    });
                    await User.findByIdAndUpdate(loserId, {
                      $inc: { losses: 1 },
                    });
                  } catch (error) {
                    console.error("Error updating user stats:", error);
                  }

                  // ارسال پیام پایان بازی
                  players[winnerId].ws.send(
                    JSON.stringify({
                      type: "game_over",
                      result: "win",
                    })
                  );

                  players[loserId].ws.send(
                    JSON.stringify({
                      type: "game_over",
                      result: "lose",
                    })
                  );

                  // حذف اتاق بازی
                  delete gameRooms[roomId];

                  // حذف بازیکنان از لیست
                  delete players[winnerId];
                  delete players[loserId];

                  // حذف از لیست انتظار در صورت وجود
                  const winnerIndex = waitingPlayers.indexOf(winnerId);
                  if (winnerIndex > -1) waitingPlayers.splice(winnerIndex, 1);

                  const loserIndex = waitingPlayers.indexOf(loserId);
                  if (loserIndex > -1) waitingPlayers.splice(loserIndex, 1);
                }
              }
            }, 50);
          }
          break;

        case "game_over":
          // پایان بازی و ثبت نتیجه
          if (players[message.userId] && players[message.userId].opponent) {
            const opponentId = players[message.userId].opponent;

            // آپدیت آمار برد و باخت
            try {
              const User = require("./models/user");
              await User.findByIdAndUpdate(message.userId, {
                $inc: { wins: 1 },
              });
              await User.findByIdAndUpdate(opponentId, { $inc: { losses: 1 } });
            } catch (error) {
              console.error("Error updating user stats:", error);
            }

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

            // حذف از لیست انتظار در صورت وجود
            const index1 = waitingPlayers.indexOf(message.userId);
            if (index1 > -1) waitingPlayers.splice(index1, 1);

            const index2 = waitingPlayers.indexOf(opponentId);
            if (index2 > -1) waitingPlayers.splice(index2, 1);
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

          // حذف حریف نیز از لیست
          delete players[opponentId];

          // حذف از لیست انتظار در صورت وجود
          const opponentIndex = waitingPlayers.indexOf(opponentId);
          if (opponentIndex > -1) waitingPlayers.splice(opponentIndex, 1);
        }

        // حذف بازیکن اصلی
        delete players[userId];

        // حذف از لیست انتظار
        const index = waitingPlayers.indexOf(userId);
        if (index > -1) {
          waitingPlayers.splice(index, 1);
        }

        // حذف اتاق بازی اگر وجود دارد
        if (players[userId] && players[userId].roomId) {
          delete gameRooms[players[userId].roomId];
        }

        break;
      }
    }
  });
});

function startGame(player1Id, player2Id) {
  const roomId = `${player1Id}_${player2Id}`;

  // ایجاد اتاق بازی با وضعیت سلامت
  gameRooms[roomId] = {
    player1: {
      id: player1Id,
      health: 100,
    },
    player2: {
      id: player2Id,
      health: 100,
    },
  };

  players[player1Id].opponent = player2Id;
  players[player1Id].roomId = roomId;
  players[player2Id].opponent = player1Id;
  players[player2Id].roomId = roomId;

  // ارسال اطلاعات شروع بازی
  players[player1Id].ws.send(
    JSON.stringify({
      type: "game_start",
      opponent: {
        username: players[player2Id].username,
        airplane: players[player2Id].airplane,
        bullets: players[player2Id].bullets,
      },
      health: 100, // سلامت اولیه
      opponentHealth: 100, // سلامت حریف
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
      health: 100,
      opponentHealth: 100,
    })
  );
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Route not found
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
