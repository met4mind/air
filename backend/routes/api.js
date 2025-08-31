const express = require("express");
const router = express.Router();
const User = require("../models/user");
const Potion = require("../models/potion");
const Game = require("../models/game");
const Leaderboard = require("../models/leaderboard");

// Middleware برای احراز هویت کاربر تلگرام
const auth = async (req, res, next) => {
  try {
    const tgid = req.query.tgid || req.body.tgid;
    if (!tgid) {
      return res.status(401).json({ error: "Authentication required" });
    }

    let user = await User.findOne({ tgid });
    if (!user) {
      // اگر کاربر وجود ندارد، آن را ایجاد کنید
      user = new User({
        tgid,
        username: req.query.username || req.body.username,
        first_name: req.query.first_name || req.body.first_name,
        last_name: req.query.last_name || req.body.last_name,
      });
      await user.save();
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// دریافت اطلاعات کاربر
router.get("/user", auth, async (req, res) => {
  try {
    res.json(req.user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// شروع یک بازی جدید
router.post("/game/start", auth, async (req, res) => {
  try {
    const { opponentId, potionId } = req.body;
    const player1 = req.user;
    const player2 = await User.findById(opponentId);

    if (!player2) {
      return res.status(404).json({ error: "Opponent not found" });
    }

    // بررسی موجودی سکه
    if (player1.coins < 10 || player2.coins < 10) {
      return res.status(400).json({ error: "Not enough coins" });
    }

    // کسر هزینه بازی
    player1.coins -= 10;
    player2.coins -= 10;
    await player1.save();
    await player2.save();

    // ایجاد بازی جدید
    const game = new Game({
      player1: player1._id,
      player2: player2._id,
      player1Potion: potionId || null,
    });

    await game.save();
    res.json({ gameId: game._id, message: "Game started" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// پایان بازی و ثبت نتیجه
router.post("/game/finish", auth, async (req, res) => {
  try {
    const { gameId, winnerId, player1Score, player2Score } = req.body;
    const game = await Game.findById(gameId).populate("player1 player2");

    if (!game) {
      return res.status(404).json({ error: "Game not found" });
    }

    game.winner = winnerId;
    game.player1Score = player1Score;
    game.player2Score = player2Score;
    game.status = "finished";
    game.finishedAt = new Date();

    // توزیع امتیازات
    if (winnerId === game.player1._id.toString()) {
      game.player1.stars += 10;
      game.player2.stars += 2;
    } else {
      game.player2.stars += 10;
      game.player1.stars += 2;
    }

    await game.player1.save();
    await game.player2.save();
    await game.save();

    res.json({ message: "Game finished", stars: req.user.stars });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// دریافت لیست معجون‌ها
router.get("/potions", auth, async (req, res) => {
  try {
    const potions = await Potion.find();
    res.json(potions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// ثبت کاربر جدید
router.post("/register", async (req, res) => {
  try {
    const { username, password, tgid } = req.body;

    // Check for existing username
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: "نام کاربری already exists" });
    }

    // Check for existing tgid if provided
    if (tgid) {
      const existingTgid = await User.findOne({ tgid });
      if (existingTgid) {
        return res.status(400).json({ error: "TGID already exists" });
      }
    }

    // Create new user
    const user = new User({
      username,
      password, // Hash this in production!
      tgid: tgid || null, // Handle tgid properly
    });

    await user.save();
    res.json({ message: "ثبت نام موفقیت‌آمیز بود" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.get("/assets/airplanes", (req, res) => {
  res.json([
    {
      id: 1,
      name: "Tier 1 - Model 1",
      image: "assets/images/airplanes/Tier 1/1.png",
    },
    {
      id: 2,
      name: "Tier 1 - Model 2",
      image: "assets/images/airplanes/Tier 1/2.png",
    },
  ]);
});

router.get("/assets/bullets", (req, res) => {
  res.json([
    { id: 1, name: "Level 1", image: "assets/images/bullets/lvl1.png" },
    { id: 2, name: "Level 2", image: "assets/images/bullets/lvl2.png" },
  ]);
});
// ورود کاربر
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // پیدا کردن کاربر
    const user = await User.findOne({ username });
    if (!user || user.password !== password) {
      return res
        .status(401)
        .json({ error: "نام کاربری یا رمز عبور اشتباه است" });
    }

    // در پروژه واقعی، یک توکن JWT برگردانید
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// خرید معجون
router.post("/shop/buy-potion", auth, async (req, res) => {
  try {
    const { potionId, quantity = 1 } = req.body;
    const potion = await Potion.findById(potionId);

    if (!potion) {
      return res.status(404).json({ error: "Potion not found" });
    }

    const totalCost = potion.price * quantity;

    if (req.user.coins < totalCost) {
      return res.status(400).json({ error: "Not enough coins" });
    }

    // کسر سکه و افزودن معجون
    req.user.coins -= totalCost;

    // بررسی آیا کاربر قبلاً این معجون را دارد
    const existingPotion = req.user.ownedPotions.find(
      (p) => p.potion.toString() === potionId
    );
    if (existingPotion) {
      existingPotion.quantity += quantity;
    } else {
      req.user.ownedPotions.push({ potion: potionId, quantity });
    }

    await req.user.save();
    res.json({ message: "Potion purchased", coins: req.user.coins });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ارتقاء ویژگی‌ها
router.post("/upgrade", auth, async (req, res) => {
  try {
    const { type } = req.body; // damage, speed, health, airplane
    const user = req.user;
    let cost = 0;

    switch (type) {
      case "damage":
        cost = user.damageLevel * 50;
        if (user.coins < cost) {
          return res.status(400).json({ error: "Not enough coins" });
        }
        user.coins -= cost;
        user.damageLevel += 1;
        break;

      case "speed":
        cost = user.speedLevel * 40;
        if (user.coins < cost) {
          return res.status(400).json({ error: "Not enough coins" });
        }
        user.coins -= cost;
        user.speedLevel += 1;
        break;

      case "health":
        cost = user.healthLevel * 60;
        if (user.coins < cost) {
          return res.status(400).json({ error: "Not enough coins" });
        }
        user.coins -= cost;
        user.healthLevel += 1;
        break;

      case "airplane":
        cost = user.airplaneTier * 100;
        if (user.coins < cost) {
          return res.status(400).json({ error: "Not enough coins" });
        }
        user.coins -= cost;
        user.airplaneTier += 1;
        break;

      default:
        return res.status(400).json({ error: "Invalid upgrade type" });
    }

    await user.save();
    res.json({ message: "Upgrade successful", coins: user.coins });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// دریافت جدول رتبه‌بندی
router.get("/leaderboard", auth, async (req, res) => {
  try {
    const currentLeaderboard = await Leaderboard.findOne({
      endDate: { $gt: new Date() },
    }).populate("rankings.user");

    if (!currentLeaderboard) {
      return res.status(404).json({ error: "No active leaderboard" });
    }

    res.json(currentLeaderboard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// دعوت دوستان
router.post("/referral", auth, async (req, res) => {
  try {
    const { referredTgid } = req.body;

    if (req.user.referrals.includes(referredTgid)) {
      return res.status(400).json({ error: "Already referred this user" });
    }

    // افزودن به لیست دعوت‌شده‌ها و دادن پاداش
    req.user.referrals.push(referredTgid);
    req.user.coins += 10;
    await req.user.save();

    res.json({ message: "Referral successful", coins: req.user.coins });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// بررسی عضویت در کانال و دریافت پاداش
router.post("/check-membership", auth, async (req, res) => {
  try {
    const { platform, username } = req.body;

    // در اینجا باید با API پلتفرم مربوطه بررسی شود
    // برای نمونه، فرض می‌کنیم کاربر عضو شده است
    const offerId = `${platform}-${username}`;

    if (req.user.completedOffers.includes(offerId)) {
      return res.status(400).json({ error: "Already completed this offer" });
    }

    req.user.completedOffers.push(offerId);
    req.user.coins += 10;
    await req.user.save();

    res.json({ message: "Membership verified", coins: req.user.coins });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
