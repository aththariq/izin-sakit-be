// handlers/coworkingHandler.js
const axios = require("axios");
const mongoose = require('mongoose');

const COWORKING_API = "https://coworkingspace.up.railway.app/api/secure";
const API_KEY =
  "fbc95f8588c50901aa95b850268b5d1632ca318768034fd7f72a50c57a4af785";

const TOKEN ="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmaXJzYSIsImV4cCI6MTc2ODA1MDMyOX0.3vD2BS30S1PToEkeGdA0VHvFC61BmYhbmdineZMS8Ok"

const createCoworkingReservation = async (request, h) => {
  try {
    const { seat_number, reservation_date, sickLeaveId } = request.payload;
    const SickLeave = mongoose.model('SickLeave');

    // First, create reservation in coworking system
    const coworkingResponse = await axios.post(
      `${COWORKING_API}/reservations`,
      {
        seat_number,
        reservation_date,
      },
      {
        headers: {
          "x-api-key": API_KEY,
          "Content-Type": "application/json",
          "Authorization": `Bearer ${TOKEN}`
        },
      }
    );

    // Then update the sick leave with the reservation details
    const updatedSickLeave = await SickLeave.findByIdAndUpdate(
      sickLeaveId,
      {
        coworkingReservation: coworkingResponse.data
      },
      { new: true }
    );

    if (!updatedSickLeave) {
      return h.response({
        error: "SickLeave not found",
      }).code(404);
    }

    return h.response({
      message: "Reservation created successfully",
      data: coworkingResponse.data
    }).code(201);

  } catch (error) {
    console.error("Coworking reservation error:", error.response?.data || error.message);
    return h.response({
      error: "Failed to create reservation",
      details: error.response?.data?.message || error.message,
    }).code(500);
  }
};

const cancelReservation = async (request, h) => {
  try {
    const { reservation_id } = request.params;
    await axios.delete(`${COWORKING_API}/reservations/${reservation_id}`, {
      headers: { "x-api-key": API_KEY },
    });
    return h
      .response({ message: "Reservation cancelled successfully" })
      .code(200);
  } catch (error) {
    return h
      .response({
        error: "Failed to cancel reservation",
        details: error.message,
      })
      .code(500);
  }
};

module.exports = {
  createCoworkingReservation,
  cancelReservation,
};
