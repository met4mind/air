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
  airplaneBulletLevels: {
    type: Map,
    of: Number, // سطح گلوله (e.g., 1, 2, 3, 4)
    default: {}, // مقدار پیش‌فرض یک آبجکت خالی است
  },
  // <<<< تغییرات جدید >>>>
  wingmanLevel: { type: Number, default: 1 }, // سطح فعلی همراهان کاربر
  selectedWingman: { type: String, default: "1" }, // ID (سطح) همراه انتخاب شده
  // <<<< پایان تغییرات >>>>
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
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
  dailyPlay: {
    count: { type: Number, default: 0 },
    lastReset: { type: Date, default: () => new Date() },
  },
});

module.exports = mongoose.model("User", userSchema);
