const express = require("express");
const router = express.Router();
const User = require("../models/user");
const Potion = require("../models/potion");
const Game = require("../models/game");
const Leaderboard = require("../models/leaderboard");

// Middleware برای احراز هویت کاربر تلگرام
// در فایل: routes/api.js

// Middleware برای احراز هویت کاربر تلگرام
const auth = async (req, res, next) => {
  try {
    const tgid = req.headers["x-tgid"] || req.query.tgid || req.body.tgid;
    if (!tgid) {
      return res
        .status(401)
        .json({ error: "Authentication required, tgid missing" });
    }

    const user = await User.findOne({ tgid });

    // <<<< تغییر اصلی اینجاست >>>>
    // اگر کاربری با این tgid پیدا نشد، دیگر کاربر جدید نساز، بلکه خطای 401 برگردان
    if (!user) {
      return res.status(401).json({ error: "User not found with this tgid" });
    }

    req.user = user;
    next();
  } catch (error) {
    // اگر خطای دیگری در دیتابیس رخ داد، خطای 500 برگردان
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
    // Tier 1
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
    {
      id: 3,
      name: "Tier 1 - Model 3",
      image: "assets/images/airplanes/Tier 1/3.png",
    },
    {
      id: 4,
      name: "Tier 1 - Model 4",
      image: "assets/images/airplanes/Tier 1/4.png",
    },
    {
      id: 5,
      name: "Tier 1 - Model 5",
      image: "assets/images/airplanes/Tier 1/5.png",
    },
    {
      id: 6,
      name: "Tier 1 - Model 6",
      image: "assets/images/airplanes/Tier 1/6.png",
    },
    {
      id: 7,
      name: "Tier 1 - Model 7",
      image: "assets/images/airplanes/Tier 1/7.png",
    },
    {
      id: 8,
      name: "Tier 1 - Model 8",
      image: "assets/images/airplanes/Tier 1/8.png",
    },
    {
      id: 9,
      name: "Tier 1 - Model 9",
      image: "assets/images/airplanes/Tier 1/9.png",
    },
    {
      id: 10,
      name: "Tier 1 - Model 10",
      image: "assets/images/airplanes/Tier 1/10.png",
    },
    {
      id: 11,
      name: "Tier 1 - Model 11",
      image: "assets/images/airplanes/Tier 1/11.png",
    },
    {
      id: 12,
      name: "Tier 1 - Model 12",
      image: "assets/images/airplanes/Tier 1/12.png",
    },
    {
      id: 13,
      name: "Tier 1 - Model 13",
      image: "assets/images/airplanes/Tier 1/13.png",
    },
    {
      id: 14,
      name: "Tier 1 - Model 14",
      image: "assets/images/airplanes/Tier 1/14.png",
    },

    // Tier 2
    {
      id: 15,
      name: "Tier 2 - Model 1",
      image: "assets/images/airplanes/Tier 2/1.png",
    },
    {
      id: 16,
      name: "Tier 2 - Model 2",
      image: "assets/images/airplanes/Tier 2/2.png",
    },
    {
      id: 17,
      name: "Tier 2 - Model 3",
      image: "assets/images/airplanes/Tier 2/3.png",
    },
    {
      id: 18,
      name: "Tier 2 - Model 4",
      image: "assets/images/airplanes/Tier 2/4.png",
    },
    {
      id: 19,
      name: "Tier 2 - Model 5",
      image: "assets/images/airplanes/Tier 2/5.png",
    },
    {
      id: 20,
      name: "Tier 2 - Model 6",
      image: "assets/images/airplanes/Tier 2/6.png",
    },
    {
      id: 21,
      name: "Tier 2 - Model 7",
      image: "assets/images/airplanes/Tier 2/7.png",
    },
    {
      id: 22,
      name: "Tier 2 - Model 8",
      image: "assets/images/airplanes/Tier 2/8.png",
    },
    {
      id: 23,
      name: "Tier 2 - Model 9",
      image: "assets/images/airplanes/Tier 2/9.png",
    },
    {
      id: 24,
      name: "Tier 2 - Model 10",
      image: "assets/images/airplanes/Tier 2/10.png",
    },
    {
      id: 25,
      name: "Tier 2 - Model 11",
      image: "assets/images/airplanes/Tier 2/11.png",
    },
    {
      id: 26,
      name: "Tier 2 - Model 12",
      image: "assets/images/airplanes/Tier 2/12.png",
    },
    {
      id: 27,
      name: "Tier 2 - Model 13",
      image: "assets/images/airplanes/Tier 2/13.png",
    },
    {
      id: 28,
      name: "Tier 2 - Model 14",
      image: "assets/images/airplanes/Tier 2/14.png",
    },
    {
      id: 29,
      name: "Tier 2 - Model 15",
      image: "assets/images/airplanes/Tier 2/15.png",
    },
    {
      id: 30,
      name: "Tier 2 - Model 16",
      image: "assets/images/airplanes/Tier 2/16.png",
    },
    {
      id: 31,
      name: "Tier 2 - Model 17",
      image: "assets/images/airplanes/Tier 2/17.png",
    },
    {
      id: 32,
      name: "Tier 2 - Model 18",
      image: "assets/images/airplanes/Tier 2/18.png",
    },
    {
      id: 33,
      name: "Tier 2 - Model 19",
      image: "assets/images/airplanes/Tier 2/19.png",
    },
    {
      id: 34,
      name: "Tier 2 - Model 20",
      image: "assets/images/airplanes/Tier 2/20.png",
    },

    // Tier 3
    {
      id: 35,
      name: "Tier 3 - Model 1",
      image: "assets/images/airplanes/Tier 3/1.png",
    },
    {
      id: 36,
      name: "Tier 3 - Model 2",
      image: "assets/images/airplanes/Tier 3/2.png",
    },
    {
      id: 37,
      name: "Tier 3 - Model 3",
      image: "assets/images/airplanes/Tier 3/3.png",
    },
    {
      id: 38,
      name: "Tier 3 - Model 4",
      image: "assets/images/airplanes/Tier 3/4.png",
    },
    {
      id: 39,
      name: "Tier 3 - Model 5",
      image: "assets/images/airplanes/Tier 3/5.png",
    },
    {
      id: 40,
      name: "Tier 3 - Model 6",
      image: "assets/images/airplanes/Tier 3/6.png",
    },
    {
      id: 41,
      name: "Tier 3 - Model 7",
      image: "assets/images/airplanes/Tier 3/7.png",
    },
    {
      id: 42,
      name: "Tier 3 - Model 8",
      image: "assets/images/airplanes/Tier 3/8.png",
    },
    {
      id: 43,
      name: "Tier 3 - Model 9",
      image: "assets/images/airplanes/Tier 3/9.png",
    },
    {
      id: 44,
      name: "Tier 3 - Model 10",
      image: "assets/images/airplanes/Tier 3/10.png",
    },
    {
      id: 45,
      name: "Tier 3 - Model 11",
      image: "assets/images/airplanes/Tier 3/11.png",
    },
    {
      id: 46,
      name: "Tier 3 - Model 12",
      image: "assets/images/airplanes/Tier 3/12.png",
    },
    {
      id: 47,
      name: "Tier 3 - Model 13",
      image: "assets/images/airplanes/Tier 3/13.png",
    },
    {
      id: 48,
      name: "Tier 3 - Model 14",
      image: "assets/images/airplanes/Tier 3/14.png",
    },
    {
      id: 49,
      name: "Tier 3 - Model 15",
      image: "assets/images/airplanes/Tier 3/15.png",
    },
    {
      id: 50,
      name: "Tier 3 - Model 16",
      image: "assets/images/airplanes/Tier 3/16.png",
    },
    {
      id: 51,
      name: "Tier 3 - Model 17",
      image: "assets/images/airplanes/Tier 3/17.png",
    },
    {
      id: 52,
      name: "Tier 3 - Model 18",
      image: "assets/images/airplanes/Tier 3/18.png",
    },
    {
      id: 53,
      name: "Tier 3 - Model 19",
      image: "assets/images/airplanes/Tier 3/19.png",
    },

    // Tier 4
    {
      id: 54,
      name: "Tier 4 - Model 1",
      image: "assets/images/airplanes/Tier 4/1.png",
    },
    {
      id: 55,
      name: "Tier 4 - Model 2",
      image: "assets/images/airplanes/Tier 4/2.png",
    },
    {
      id: 56,
      name: "Tier 4 - Model 3",
      image: "assets/images/airplanes/Tier 4/3.png",
    },
    {
      id: 57,
      name: "Tier 4 - Model 4",
      image: "assets/images/airplanes/Tier 4/4.png",
    },
    {
      id: 58,
      name: "Tier 4 - Model 5",
      image: "assets/images/airplanes/Tier 4/5.png",
    },
    {
      id: 59,
      name: "Tier 4 - Model 6",
      image: "assets/images/airplanes/Tier 4/6.png",
    },
    {
      id: 60,
      name: "Tier 4 - Model 7",
      image: "assets/images/airplanes/Tier 4/7.png",
    },
    {
      id: 61,
      name: "Tier 4 - Model 8",
      image: "assets/images/airplanes/Tier 4/8.png",
    },
    {
      id: 62,
      name: "Tier 4 - Model 9",
      image: "assets/images/airplanes/Tier 4/9.png",
    },
  ]);
});

