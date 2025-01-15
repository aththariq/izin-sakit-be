const jwt = require("jsonwebtoken");
const ApiKey = require("../models/apiKey");
const logger = require("../utils/logger");

const authenticate = async (request, h) => {
  // Cek API Key terlebih dahulu
  const apiKey = request.headers["x-api-key"];
  if (apiKey) {
    const key = await ApiKey.findOne({ key: apiKey, isActive: true }).populate(
      "userId"
    );
    if (!key) {
      return h.response({ message: "Invalid API key" }).code(401).takeover();
    }

    // Update last used timestamp
    key.lastUsed = new Date();
    await key.save();

    // Simpan userId dan username di request.auth.credentials
    request.auth = {
      credentials: {
        userId: key.userId._id, // Ambil userId
        username: key.userId.username, // Ambil username
      },
    };
    return h.continue;
  }

  // Jika tidak ada API Key, cek Bearer Token
  const authHeader = request.headers.authorization;
  if (!authHeader) {
    logger.warn("Authorization header missing");
    return h
      .response({ message: "Authorization header missing" })
      .code(401)
      .takeover();
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    logger.warn("Token missing in Authorization header");
    return h.response({ message: "Token missing" }).code(401).takeover();
  }

  try {
    // Verifikasi token JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Simpan payload JWT di request.auth.credentials
    request.auth = {
      credentials: {
        userId: decoded.id, // Pastikan payload JWT mengandung `id`
        email: decoded.email,
        username: decoded.username,
      },
    };

    return h.continue;
  } catch (error) {
    logger.error("Invalid token:", error.message);
    return h.response({ message: "Invalid token" }).code(401).takeover();
  }
};

module.exports = authenticate;
