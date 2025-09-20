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
          // --- اضافه کردن لاگ برای دیباگ ---
          console.log(`\n--- [LOGIN] Message Received ---`);
          console.log(`> User ID attempting to log in: ${message.userId}`);
          console.log(
            `> Current waitingPlayers list (before logic): [${waitingPlayers.join(
              ", "
            )}]`
          );

          const alreadyWaitingIndex = waitingPlayers.indexOf(message.userId);
          if (alreadyWaitingIndex > -1) {
            console.log(
              `> This user (${message.userId}) was already in the waiting list. Removing old entry.`
            );
            waitingPlayers.splice(alreadyWaitingIndex, 1);
          }

          players[message.userId] = {
            ws,
            userId: message.userId,
            username: message.username,
            airplane: message.airplane,
            airplaneTier: message.airplaneTier,
            airplaneStyle: message.airplaneStyle,
            bullets: message.bullets,
            screenSize: {
              width: message.screenWidth || 1920,
              height: message.screenHeight || 1080,
            },
            airplaneWidth: 100,
            airplaneHeight: 100,
            position: { x: 0, y: 0 },
            lastShotTime: 0,
          };

          const opponentIndex = waitingPlayers.findIndex(
            (id) => id !== message.userId
          );

          if (opponentIndex !== -1) {
            console.log(`> Opponent found! Index: ${opponentIndex}`);
            const opponentId = waitingPlayers.splice(opponentIndex, 1)[0];
            console.log(`> Match found: ${message.userId} vs ${opponentId}`);
            console.log(`> Calling startGame...`);
            startGame(message.userId, opponentId);
          } else {
            console.log(
              `> No opponent found. Adding user ${message.userId} to the waiting list.`
            );
            waitingPlayers.push(message.userId);
            ws.send(
              JSON.stringify({
                type: "waiting",
                message: "در انتظار حریف...",
              })
            );
          }
          console.log(
            `> Final waitingPlayers list (after logic): [${waitingPlayers.join(
              ", "
            )}]`
          );
          console.log(`--- [LOGIN] End of processing ---\n`);
          // --- پایان بخش لاگ ---
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

        // در فایل backend/server.js
        case "shoot":
          if (players[message.userId]) {
            players[message.userId].lastShotTime = Date.now();
          }
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
                  // FIX: مشخصات گلوله را برای حریف هم ارسال می‌کنیم
                  bulletSpec: message.bulletSpec,
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

                    const hittingPlayerInfo = players[message.userId];
                    if (!hittingPlayerInfo) return;

                    const user = await User.findById(message.userId);
                    if (!user) return;

                    // ۱. کلید هواپیمای در حال استفاده را بساز
                    const airplaneKey = `${hittingPlayerInfo.airplaneTier}_${hittingPlayerInfo.airplaneStyle}`;

                    // ۲. سطح گلوله را از Map بخوان (اگر تعریف نشده بود، پیش‌فرض ۱ است)
                    const bulletLevel =
                      user.airplaneBulletLevels.get(airplaneKey) || 1;

                    const bulletSizeMultipliers = { 1: 1, 2: 2, 3: 3, 4: 5 };
                    const bulletMultiplier =
                      bulletSizeMultipliers[bulletLevel] || 1;

                    const baseDamage = 10;
                    const upgradeDamage = (user.damageLevel - 1) * 2;
                    const damage =
                      (baseDamage + upgradeDamage) * bulletMultiplier;

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

                      // ۱. آپدیت آمار کلی و سکه کاربران
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

                        // آپدیت برنده
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

                        // آپدیت بازنده
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
        // --- شروع بخش اصلاح شده ---
        const playerInfo = players[userId]; // اطلاعات بازیکن را قبل از حذف ذخیره می‌کنیم

        // اگر حریفی وجود داشت، به او اطلاع می‌دهیم
        if (playerInfo.opponent && players[playerInfo.opponent]) {
          players[playerInfo.opponent].ws.send(
            JSON.stringify({
              type: "opponent_disconnected",
            })
          );
          // حذف حریف
          delete players[playerInfo.opponent];
        }

        // حذف بازیکن اصلی از لیست بازیکنان آنلاین
        delete players[userId];

        // حذف بازیکن از صف انتظار (اگر در صف بود)
        const index = waitingPlayers.indexOf(userId);
        if (index > -1) {
          waitingPlayers.splice(index, 1);
        }

        // حذف اتاق بازی (اگر در بازی بود)
        if (playerInfo.roomId) {
          delete gameRooms[playerInfo.roomId];
        }

        console.log(`Player ${userId} disconnected and cleaned up.`);
        // --- پایان بخش اصلاح شده ---

        break; // از حلقه خارج می‌شویم چون بازیکن پیدا و حذف شد
      }
    }
  });
});

// در فایل backend/server.js

async function startGame(player1Id, player2Id) {
  console.log(
    `[startGame] Attempting to start game between ${player1Id} and ${player2Id}`
  );
  const User = require("./models/user");
  const today = new Date().setHours(0, 0, 0, 0);

  try {
    const player1 = await User.findById(player1Id);
    const player2 = await User.findById(player2Id);

    if (!player1 || !player2) {
      throw new Error("One or both players not found in database.");
    }
    console.log(`[startGame] Both players found in DB.`);

    // بخش ۱: بررسی محدودیت بازی روزانه
    for (const p of [
      { user: player1, id: player1Id },
      { user: player2, id: player2Id },
    ]) {
      const lastReset = p.user.dailyPlay.lastReset.setHours(0, 0, 0, 0);
      if (lastReset < today) {
        p.user.dailyPlay.count = 0;
        p.user.dailyPlay.lastReset = new Date();
      }
      if (p.user.dailyPlay.count >= 25) {
        throw new Error(
          `Player ${p.user.username} has reached the daily limit.`
        );
      }
    }
    console.log(`[startGame] Daily play limit check passed.`);

    // بخش ۲: بررسی و کسر هزینه بازی
    const gameCost = 10;
    if (player1.coins < gameCost || player2.coins < gameCost) {
      throw new Error("Not enough coins for one or both players.");
    }

    player1.coins -= gameCost;
    player2.coins -= gameCost;
    player1.dailyPlay.count++;
    player2.dailyPlay.count++;
    await player1.save();
    await player2.save();
    console.log(`[startGame] Coin cost deducted successfully.`);

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
    console.log(`[startGame] Game room ${roomId} created.`);

    // اطمینان از اینکه هر دو بازیکن هنوز متصل هستند قبل از ارسال پیام
    if (players[player1Id] && players[player2Id]) {
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
      console.log(
        `[startGame] 'game_start' messages sent to both players. Game is ON!`
      );
    } else {
      throw new Error(
        "One of the players disconnected before game could start."
      );
    }
  } catch (error) {
    // --- بخش حیاتی برای مدیریت خطا ---
    console.error("!!! [startGame] FAILED:", error.message);

    // به هر دو بازیکن (اگر هنوز متصل هستند) اطلاع بده که بازی لغو شد
    if (players[player1Id]) {
      players[player1Id].ws.send(
        JSON.stringify({
          type: "game_cancelled",
          message: `بازی به دلیل خطا لغو شد: ${error.message}`,
        })
      );
    }
    if (players[player2Id]) {
      players[player2Id].ws.send(
        JSON.stringify({
          type: "game_cancelled",
          message: `بازی به دلیل خطا لغو شد: ${error.message}`,
        })
      );
    }

    // بازیکنان را از حافظه پاک کن تا بتوانند دوباره تلاش کنند
    delete players[player1Id];
    delete players[player2Id];
    console.log(`[startGame] Cleaned up players due to failure.`);
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
