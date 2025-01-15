const axios = require("axios");
const mongoose = require("mongoose");
const logger = require("../utils/logger"); // Pastikan Anda memiliki logger

const COWORKING_API = "https://coworkingspace.up.railway.app/api/secure";
const API_KEY = process.env.COWORKING_API_KEY; // Simpan di .env
const TOKEN = process.env.COWORKING_API_TOKEN; // Simpan di .env

const createCoworkingReservation = async (request, h) => {
  try {
    const { seat_number, reservation_date, sickLeaveId } = request.payload;
    const SickLeave = mongoose.model("SickLeave");

    // Validasi tambahan: Pastikan tanggal reservasi tidak di masa lalu
    const reservationDate = new Date(reservation_date);
    if (reservationDate < new Date()) {
      return h
        .response({
          error: "Invalid reservation date",
          details: "Reservation date cannot be in the past",
        })
        .code(400);
    }
    console.log("API_KEY:", process.env.COWORKING_API_KEY);
    console.log("TOKEN:", process.env.COWORKING_API_TOKEN);

    // Buat reservasi di sistem coworking
    const coworkingResponse = await axios.post(
      `${COWORKING_API}/reservations`,
      {
        seat_number,
        reservation_date,
      },
      {
        headers: {
          "x-api-key": API_KEY, // API key
          "Content-Type": "application/json",
          Authorization: `Bearer ${TOKEN}`, // Gunakan token baru
        },
      }
    );

    // Update data sick leave dengan detail reservasi
    const updatedSickLeave = await SickLeave.findByIdAndUpdate(
      sickLeaveId,
      {
        coworkingReservation: coworkingResponse.data,
      },
      { new: true }
    );

    if (!updatedSickLeave) {
      logger.error(`SickLeave not found: ${sickLeaveId}`);
      return h
        .response({
          error: "SickLeave not found",
        })
        .code(404);
    }

    // Respons sukses
    return h
      .response({
        message: "Reservation created successfully",
        data: coworkingResponse.data,
      })
      .code(201);
  } catch (error) {
    logger.error("Coworking reservation error:", {
      error: error.response?.data || error.message,
      payload: request.payload,
    });

    return h
      .response({
        error: "Failed to create reservation",
        details: error.response?.data?.message || error.message,
      })
      .code(500);
  }
};

const cancelReservation = async (request, h) => {
  try {
    const { reservation_id } = request.params;

    // Batalkan reservasi di sistem coworking
    await axios.delete(`${COWORKING_API}/reservations/${reservation_id}`, {
      headers: {
        "x-api-key": API_KEY, // Hanya gunakan x-api-key
      },
    });

    // Respons sukses
    return h
      .response({
        message: "Reservation cancelled successfully",
      })
      .code(200);
  } catch (error) {
    logger.error("Cancel reservation error:", {
      error: error.response?.data || error.message,
      reservation_id: request.params.reservation_id,
    });

    return h
      .response({
        error: "Failed to cancel reservation",
        details: error.response?.data?.message || error.message,
      })
      .code(500);
  }
};

module.exports = {
  createCoworkingReservation,
  cancelReservation,
};
