const mongoose = require("mongoose");

const leaderboardSchema = new mongoose.Schema({
  season: { type: Number, default: 1 },
  startDate: { type: Date, default: Date.now },
  endDate: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  }, // 1 week
  rankings: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      stars: { type: Number, default: 0 },
      position: { type: Number, required: true },
    },
  ],
  rewardsDistributed: { type: Boolean, default: false },
});

module.exports = mongoose.model("Leaderboard", leaderboardSchema);
