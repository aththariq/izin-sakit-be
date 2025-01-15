// config.js
const path = require("path");
const fs = require("fs");

const tempPath = path.join(__dirname, "../temp");

// Buat direktori temp jika belum ada
if (!fs.existsSync(tempPath)) {
  fs.mkdirSync(tempPath, { recursive: true });
}

module.exports = { tempPath };
