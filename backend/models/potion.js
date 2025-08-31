const mongoose = require("mongoose");

const potionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  effect: { type: String, required: true }, // توضیح اثر معجون
  price: { type: Number, required: true },
  imagePath: { type: String, required: true },
  cooldown: { type: Number, default: 0 }, // زمان تأثیر به ثانیه
});

module.exports = mongoose.model("Potion", potionSchema);
