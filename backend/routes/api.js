const express = require("express");
const router = express.Router();
const User = require("../models/user");
const Potion = require("../models/potion");
const Game = require("../models/game");
const {
  airplanesData,
  potionsData,
  bulletsData,
  wingmenData,
} = require("../gameData");
const Leaderboard = require("../models/leaderboard");
const crypto = require("crypto");
const fetch = require('node-fetch');
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

// در فایل: routes/api.js
// این مسیر جدید را قبل از module.exports = router; اضافه کنید

// مسیر داخلی برای ساختن/به‌روزرسانی لیدربورد
// در فایل backend/routes/api.js

// در فایل backend/routes/api.js

router.get("/leaderboard", auth, async (req, res) => {
  try {
    const { type = "daily" } = req.query;

    // <<<< بخش جدید: قبل از جستجو، از وجود لیدربورد اطمینان حاصل کن >>>>
    const Leaderboard = require("../models/leaderboard"); // اطمینان از دسترسی به مدل
    const now = new Date();
    let leaderboard = await Leaderboard.findOne({
      type: type,
      endDate: { $gt: now },
    });

    // اگر لیدربورد فعال پیدا نشد، یکی بساز
    if (!leaderboard) {
      // این بخش کد از server.js کپی شده تا در لحظه لیدربورد را بسازد
      let startDate, endDate;
      if (type === "daily") {
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(now.setHours(23, 59, 59, 999));
      } else if (type === "weekly") {
        const firstDayOfWeek = new Date(
          now.setDate(
            now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)
          )
        );
        startDate = new Date(firstDayOfWeek.setHours(0, 0, 0, 0));
        const lastDayOfWeek = new Date(startDate);
        lastDayOfWeek.setDate(startDate.getDate() + 6);
        endDate = new Date(lastDayOfWeek.setHours(23, 59, 59, 999));
      } else {
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
      leaderboard = await Leaderboard.create({
        type,
        startDate,
        endDate,
        rankings: [],
      });
    }
    // <<<< پایان بخش جدید >>>>

    // حالا با اطمینان، لیدربورد را با اطلاعات کاربران populate کن
    const populatedLeaderboard = await Leaderboard.findById(leaderboard._id)
      .populate("rankings.user", "username")
      .lean();

    if (populatedLeaderboard && populatedLeaderboard.rankings) {
      populatedLeaderboard.rankings.sort((a, b) => {
        const scoreA = (a.wins || 0) - (a.losses || 0);
        const scoreB = (b.wins || 0) - (b.losses || 0);
        return scoreB - scoreA;
      });
    }

    res.json(populatedLeaderboard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post("/leaderboard/generate", async (req, res) => {
  try {
    // ۱. همه کاربران را پیدا کرده و بر اساس ستاره مرتب کن
    const sortedUsers = await User.find({}).sort({ stars: -1 }).limit(100); // محدودیت ۱۰۰ نفر برتر

    // ۲. رتبه‌بندی را بر اساس کاربران مرتب‌شده بساز
    const rankings = sortedUsers.map((user, index) => ({
      user: user._id,
      stars: user.stars,
      position: index + 1,
    }));

    // ۳. یک لیدربورد فعال پیدا کن یا یک لیدربورد جدید بساز
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const updatedLeaderboard = await Leaderboard.findOneAndUpdate(
      { endDate: { $gt: new Date() } }, // پیدا کردن لیدربورد فعال
      {
        $set: {
          rankings: rankings,
          startDate: new Date(),
          endDate: sevenDaysFromNow,
        },
      },
      {
        new: true, // اگر پیدا شد، داکیومنت آپدیت شده را برگردان
        upsert: true, // اگر پیدا نشد، یک داکیومنت جدید با این اطلاعات بساز
        setDefaultsOnInsert: true,
      }
    );

    res.status(200).json({
      message: "Leaderboard generated/updated successfully.",
      leaderboard: updatedLeaderboard,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to generate leaderboard: " + error.message });
  }
});
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
router.get("/game-data/airplanes", (req, res) => {
  res.json(airplanesData);
});
// دریافت لیست معجون‌ها
// کد اصلاح‌شده
router.get("/potions", auth, async (req, res) => {
  try {
    const allPotions = await Potion.find({});
    res.json(allPotions);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to retrieve potions: " + error.message });
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
// router.get("/assets/airplanes", (req, res) => {
//   res.json([
//     // Tier 1
//     {
//       id: 1,
//       name: "Tier 1 - Model 1",
//       image: "assets/images/airplanes/Tier 1/1.png",
//     },
//     {
//       id: 2,
//       name: "Tier 1 - Model 2",
//       image: "assets/images/airplanes/Tier 1/2.png",
//     },
//     {
//       id: 3,
//       name: "Tier 1 - Model 3",
//       image: "assets/images/airplanes/Tier 1/3.png",
//     },
//     {
//       id: 4,
//       name: "Tier 1 - Model 4",
//       image: "assets/images/airplanes/Tier 1/4.png",
//     },
//     {
//       id: 5,
//       name: "Tier 1 - Model 5",
//       image: "assets/images/airplanes/Tier 1/5.png",
//     },
//     {
//       id: 6,
//       name: "Tier 1 - Model 6",
//       image: "assets/images/airplanes/Tier 1/6.png",
//     },
//     {
//       id: 7,
//       name: "Tier 1 - Model 7",
//       image: "assets/images/airplanes/Tier 1/7.png",
//     },
//     {
//       id: 8,
//       name: "Tier 1 - Model 8",
//       image: "assets/images/airplanes/Tier 1/8.png",
//     },
//     {
//       id: 9,
//       name: "Tier 1 - Model 9",
//       image: "assets/images/airplanes/Tier 1/9.png",
//     },
//     {
//       id: 10,
//       name: "Tier 1 - Model 10",
//       image: "assets/images/airplanes/Tier 1/10.png",
//     },
//     {
//       id: 11,
//       name: "Tier 1 - Model 11",
//       image: "assets/images/airplanes/Tier 1/11.png",
//     },
//     {
//       id: 12,
//       name: "Tier 1 - Model 12",
//       image: "assets/images/airplanes/Tier 1/12.png",
//     },
//     {
//       id: 13,
//       name: "Tier 1 - Model 13",
//       image: "assets/images/airplanes/Tier 1/13.png",
//     },
//     {
//       id: 14,
//       name: "Tier 1 - Model 14",
//       image: "assets/images/airplanes/Tier 1/14.png",
//     },

//     // Tier 2
//     {
//       id: 15,
//       name: "Tier 2 - Model 1",
//       image: "assets/images/airplanes/Tier 2/1.png",
//     },
//     {
//       id: 16,
//       name: "Tier 2 - Model 2",
//       image: "assets/images/airplanes/Tier 2/2.png",
//     },
//     {
//       id: 17,
//       name: "Tier 2 - Model 3",
//       image: "assets/images/airplanes/Tier 2/3.png",
//     },
//     {
//       id: 18,
//       name: "Tier 2 - Model 4",
//       image: "assets/images/airplanes/Tier 2/4.png",
//     },
//     {
//       id: 19,
//       name: "Tier 2 - Model 5",
//       image: "assets/images/airplanes/Tier 2/5.png",
//     },
//     {
//       id: 20,
//       name: "Tier 2 - Model 6",
//       image: "assets/images/airplanes/Tier 2/6.png",
//     },
//     {
//       id: 21,
//       name: "Tier 2 - Model 7",
//       image: "assets/images/airplanes/Tier 2/7.png",
//     },
//     {
//       id: 22,
//       name: "Tier 2 - Model 8",
//       image: "assets/images/airplanes/Tier 2/8.png",
//     },
//     {
//       id: 23,
//       name: "Tier 2 - Model 9",
//       image: "assets/images/airplanes/Tier 2/9.png",
//     },
//     {
//       id: 24,
//       name: "Tier 2 - Model 10",
//       image: "assets/images/airplanes/Tier 2/10.png",
//     },
//     {
//       id: 25,
//       name: "Tier 2 - Model 11",
//       image: "assets/images/airplanes/Tier 2/11.png",
//     },
//     {
//       id: 26,
//       name: "Tier 2 - Model 12",
//       image: "assets/images/airplanes/Tier 2/12.png",
//     },
//     {
//       id: 27,
//       name: "Tier 2 - Model 13",
//       image: "assets/images/airplanes/Tier 2/13.png",
//     },
//     {
//       id: 28,
//       name: "Tier 2 - Model 14",
//       image: "assets/images/airplanes/Tier 2/14.png",
//     },
//     {
//       id: 29,
//       name: "Tier 2 - Model 15",
//       image: "assets/images/airplanes/Tier 2/15.png",
//     },
//     {
//       id: 30,
//       name: "Tier 2 - Model 16",
//       image: "assets/images/airplanes/Tier 2/16.png",
//     },
//     {
//       id: 31,
//       name: "Tier 2 - Model 17",
//       image: "assets/images/airplanes/Tier 2/17.png",
//     },
//     {
//       id: 32,
//       name: "Tier 2 - Model 18",
//       image: "assets/images/airplanes/Tier 2/18.png",
//     },
//     {
//       id: 33,
//       name: "Tier 2 - Model 19",
//       image: "assets/images/airplanes/Tier 2/19.png",
//     },
//     {
//       id: 34,
//       name: "Tier 2 - Model 20",
//       image: "assets/images/airplanes/Tier 2/20.png",
//     },

//     // Tier 3
//     {
//       id: 35,
//       name: "Tier 3 - Model 1",
//       image: "assets/images/airplanes/Tier 3/1.png",
//     },
//     {
//       id: 36,
//       name: "Tier 3 - Model 2",
//       image: "assets/images/airplanes/Tier 3/2.png",
//     },
//     {
//       id: 37,
//       name: "Tier 3 - Model 3",
//       image: "assets/images/airplanes/Tier 3/3.png",
//     },
//     {
//       id: 38,
//       name: "Tier 3 - Model 4",
//       image: "assets/images/airplanes/Tier 3/4.png",
//     },
//     {
//       id: 39,
//       name: "Tier 3 - Model 5",
//       image: "assets/images/airplanes/Tier 3/5.png",
//     },
//     {
//       id: 40,
//       name: "Tier 3 - Model 6",
//       image: "assets/images/airplanes/Tier 3/6.png",
//     },
//     {
//       id: 41,
//       name: "Tier 3 - Model 7",
//       image: "assets/images/airplanes/Tier 3/7.png",
//     },
//     {
//       id: 42,
//       name: "Tier 3 - Model 8",
//       image: "assets/images/airplanes/Tier 3/8.png",
//     },
//     {
//       id: 43,
//       name: "Tier 3 - Model 9",
//       image: "assets/images/airplanes/Tier 3/9.png",
//     },
//     {
//       id: 44,
//       name: "Tier 3 - Model 10",
//       image: "assets/images/airplanes/Tier 3/10.png",
//     },
//     {
//       id: 45,
//       name: "Tier 3 - Model 11",
//       image: "assets/images/airplanes/Tier 3/11.png",
//     },
//     {
//       id: 46,
//       name: "Tier 3 - Model 12",
//       image: "assets/images/airplanes/Tier 3/12.png",
//     },
//     {
//       id: 47,
//       name: "Tier 3 - Model 13",
//       image: "assets/images/airplanes/Tier 3/13.png",
//     },
//     {
//       id: 48,
//       name: "Tier 3 - Model 14",
//       image: "assets/images/airplanes/Tier 3/14.png",
//     },
//     {
//       id: 49,
//       name: "Tier 3 - Model 15",
//       image: "assets/images/airplanes/Tier 3/15.png",
//     },
//     {
//       id: 50,
//       name: "Tier 3 - Model 16",
//       image: "assets/images/airplanes/Tier 3/16.png",
//     },
//     {
//       id: 51,
//       name: "Tier 3 - Model 17",
//       image: "assets/images/airplanes/Tier 3/17.png",
//     },
//     {
//       id: 52,
//       name: "Tier 3 - Model 18",
//       image: "assets/images/airplanes/Tier 3/18.png",
//     },
//     {
//       id: 53,
//       name: "Tier 3 - Model 19",
//       image: "assets/images/airplanes/Tier 3/19.png",
//     },

//     // Tier 4
//     {
//       id: 54,
//       name: "Tier 4 - Model 1",
//       image: "assets/images/airplanes/Tier 4/1.png",
//     },
//     {
//       id: 55,
//       name: "Tier 4 - Model 2",
//       image: "assets/images/airplanes/Tier 4/2.png",
//     },
//     {
//       id: 56,
//       name: "Tier 4 - Model 3",
//       image: "assets/images/airplanes/Tier 4/3.png",
//     },
//     {
//       id: 57,
//       name: "Tier 4 - Model 4",
//       image: "assets/images/airplanes/Tier 4/4.png",
//     },
//     {
//       id: 58,
//       name: "Tier 4 - Model 5",
//       image: "assets/images/airplanes/Tier 4/5.png",
//     },
//     {
//       id: 59,
//       name: "Tier 4 - Model 6",
//       image: "assets/images/airplanes/Tier 4/6.png",
//     },
//     {
//       id: 60,
//       name: "Tier 4 - Model 7",
//       image: "assets/images/airplanes/Tier 4/7.png",
//     },
//     {
//       id: 61,
//       name: "Tier 4 - Model 8",
//       image: "assets/images/airplanes/Tier 4/8.png",
//     },
//     {
//       id: 62,
//       name: "Tier 4 - Model 9",
//       image: "assets/images/airplanes/Tier 4/9.png",
//     },
//   ]);
// });

router.get("/assets/bullets", (req, res) => {
  res.json(bulletsData);
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
router.get("/game-data/wingmen", (req, res) => {
  res.json(wingmenData);
});
// ارتقاء ویژگی‌ها
router.post("/upgrade", auth, async (req, res) => {
  try {
    // airplaneTier و airplaneStyle را هم از بدنه درخواست دریافت می‌کنیم
    const { type, airplaneTier, airplaneStyle } = req.body;
    const user = req.user;

    if (type === "airplane") {
      const currentTier = user.airplaneTier;
      const currentStyle = user.airplaneStyle;
      const currentIndex = airplanesData.findIndex(
        (p) => p.tier === currentTier && p.style === currentStyle
      );
      const nextPlane = airplanesData[currentIndex + 1];

      if (!nextPlane) {
        return res
          .status(400)
          .json({ error: "شما به آخرین لول هواپیما رسیدید" });
      }

      const cost = nextPlane.price;
      if (user.coins < cost) {
        return res.status(400).json({ error: "سکه کافی نیست" });
      }

      user.coins -= cost;
      user.airplaneTier = nextPlane.tier;
      user.airplaneStyle = nextPlane.style;
    } else if (type === "bullet") {
      // <<<< این بلوک جدید اضافه شده است >>>>
      const airplaneKey = `${airplaneTier}_${airplaneStyle}`;
      const currentLevel =
        (user.airplaneBulletLevels &&
          user.airplaneBulletLevels.get(airplaneKey)) ||
        1;

      if (currentLevel >= 4) {
        return res
          .status(400)
          .json({ error: "گلوله به حداکثر سطح ارتقاء رسیده است" });
      }

      const BaseValue = 1000;
      const cost = Math.ceil(
        BaseValue * 0.06 * Math.pow(1.12, currentLevel - 1)
      );

      if (user.coins < cost) {
        return res.status(400).json({ error: "سکه شما برای ارتقاء کافی نیست" });
      }

      user.coins -= cost;
      user.airplaneBulletLevels.set(airplaneKey, currentLevel + 1);
    } else if (type === "wingman") {
      // <<<< منطق جدید برای ارتقاء همراهان >>>>
      const currentLevel = user.wingmanLevel || 1;
      if (currentLevel >= 12) {
        return res
          .status(400)
          .json({ error: "همراه شما به حداکثر سطح رسیده است" });
      }

      const nextWingmanData = wingmenData.find(
        (w) => w.level === currentLevel + 1
      );
      if (!nextWingmanData) {
        return res.status(404).json({ error: "اطلاعات سطح بعدی یافت نشد" });
      }

      const cost = wingmenData.find(
        (w) => w.level === currentLevel
      ).upgradeCost;
      if (user.coins < cost) {
        return res.status(400).json({ error: "سکه کافی برای ارتقا نیست" });
      }

      user.coins -= cost;
      user.wingmanLevel += 1;
      // <<<< پایان منطق جدید >>>>
    } else {
      return res.status(400).json({ error: "نوع ارتقاء نامعتبر است" });
    }

    await user.save();
    res.json({ message: "Upgrade successful", user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/auth/telegram", async (req, res) => {
  const { initData, referrerTgid } = req.body;
  // از فایل .env خوانده می‌شود یا از مقدار پیش‌فرض استفاده می‌کند
  const BOT_TOKEN = process.env.BOT_TOKEN || "YOUR_BOT_TOKEN";

  // --- لاگ‌های جدید برای عیب‌یابی ---
  console.log("--- [AUTH/TELEGRAM] Request Received ---");
  console.log("Received initData:", initData);
  // برای امنیت، فقط بخش کوچکی از توکن را لاگ می‌گیریم
  console.log("Using BOT_TOKEN starting with:", BOT_TOKEN.substring(0, 8));

  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");
    urlParams.delete("hash");
    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(BOT_TOKEN)
      .digest();
    const calculatedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    console.log("Hash from Telegram:", hash);
    console.log("Calculated Hash:", calculatedHash);

    if (calculatedHash !== hash) {
      console.error("HASH MISMATCH! Authentication failed.");
      // این خطا به فرانت‌اند ارسال می‌شود
      return res.status(403).json({ error: "Authentication failed: Invalid hash" });
    }

    console.log("Hash validation successful.");
    // --- پایان لاگ‌های عیب‌یابی ---

    const user_data = JSON.parse(urlParams.get("user"));
    const tgid = user_data.id.toString();

    let user = await User.findOne({ tgid });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = new User({
        tgid: tgid,
        username: user_data.username || `user_${tgid}`,
        first_name: user_data.first_name,
        last_name: user_data.last_name || "",
      });
      await user.save();
      console.log("New user created:", tgid);
    }

    if (isNewUser && referrerTgid && referrerTgid !== tgid) {
      const referrer = await User.findOne({ tgid: referrerTgid });
      if (referrer) {
        referrer.coins += 10;
        referrer.referrals.push(tgid);
        await referrer.save();

        user.coins += 5;
        await user.save();
        console.log(`Referral processed for user ${tgid} by ${referrerTgid}`);
      }
    }

    console.log("Authentication successful for user:", tgid);
    res.json(user);

  } catch (error) {
    console.error("Error in Telegram authentication logic:", error);
    res.status(500).json({ error: "Server error during authentication." });
  }
});
// اندپوینت قدیمی /api/user هنوز نیاز به یک روش احراز هویت امن دارد
// ما از tgid که در هدر ارسال می‌شود استفاده می‌کنیم
const secureAuth = async (req, res, next) => {
  const tgid = req.headers["x-tgid"];
  if (!tgid) {
    return res.status(401).json({ error: "TGID missing" });
  }
  const user = await User.findOne({ tgid });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  req.user = user;
  next();
};
// دریافت جدول رتبه‌بندی
// در فایل: routes/api.js
// این مسیر جدید را قبل از module.exports = router; اضافه کنید

// مسیر داخلی برای ساختن/به‌روزرسانی لیدربورد
router.post("/leaderboard/generate", async (req, res) => {
  try {
    // ۱. همه کاربران را پیدا کرده و بر اساس ستاره مرتب کن
    const sortedUsers = await User.find({}).sort({ stars: -1 }).limit(100); // محدودیت ۱۰۰ نفر برتر

    // ۲. رتبه‌بندی را بر اساس کاربران مرتب‌شده بساز
    const rankings = sortedUsers.map((user, index) => ({
      user: user._id,
      stars: user.stars,
      position: index + 1,
    }));

    // ۳. یک لیدربورد فعال پیدا کن یا یک لیدربورد جدید بساز
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const updatedLeaderboard = await Leaderboard.findOneAndUpdate(
      { endDate: { $gt: new Date() } }, // پیدا کردن لیدربورد فعال
      {
        $set: {
          rankings: rankings,
          startDate: new Date(),
          endDate: sevenDaysFromNow,
        },
      },
      {
        new: true, // اگر پیدا شد، داکیومنت آپدیت شده را برگردان
        upsert: true, // اگر پیدا نشد، یک داکیومنت جدید با این اطلاعات بساز
        setDefaultsOnInsert: true,
      }
    );

    res.status(200).json({
      message: "Leaderboard generated/updated successfully.",
      leaderboard: updatedLeaderboard,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to generate leaderboard: " + error.message });
  }
});

// جدید: مسیر برای تبدیل ستاره به سکه
router.post("/shop/exchange-stars", auth, async (req, res) => {
  try {
    const { starsToSpend } = req.body;
    const user = req.user;

    if (!starsToSpend || starsToSpend <= 0) {
      return res.status(400).json({ error: "تعداد ستاره نامعتبر است" });
    }

    if (user.stars < starsToSpend) {
      return res.status(400).json({ error: "تعداد ستاره‌های شما کافی نیست" });
    }

    // هر ستاره معادل ۱۰ سکه است (می‌توانید این نرخ را تغییر دهید)
    const coinsGained = starsToSpend * 10;

    user.stars -= starsToSpend;
    user.coins += coinsGained;

    await user.save();

    res.json({
      message: "تبدیل با موفقیت انجام شد",
      stars: user.stars,
      coins: user.coins,
    });
  } catch (error) {
    res.status(500).json({ error: "خطا در پردازش درخواست: " + error.message });
  }
});
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
  const { channelId } = req.body;
  const user = req.user;
  const BOT_TOKEN = process.env.BOT_TOKEN;

  if (!channelId) {
    return res.status(400).json({ error: "Channel ID is required." });
  }

  // چک می‌کنیم که آیا کاربر قبلاً این پاداش را دریافت کرده است
  if (user.completedOffers.includes(channelId)) {
    return res.status(400).json({ error: "شما قبلاً پاداش این کانال را دریافت کرده‌اید." });
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${channelId}&user_id=${user.tgid}`
    );
    const data = await response.json();

    if (data.ok) {
      const status = data.result.status;
      // اگر کاربر عضو، ادمین یا سازنده کانال باشد
      if (['member', 'administrator', 'creator'].includes(status)) {
        
        user.coins += 10; // مقدار پاداش
        user.completedOffers.push(channelId); // ثبت کردن پیشنهاد انجام شده
        await user.save();

        return res.json({
          message: "عضویت شما تایید شد! ۱۰ سکه پاداش گرفتید.",
          coins: user.coins,
        });
      }
    }
    // اگر کاربر عضو نبود
    return res.status(400).json({ error: "شما هنوز در کانال عضو نشده‌اید." });

  } catch (error) {
    console.error("Error checking membership:", error);
    return res.status(500).json({ error: "خطا در برقراری ارتباط با سرور تلگرام." });
  }
});

module.exports = router;
