const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");
const config = require("./config");
const { airplanesData } = require("./gameData");

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
            wingman: message.wingman, // ذخیره اطلاعات همراه
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
                  source: message.source, // Relay source
                  details: message.details, // Relay details
                })
              );
            }
          }
          break;

        case "hit":
          const hittingPlayer = players[message.userId];
          if (!hittingPlayer || !hittingPlayer.roomId) break;

          const room = gameRooms[hittingPlayer.roomId];
          if (room && !room.gameOver) {
            const opponentId = hittingPlayer.opponent;
            const targetPlayer =
              room.player1.id === opponentId ? room.player1 : room.player2;

            if (
              targetPlayer.shieldEndTime &&
              Date.now() < targetPlayer.shieldEndTime
            ) {
              return;
            }

            targetPlayer.health = Math.max(
              0,
              targetPlayer.health - (message.damage || 0)
            );

            (async () => {
              try {
                const User = require("./models/user");
                const Leaderboard = require("./models/leaderboard");

                const player1Health =
                  room.player1.id === hittingPlayer.userId
                    ? room.player1.health
                    : room.player2.health;
                const player2Health =
                  room.player1.id === opponentId
                    ? room.player1.health
                    : room.player2.health;

                if (players[hittingPlayer.userId]) {
                  players[hittingPlayer.userId].ws.send(
                    JSON.stringify({
                      type: "health_update",
                      health: player1Health,
                      opponentHealth: player2Health,
                    })
                  );
                }
                if (players[opponentId]) {
                  players[opponentId].ws.send(
                    JSON.stringify({
                      type: "health_update",
                      health: player2Health,
                      opponentHealth: player1Health,
                    })
                  );
                }

                if (targetPlayer.health <= 0) {
                  room.gameOver = true;
                  const winnerId = hittingPlayer.userId;
                  const loserId = opponentId;

                  await User.findByIdAndUpdate(winnerId, {
                    $inc: { wins: 1, coins: 20 },
                  });
                  await User.findByIdAndUpdate(loserId, {
                    $inc: { losses: 1, coins: 5 },
                  });

                  const leaderboardTypes = ["daily", "weekly", "monthly"];
                  const now = new Date();
                  for (const type of leaderboardTypes) {
                    const activeLeaderboard = {
                      type: type,
                      endDate: { $gt: now },
                    };
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

                  if (players[winnerId])
                    players[winnerId].ws.send(
                      JSON.stringify({ type: "game_over", result: "win" })
                    );
                  if (players[loserId])
                    players[loserId].ws.send(
                      JSON.stringify({ type: "game_over", result: "lose" })
                    );

                  delete gameRooms[hittingPlayer.roomId];
                  if (players[winnerId]) delete players[winnerId];
                  if (players[loserId]) delete players[loserId];
                }
              } catch (error) {
                console.error("Error processing hit:", error);
              }
            })();
          }
          break;

        case "potion_activate":
          const activator = players[message.userId];
          if (!activator || !activator.roomId) break;

          const potionId = message.potionId;
          const opponentId = activator.opponent;

          (async () => {
            try {
              const User = require("./models/user");
              const Potion = require("./models/potion");
              const potionInfo = await Potion.findById(potionId);
              if (!potionInfo) return;

              await User.updateOne(
                { _id: message.userId, "ownedPotions.potion": potionId },
                { $inc: { "ownedPotions.$.quantity": -1 } }
              );

              const room = gameRooms[activator.roomId];
              if (room) {
                let playerInRoom =
                  room.player1.id === message.userId
                    ? room.player1
                    : room.player2;

                if (potionInfo.name === "معجون محافظ") {
                  playerInRoom.shieldEndTime = Date.now() + 8000;
                }

                if (potionInfo.name === "معجون درمان") {
                  playerInRoom.health = playerInRoom.maxHealth;
                  const opponentInRoom =
                    room.player1.id === opponentId
                      ? room.player1
                      : room.player2;
                  activator.ws.send(
                    JSON.stringify({
                      type: "health_update",
                      health: playerInRoom.health,
                      opponentHealth: opponentInRoom.health,
                    })
                  );
                  if (players[opponentId]) {
                    players[opponentId].ws.send(
                      JSON.stringify({
                        type: "health_update",
                        health: opponentInRoom.health,
                        opponentHealth: playerInRoom.health,
                      })
                    );
                  }
                }
              }

              if (players[opponentId]) {
                players[opponentId].ws.send(
                  JSON.stringify({
                    type: "opponent_potion_activate",
                    potionName: potionInfo.name,
                  })
                );
              }
            } catch (error) {
              console.error("Error processing potion activation:", error);
            }
          })();
          break;

        case "game_over":
          if (players[message.userId] && players[message.userId].opponent) {
            const opponentId = players[message.userId].opponent;
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
                JSON.stringify({ type: "game_over", result: "lose" })
              );
            }
            delete players[message.userId];
            delete players[opponentId];
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
    for (const userId in players) {
      if (players[userId].ws === ws) {
        const playerInfo = players[userId];
        if (playerInfo.opponent && players[playerInfo.opponent]) {
          players[playerInfo.opponent].ws.send(
            JSON.stringify({ type: "opponent_disconnected" })
          );
          delete players[playerInfo.opponent];
        }
        delete players[userId];
        const index = waitingPlayers.indexOf(userId);
        if (index > -1) {
          waitingPlayers.splice(index, 1);
        }
        if (playerInfo.roomId) {
          delete gameRooms[playerInfo.roomId];
        }
        console.log(`Player ${userId} disconnected and cleaned up.`);
        break;
      }
    }
  });
});