router.get("/assets/bullets", (req, res) => {
  res.json([
    { id: 1, name: "Level 1", image: "assets/images/bullets/lvl1.png" },
    { id: 2, name: "Level 2", image: "assets/images/bullets/lvl2.png" },
    { id: 2, name: "Level 3", image: "assets/images/bullets/lvl3.png" },
    { id: 2, name: "Level 4", image: "assets/images/bullets/lvl4.png" },
    { id: 2, name: "Level 5", image: "assets/images/bullets/lvl5.png" },
    { id: 2, name: "Level 6", image: "assets/images/bullets/lvl6.png" },
  ]);
});
// ورود کاربر
// در فایل: routes/api.js
// این تابع را به طور کامل جایگزین تابع لاگین قبلی کنید.

// ورود کاربر
router.post("/login", async (req, res) => {
  try {
    // <<<< تغییر ۱: tgid را نیز از body درخواست دریافت می‌کنیم >>>>
    const { username, password, tgid } = req.body;

    // پیدا کردن کاربر بر اساس نام کاربری
    const user = await User.findOne({ username });

    // بررسی اولیه: آیا کاربر وجود دارد و رمز عبور صحیح است
    if (!user || user.password !== password) {
      return res
        .status(401)
        .json({ error: "نام کاربری یا رمز عبور اشتباه است" });
    }

    // <<<< تغییر ۲ (بخش اصلی): بررسی مطابقت tgid >>>>
    // اگر tgid ارسال شده با tgid ذخیره شده در دیتابیس مطابقت نداشت، خطا برگردان
    if (user.tgid !== tgid) {
      return res
        .status(401)
        .json({ error: "آیدی تلگرام با این حساب کاربری مطابقت ندارد" });
    }

    // اگر همه موارد صحیح بود، اطلاعات کاربر را برگردان
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
