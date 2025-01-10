const mongoose = require('mongoose');

// Check if model already exists to prevent duplicate registration
const SickLeave = mongoose.models.SickLeave || mongoose.model('SickLeave', new mongoose.Schema({
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
  otherReason: { // Added field for additional reasons
    type: String,
    required: false,
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
    type: Number, // Changed back from String to Number
    required: true, // Umur harus berupa number
  },
  institution: { // Added field for institution name
    type: String,
    required: true,
  },
  phoneNumber: { // Added field for phone number
    type: String,
    required: true,
  },
  contactEmail: { // Added field for contact email
    type: String,
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  answers: [
    {
      questionId: { type: String, required: true },
      answer: { type: String, required: true },
    },
  ],
  // Add analysis fields
  analisis: { type: String },
  rekomendasi: { type: String },
  catatan: { type: String },
  coworkingReservation: {
    type: Object,
    required: false
  }
}, {
  timestamps: true
}));

module.exports = SickLeave;
