const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  tgid: { type: String, required: true, unique: true },
  username: { type: String, unique: true, sparse: true },
  password: String,
  first_name: String,
  last_name: String,
  stars: { type: Number, default: 0 },
  coins: { type: Number, default: 100 },
  damageLevel: { type: Number, default: 1 },
  speedLevel: { type: Number, default: 1 },
  healthLevel: { type: Number, default: 1 },
  airplaneTier: { type: Number, default: 1 },
  airplaneStyle: { type: Number, default: 1 },
  ownedPotions: [
    {
      potion: { type: mongoose.Schema.Types.ObjectId, ref: "Potion" },
      quantity: { type: Number, default: 0 },
    },
  ],
  ownedBoosters: [
    {
      type: { type: String, enum: ["freeze", "slowmo", "shield"] },
      quantity: { type: Number, default: 0 },
    },
  ],
  referrals: [String],
  completedOffers: [String],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
