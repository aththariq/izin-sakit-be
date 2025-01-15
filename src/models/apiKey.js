const mongoose = require("mongoose");
const crypto = require("crypto");

const apiKeySchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    required: true,
  },
  userId: {
    // Tambahkan field userId
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // Referensi ke model User
    required: true, // Wajib diisi
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastUsed: {
    type: Date,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

// Method untuk generate API key
apiKeySchema.statics.generateKey = function () {
  return crypto.randomBytes(32).toString("hex");
};

module.exports = mongoose.model("ApiKey", apiKeySchema);
