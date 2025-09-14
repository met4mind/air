const mongoose = require("mongoose");
const Potion = require("./models/potion");
const config = require("./config");

const potionsData = [
  {
    name: "معجون سرعت",
    description: "سرعت حرکت هواپیما را افزایش می‌دهد",
    effect: "افزایش ۲۰٪ سرعت به مدت ۳۰ ثانیه",
    price: 50,
    imagePath: "assets/images/potions/speed.png",
    cooldown: 30,
  },
  {
    name: "معجون قدرت",
    description: "قدرت حمله را افزایش می‌دهد",
    effect: "افزایش ۲۵٪ damage به مدت ۲۰ ثانیه",
    price: 70,
    imagePath: "assets/images/potions/power.png",
    cooldown: 20,
  },
  {
    name: "معجون محافظ",
    description: "یک سپر دفاعی ایجاد می‌کند",
    effect: "ایمنی کامل در برابر damage به مدت ۱۰ ثانیه",
    price: 100,
    imagePath: "assets/images/potions/shield.png",
    cooldown: 10,
  },
  {
    name: "معجون درمان",
    description: "سلامتی هواپیما را بازیابی می‌کند",
    effect: "بازیابی ۵۰٪ سلامت",
    price: 80,
    imagePath: "assets/images/potions/heal.png",
    cooldown: 0,
  },
];

async function seedPotions() {
  try {
    await mongoose.connect(config.mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    await Potion.deleteMany({});
    await Potion.insertMany(potionsData);

    console.log("Potions data seeded successfully");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding data:", error);
    process.exit(1);
  }
}

seedPotions();
