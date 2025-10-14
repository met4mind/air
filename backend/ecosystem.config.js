module.exports = {
  apps: [{
    name: 'telegram-game-backend',
    script: 'server.js',
    watch: false,
    env: {
      "NODE_ENV": "production",
      "BOT_TOKEN": "8197274939:AAEbXxqfqJc3s5PV0M-2J688eIdgERORWUw" // <<--- توکن واقعی خود را اینجا قرار دهید
    }
  }]
};
