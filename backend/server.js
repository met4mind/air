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
            lastShotTime: 0, // <<<< این خط برای امنیت اضافه شده است
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
          // زمان شلیک را برای بررسی امنیتی ثبت کنید
          if (players[message.userId]) {
            players[message.userId].lastShotTime = Date.now();
          }

          // ارسال پیام شلیک به حریف
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
          const player = players[message.userId];
          if (player && player.opponent) {
            // بررسی امنیتی: آیا بازیکن اخیراً شلیک کرده است؟
            const timeSinceLastShot = Date.now() - (player.lastShotTime || 0);

            // فقط اگر در 1.5 ثانیه گذشته شلیک کرده باشد، برخورد را قبول کن
            if (timeSinceLastShot < 1500) {
              const roomId = player.roomId;
              const room = gameRooms[roomId];

              if (room) {
                const targetPlayerId = player.opponent;
                const damage = message.damage || 10;

                // کاهش جان بازیکن هدف (حریف)
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

                // ارسال وضعیت جدید سلامتی به هر دو بازیکن
                // ارسال به بازیکن فعلی
                player.ws.send(
                  JSON.stringify({
                    type: "health_update",
                    health:
                      room.player1.id === player.userId
                        ? room.player1.health
                        : room.player2.health,
                    opponentHealth:
                      room.player1.id === targetPlayerId
                        ? room.player1.health
                        : room.player2.health,
                  })
                );

                // ارسال به حریف
                const opponentPlayer = players[targetPlayerId];
                if (opponentPlayer) {
                  opponentPlayer.ws.send(
                    JSON.stringify({
                      type: "health_update",
                      health:
                        room.player1.id === targetPlayerId
                          ? room.player1.health
                          : room.player2.health,
                      opponentHealth:
                        room.player1.id === player.userId
                          ? room.player1.health
                          : room.player2.health,
                    })
                  );
                }

                // بررسی پایان بازی
                if (room.player1.health <= 0 || room.player2.health <= 0) {
                  const winnerId =
                    room.player1.health > 0 ? room.player1.id : room.player2.id;
                  const loserId =
                    room.player1.health <= 0
                      ? room.player1.id
                      : room.player2.id;

                  // آپدیت آمار برد، باخت و ستاره‌ها در دیتابیس
                  (async () => {
                    try {
                      const User = require("./models/user");
                      await User.findByIdAndUpdate(winnerId, {
                        $inc: { wins: 1, stars: 10 },
                      });
                      await User.findByIdAndUpdate(loserId, {
                        $inc: { losses: 1, stars: 2 },
                      });
                    } catch (error) {
                      console.error("Error updating user stats:", error);
                    }
                  })();

                  // ارسال پیام پایان بازی به برنده و بازنده
                  if (players[winnerId]) {
                    players[winnerId].ws.send(
                      JSON.stringify({
                        type: "game_over",
                        result: "win",
                      })
                    );
                  }
                  if (players[loserId]) {
                    players[loserId].ws.send(
                      JSON.stringify({
                        type: "game_over",
                        result: "lose",
                      })
                    );
                  }

                  // پاکسازی اطلاعات بازی از حافظه سرور
                  delete gameRooms[roomId];

                  const winnerIndex = waitingPlayers.indexOf(winnerId);
                  if (winnerIndex > -1) waitingPlayers.splice(winnerIndex, 1);

                  const loserIndex = waitingPlayers.indexOf(loserId);
                  if (loserIndex > -1) waitingPlayers.splice(loserIndex, 1);

                  delete players[winnerId];
                  delete players[loserId];
                }
              }
            } else {
              // اگر پیام هیت بدون شلیک اخیر ارسال شود، آن را نادیده گرفته و در لاگ ثبت کن
              console.log(
                `Invalid hit from ${message.userId}. No recent shot.`
              );
            }
          }
          break;
        case "potion_activate":
          const activator = players[message.userId];
          if (!activator) break;

          const potionId = message.potionId;
          const opponentId = activator.opponent;

          // آپدیت دیتابیس به صورت async (بازی منتظر نمی‌ماند)
          (async () => {
            try {
              const User = require("./models/user");
              const Potion = require("./models/potion");

              // اطلاعات معجون را برای ارسال نام آن به حریف پیدا می‌کنیم
              const potionInfo = await Potion.findById(potionId);
              if (!potionInfo) return;

              // کم کردن یکی از تعداد معجون کاربر
              await User.updateOne(
                { _id: message.userId, "ownedPotions.potion": potionId },
                { $inc: { "ownedPotions.$.quantity": -1 } }
              );

              // اگر معجون درمان بود، منطق درمان را اجرا کن
              if (potionInfo.name === "معجون درمان") {
                const room = gameRooms[activator.roomId];
                if (room) {
                  let playerInRoom =
                    room.player1.id === message.userId
                      ? room.player1
                      : room.player2;
                  playerInRoom.health = Math.min(100, playerInRoom.health + 50);
                  // ارسال آپدیت سلامتی به هر دو بازیکن
                  activator.ws.send(
                    JSON.stringify({
                      type: "health_update",
                      health: playerInRoom.health,
                      opponentHealth:
                        room.player1.id === opponentId
                          ? room.player1.health
                          : room.player2.health,
                    })
                  );
                  if (players[opponentId]) {
                    players[opponentId].ws.send(
                      JSON.stringify({
                        type: "health_update",
                        health:
                          room.player1.id === opponentId
                            ? room.player1.health
                            : room.player2.health,
                        opponentHealth: playerInRoom.health,
                      })
                    );
                  }
                }
              } else {
                // برای بقیه معجون‌ها، فقط به حریف اطلاع بده تا افکت را نمایش دهد
                if (players[opponentId]) {
                  players[opponentId].ws.send(
                    JSON.stringify({
                      type: "opponent_potion_activate",
                      potionName: potionInfo.name,
                    })
                  );
                }
              }
            } catch (error) {
              console.error("Error processing potion activation:", error);
            }
          })();
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
