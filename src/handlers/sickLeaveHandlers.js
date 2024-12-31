const axios = require("axios");
require("dotenv").config(); // Pastikan dotenv sudah di-load

const { v4: uuidv4 } = require("uuid");
const SickLeave = require("../models/SickLeave");

// Fungsi untuk membuat form sick leave
const createSickLeaveForm = async (request, h) => {
  const {
    fullName,
    position,
    institution,
    startDate,
    sickReason,
    otherReason,
    gender,
    age,
  } = request.payload;

  try {
    // Generate follow-up questions using Grok AI
    const grokResponse = await axios.post(
      "https://api.x.ai/v1/chat/completions",
      {
        model: "grok-beta",
        messages: [
          {
            role: "system",
            content: "You are a medical assistant generating follow-up questions for a sick leave application. Generate 3-5 relevant questions based on the patient's symptoms. Return only the questions in a JSON array format.",
          },
          {
            role: "user",
            content: `Generate follow-up questions for a patient with: ${sickReason} ${otherReason ? `and ${otherReason}` : ''}`,
          },
        ],
        temperature: 0.7,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROK_AI_API_KEY}`,
        },
      }
    );

    // Parse dan format pertanyaan dari response Grok
    const aiGeneratedQuestions = JSON.parse(grokResponse.data.choices[0].message.content).map((question, index) => ({
      id: `q${index + 1}`,
      text: question,
      type: "open-ended"
    }));

    // Simpan form sick leave ke database
    const sickLeave = new SickLeave({
      id: uuidv4(),
      username: fullName,
      reason: sickReason,
      date: startDate,
      gender,
      age,
      status: "Diajukan",
    });

    const savedSickLeave = await sickLeave.save();

    return h
      .response({
        message: "Sick leave form submitted successfully",
        questions: aiGeneratedQuestions,
        formId: savedSickLeave._id,
      })
      .code(201);
  } catch (error) {
    console.error("Error processing the form:", error.message);
    return h.response({ message: "Error while processing the form" }).code(500);
  }
};

// Fungsi untuk menyimpan jawaban pada form sick leave
const saveAnswersHandler = async (request, h) => {
  const { formId, answers } = request.payload;

  try {
    // Temukan sick leave berdasarkan formId
    const sickLeave = await SickLeave.findById(formId);
    if (!sickLeave) {
      return h.response({ message: "Form not found" }).code(404);
    }

    // Simpan jawaban yang diterima ke dalam sick leave form
    sickLeave.answers = answers;
    await sickLeave.save();

    return h.response({ message: "Answers saved successfully" }).code(200);
  } catch (error) {
    console.error("Error saving answers:", error.message);
    return h.response({ message: "Error saving answers" }).code(500);
  }
};

// Fungsi untuk membuat sick leave
async function createSickLeave(request, h) {
  const { username, reason } = request.payload;
  try {
    const sickLeave = new SickLeave({
      id: uuidv4(),
      username,
      reason,
    });
    const savedSickLeave = await sickLeave.save();
    return h
      .response({ message: "Sick leave created", data: savedSickLeave })
      .code(201);
  } catch (error) {
    console.error("Error creating sick leave:", error.message);
    return h.response({ message: "Error creating sick leave" }).code(500);
  }
}

// Fungsi untuk mengambil sick leave berdasarkan ID
async function getSickLeaveById(request, h) {
  const { id } = request.params;
  try {
    const sickLeave = await SickLeave.findOne({ id });
    if (!sickLeave) {
      return h.response({ message: "No sick leave found" }).code(404);
    }
    return h.response(sickLeave).code(200);
  } catch (error) {
    console.error("Error fetching sick leave:", error.message);
    return h.response({ message: "Error fetching sick leave" }).code(500);
  }
}

module.exports = {
  createSickLeaveForm,
  saveAnswersHandler,
  createSickLeave,
  getSickLeaveById,
};
