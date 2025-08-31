// config.js
module.exports = {
  mongoURI:
    process.env.MONGODB_URI || "mongodb://localhost:27017/airplane-game",
  port: process.env.PORT || 3000,
};
