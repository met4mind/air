const mongoose = require("mongoose");

const gameSchema = new mongoose.Schema({
  player1: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  player2: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  winner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  player1Potion: { type: mongoose.Schema.Types.ObjectId, ref: "Potion" },
  player2Potion: { type: mongoose.Schema.Types.ObjectId, ref: "Potion" },
  player1Score: { type: Number, default: 0 },
  player2Score: { type: Number, default: 0 },
  cost: { type: Number, default: 10 }, // هزینه بازی برای هر بازیکن
  status: {
    type: String,
    enum: ["pending", "active", "finished", "cancelled"],
    default: "pending",
  },
  createdAt: { type: Date, default: Date.now },
  finishedAt: Date,
});

module.exports = mongoose.model("Game", gameSchema);
