const mongoose = require("mongoose");

const SickLeaveSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
  },
  username: {
    type: String,
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
  status: {
    type: String,
    required: true,
    enum: ["Diajukan", "Disetujui", "Ditolak"],
    default: "Diajukan",
  },
  gender: {
    type: String,
    required: true,
    enum: ["male", "female", "other"], // Jenis kelamin
  },
  age: {
    type: Number,
    required: true, // Umur harus berupa angka
  },
  answers: [{
    questionId: String,
    answer: String
  }],
});

module.exports = mongoose.model("SickLeave", SickLeaveSchema);
