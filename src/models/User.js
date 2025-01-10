// models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true, // Pastikan ini ada
    unique: true,
    index: true, // Tambahkan indeks
  },
  email: {
    type: String,
    required: true, // Pastikan ini ada
    unique: true,
    index: true, // Tambahkan indeks
  },
  password: {
    type: String,
    required: true, // Pastikan ini ada
  },
  profilePicture: {
    type: String,
    default: "", // Atur default atau buat field ini tidak wajib
  },
  // Tambahkan field lain jika diperlukan
}, {
  timestamps: true, // Opsional: Menambahkan timestamp otomatis
});

// Hapus indeks unik yang duplikat
// UserSchema.index({ username: 1 }, { unique: true });
// UserSchema.index({ email: 1 }, { unique: true });

// Tidak perlu hook `pre("save")` karena hashing dilakukan di handler
module.exports = mongoose.model("User", UserSchema);
