// در فایل backend/models/leaderboard.js

const mongoose = require("mongoose");

const leaderboardSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["daily", "weekly", "monthly"],
    required: true,
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  rankings: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      // <<<< تغییر اصلی: ذخیره برد و باخت به جای استارز >>>>
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
    },
  ],
  rewardsDistributed: { type: Boolean, default: false },
});

leaderboardSchema.index({ type: 1, endDate: -1 });

module.exports = mongoose.model("Leaderboard", leaderboardSchema);