async function startGame(player1Id, player2Id) {
  console.log(
    `[startGame] Attempting to start game between ${player1Id} and ${player2Id}`
  );
  const User = require("./models/user");
  const { airplanesData } = require("./gameData");

  try {
    const player1 = {
      data: await User.findById(player1Id),
      wsInfo: players[player1Id],
    };
    const player2 = {
      data: await User.findById(player2Id),
      wsInfo: players[player2Id],
    };

    if (!player1.data || !player2.data)
      throw new Error("Player not found in DB.");

    console.log(
      `[startGame] P1 wants plane (Tier: ${player1.wsInfo.airplaneTier}, Style: ${player1.wsInfo.airplaneStyle})`
    );
    console.log(
      `[startGame] P2 wants plane (Tier: ${player2.wsInfo.airplaneTier}, Style: ${player2.wsInfo.airplaneStyle})`
    );

    const p1Plane = airplanesData.find(
      (p) =>
        p.tier === player1.wsInfo.airplaneTier &&
        p.style === player1.wsInfo.airplaneStyle
    );
    const p2Plane = airplanesData.find(
      (p) =>
        p.tier === player2.wsInfo.airplaneTier &&
        p.style === player2.wsInfo.airplaneStyle
    );

    if (!p1Plane || !p2Plane) {
      if (!p1Plane)
        console.error(`[startGame] FAILED to find data for P1's plane.`);
      if (!p2Plane)
        console.error(`[startGame] FAILED to find data for P2's plane.`);
      throw new Error("Airplane data not found.");
    }
    console.log(`[startGame] Both airplane data found successfully.`);

    const gameCost = 10;
    if (player1.data.coins < gameCost || player2.data.coins < gameCost)
      throw new Error("Not enough coins.");
    player1.data.coins -= gameCost;
    player2.data.coins -= gameCost;
    await player1.data.save();
    await player2.data.save();

    const roomId = `${player1Id}_${player2Id}`;
    gameRooms[roomId] = {
      player1: {
        id: player1Id,
        health: p1Plane.health,
        maxHealth: p1Plane.health,
      },
      player2: {
        id: player2Id,
        health: p2Plane.health,
        maxHealth: p2Plane.health,
      },
    };

    players[player1Id].opponent = player2Id;
    players[player1Id].roomId = roomId;
    players[player2Id].opponent = player1Id;
    players[player2Id].roomId = roomId;

    if (players[player1Id] && players[player2Id]) {
      players[player1Id].ws.send(
        JSON.stringify({
          type: "game_start",
          opponent: {
            username: player2.wsInfo.username,
            airplane: player2.wsInfo.airplane,
            wingman: player2.wsInfo.wingman, // ارسال اطلاعات همراه حریف
          },
          health: p1Plane.health,
          maxHealth: p1Plane.health,
          opponentHealth: p2Plane.health,
          opponentMaxHealth: p2Plane.health,
        })
      );
      players[player2Id].ws.send(
        JSON.stringify({
          type: "game_start",
          opponent: {
            username: player1.wsInfo.username,
            airplane: player1.wsInfo.airplane,
            wingman: player1.wsInfo.wingman, // ارسال اطلاعات همراه حریف
          },
          health: p2Plane.health,
          maxHealth: p2Plane.health,
          opponentHealth: p1Plane.health,
          opponentMaxHealth: p1Plane.health,
        })
      );
      console.log(`[startGame] 'game_start' messages sent. Game is ON!`);
    }
  } catch (error) {
    console.error("!!! [startGame] FAILED:", error.message);
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
    if (players[player1Id]) delete players[player1Id];
    if (players[player2Id]) delete players[player2Id];
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
