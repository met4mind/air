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
const Leaderboard = require("./models/leaderboard");

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

async function ensureActiveLeaderboards() {
  const now = new Date();
  const leaderboardTypes = ["daily", "weekly", "monthly"];

  for (const type of leaderboardTypes) {
    const existing = await Leaderboard.findOne({
      type: type,
      endDate: { $gt: now },
    });

    if (!existing) {
      console.log(`No active ${type} leaderboard found. Creating a new one...`);
      let startDate, endDate;

      if (type === "daily") {
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(now.setHours(23, 59, 59, 999));
      } else if (type === "weekly") {
        const firstDayOfWeek = new Date(
          now.setDate(
            now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)
          )
        ); // Monday
        startDate = new Date(firstDayOfWeek.setHours(0, 0, 0, 0));
        const lastDayOfWeek = new Date(startDate);
        lastDayOfWeek.setDate(startDate.getDate() + 6);
        endDate = new Date(lastDayOfWeek.setHours(23, 59, 59, 999)); // Sunday
      } else {
        // monthly
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
          999
        );
      }

      await Leaderboard.create({
        type: type,
        startDate: startDate,
        endDate: endDate,
        rankings: [],
      });
    }
  }
}

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

          // <<<< بخش اصلاح‌شده برای جلوگیری از بازی با خود >>>>
          if (waitingPlayers.length > 0) {
            const opponentId = waitingPlayers.pop();
            if (opponentId === message.userId) {
              // اگر حریف پیدا شده، خود بازیکن بود، او را به لیست انتظار برگردان
              waitingPlayers.push(opponentId);
              ws.send(
                JSON.stringify({
                  type: "waiting",
                  message: "Waiting for another player...",
                })
              );
            } else {
              // اگر حریف معتبر بود، بازی را شروع کن
              startGame(message.userId, opponentId);
            }
          } else {
            // اگر کسی در لیست انتظار نبود، این بازیکن را اضافه کن
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
          const hittingPlayer = players[message.userId];
          if (hittingPlayer && hittingPlayer.opponent) {
            const timeSinceLastShot =
              Date.now() - (hittingPlayer.lastShotTime || 0);

            // یک بررسی امنیتی ساده برای جلوگیری از شلیک‌های خیلی سریع
            if (timeSinceLastShot < 1500) {
              const roomId = hittingPlayer.roomId;
              const room = gameRooms[roomId];

              if (room && !room.gameOver) {
                // بررسی می‌کنیم که بازی قبلاً تمام نشده باشد
                const targetPlayerId = hittingPlayer.opponent;

                (async () => {
                  try {
                    const User = require("./models/user");
                    const Leaderboard = require("./models/leaderboard");

                    // محاسبه Damage در سمت سرور
                    const user = await User.findById(message.userId);
                    const damageLevel = user.damageLevel || 1;
                    const baseDamage = 10;
                    const damage = baseDamage + (damageLevel - 1) * 2;

                    // کاهش جان بازیکن هدف
                    const target =
                      room.player1.id === targetPlayerId
                        ? room.player1
                        : room.player2;
                    target.health = Math.max(0, target.health - damage);

                    // ارسال وضعیت جدید سلامتی به هر دو بازیکن
                    if (players[room.player1.id]) {
                      players[room.player1.id].ws.send(
                        JSON.stringify({
                          type: "health_update",
                          health: room.player1.health,
                          opponentHealth: room.player2.health,
                        })
                      );
                    }
                    if (players[room.player2.id]) {
                      players[room.player2.id].ws.send(
                        JSON.stringify({
                          type: "health_update",
                          health: room.player2.health,
                          opponentHealth: room.player1.health,
                        })
                      );
                    }

                    // بررسی پایان بازی
                    if (room.player1.health <= 0 || room.player2.health <= 0) {
                      room.gameOver = true; // جلوگیری از اجرای دوباره این بلوک

                      const winnerId =
                        room.player1.health > 0
                          ? room.player1.id
                          : room.player2.id;
                      const loserId =
                        room.player1.health <= 0
                          ? room.player1.id
                          : room.player2.id;

                      // ۱. آپدیت آمار کلی و سکه کاربران (بدون اهدای استارز)
                      await User.findByIdAndUpdate(winnerId, {
                        $inc: { wins: 1, coins: 20 },
                      });
                      await User.findByIdAndUpdate(loserId, {
                        $inc: { losses: 1, coins: 5 },
                      });

                      // ۲. آپدیت آمار برد و باخت در لیدربوردهای فعال
                      const leaderboardTypes = ["daily", "weekly", "monthly"];
                      const now = new Date();

                      for (const type of leaderboardTypes) {
                        const activeLeaderboard = {
                          type: type,
                          endDate: { $gt: now },
                        };

                        // آپدیت برنده: اگر در لیست بود، برد اضافه کن؛ اگر نبود، با ۱ برد اضافه کن
                        await Leaderboard.updateOne(
                          { ...activeLeaderboard, "rankings.user": winnerId },
                          { $inc: { "rankings.$.wins": 1 } }
                        );
                        await Leaderboard.updateOne(
                          {
                            ...activeLeaderboard,
                            "rankings.user": { $ne: winnerId },
                          },
                          {
                            $push: {
                              rankings: { user: winnerId, wins: 1, losses: 0 },
                            },
                          }
                        );

                        // آپدیت بازنده: اگر در لیست بود، باخت اضافه کن؛ اگر نبود، با ۱ باخت اضافه کن
                        await Leaderboard.updateOne(
                          { ...activeLeaderboard, "rankings.user": loserId },
                          { $inc: { "rankings.$.losses": 1 } }
                        );
                        await Leaderboard.updateOne(
                          {
                            ...activeLeaderboard,
                            "rankings.user": { $ne: loserId },
                          },
                          {
                            $push: {
                              rankings: { user: loserId, wins: 0, losses: 1 },
                            },
                          }
                        );
                      }

                      // ۳. ارسال پیام پایان بازی و پاکسازی
                      if (players[winnerId])
                        players[winnerId].ws.send(
                          JSON.stringify({ type: "game_over", result: "win" })
                        );
                      if (players[loserId])
                        players[loserId].ws.send(
                          JSON.stringify({ type: "game_over", result: "lose" })
                        );

                      delete gameRooms[roomId];
                      if (players[winnerId]) delete players[winnerId];
                      if (players[loserId]) delete players[loserId];
                    }
                  } catch (error) {
                    console.error("Error processing hit:", error);
                  }
                })();
              }
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

async function startGame(player1Id, player2Id) {
  const User = require("./models/user");
  const today = new Date().setHours(0, 0, 0, 0); // تاریخ امروز بدون ساعت

  try {
    const player1 = await User.findById(player1Id);
    const player2 = await User.findById(player2Id);

    // بخش ۱: بررسی محدودیت بازی روزانه
    for (const player of [player1, player2]) {
      const lastReset = player.dailyPlay.lastReset.setHours(0, 0, 0, 0);
      if (lastReset < today) {
        player.dailyPlay.count = 0;
        player.dailyPlay.lastReset = new Date();
      }
      if (player.dailyPlay.count >= 25) {
        // به هر دو بازیکن اطلاع بده که بازی به دلیل محدودیت لغو شد
        if (players[player1Id])
          players[player1Id].ws.send(
            JSON.stringify({
              type: "game_cancelled",
              message: `Player ${player.username} has reached the daily limit.`,
            })
          );
        if (players[player2Id])
          players[player2Id].ws.send(
            JSON.stringify({
              type: "game_cancelled",
              message: `Player ${player.username} has reached the daily limit.`,
            })
          );
        return; // شروع بازی را متوقف کن
      }
    }

    // بخش ۲: بررسی و کسر هزینه بازی
    const gameCost = 10;
    if (player1.coins < gameCost || player2.coins < gameCost) {
      if (players[player1Id])
        players[player1Id].ws.send(
          JSON.stringify({
            type: "game_cancelled",
            message: "Not enough coins",
          })
        );
      if (players[player2Id])
        players[player2Id].ws.send(
          JSON.stringify({
            type: "game_cancelled",
            message: "Not enough coins",
          })
        );
      delete players[player1Id];
      delete players[player2Id];
      return;
    }

    // کسر هزینه و افزایش شمارنده بازی
    player1.coins -= gameCost;
    player2.coins -= gameCost;
    player1.dailyPlay.count++;
    player2.dailyPlay.count++;
    await player1.save();
    await player2.save();

    // بخش ۳: ایجاد اتاق بازی و ارسال اطلاعات
    const roomId = `${player1Id}_${player2Id}`;
    const player1InitialHealth = 100 + ((player1.healthLevel || 1) - 1) * 20;
    const player2InitialHealth = 100 + ((player2.healthLevel || 1) - 1) * 20;

    gameRooms[roomId] = {
      player1: {
        id: player1Id,
        health: player1InitialHealth,
        maxHealth: player1InitialHealth,
      },
      player2: {
        id: player2Id,
        health: player2InitialHealth,
        maxHealth: player2InitialHealth,
      },
    };

    players[player1Id].opponent = player2Id;
    players[player1Id].roomId = roomId;
    players[player2Id].opponent = player1Id;
    players[player2Id].roomId = roomId;

    players[player1Id].ws.send(
      JSON.stringify({
        type: "game_start",
        opponent: {
          username: players[player2Id].username,
          airplane: players[player2Id].airplane,
          bullets: players[player2Id].bullets,
        },
        health: player1InitialHealth,
        maxHealth: player1InitialHealth,
        opponentHealth: player2InitialHealth,
        opponentMaxHealth: player2InitialHealth,
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
        health: player2InitialHealth,
        maxHealth: player2InitialHealth,
        opponentHealth: player1InitialHealth,
        opponentMaxHealth: player1InitialHealth,
      })
    );
  } catch (error) {
    console.error("Error starting game:", error);
  }
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
  ensureActiveLeaderboards().catch(console.error);
  console.log(`Server is running on port ${PORT}`);
});
