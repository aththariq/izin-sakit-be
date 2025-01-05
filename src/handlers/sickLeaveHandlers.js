const OpenAI = require("openai");
require("dotenv").config(); // Pastikan dotenv sudah di-load

const { v4: uuidv4 } = require("uuid");
const SickLeave = require("../models/SickLeave");

// Inisialisasi OpenAI dengan OpenRouter
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:5173", // Sesuaikan dengan URL frontend Anda
    "X-Title": "Izin Sakit App",
  },
});

// Fungsi untuk membuat form sick leave
const createSickLeaveForm = async (request, h) => {
  try {
    // Log incoming data
    console.log("Received payload:", request.payload);

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

    // Validasi data yang diperlukan
    if (
      !fullName ||
      !position ||
      !institution ||
      !startDate ||
      !sickReason ||
      !gender ||
      !age
    ) {
      console.log("Missing required fields");
      return h
        .response({
          message: "Missing required fields",
          receivedData: request.payload,
        })
        .code(400);
    }

    // Format prompt untuk AI
    const promptMessage = `
      Sebagai asisten medis, buatkan 3-5 pertanyaan lanjutan berdasarkan informasi pasien berikut:
      - Gejala: ${sickReason} ${otherReason ? `(${otherReason})` : ""}
      - Jenis Kelamin: ${gender}
      - Umur: ${age}
      
      Berikan pertanyaan dalam format array JSON sederhana. Contoh:
      ["Pertanyaan 1?", "Pertanyaan 2?", "Pertanyaan 3?"]
    `;

    // Gunakan OpenRouter API
    const completion = await openai.chat.completions.create({
      model: "google/gemini-pro", // atau model lain yang tersedia
      messages: [
        {
          role: "system",
          content:
            "Anda adalah asisten medis yang membantu menganalisis kondisi pasien yang mengajukan izin sakit.",
        },
        {
          role: "user",
          content: promptMessage,
        },
      ],
      temperature: 0.7,
    });

    // Parse response dan format pertanyaan
    const aiResponse = completion.choices[0].message.content;
    let questions;
    try {
      questions = JSON.parse(aiResponse);
    } catch (e) {
      // Jika parsing gagal, coba ekstrak array dari string
      const match = aiResponse.match(/\[.*\]/s);
      if (match) {
        questions = JSON.parse(match[0]);
      } else {
        throw new Error("Failed to parse AI response");
      }
    }

    const formattedQuestions = questions.map((q, idx) => ({
      id: `q${idx + 1}`,
      text: q,
      type: "open-ended",
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
    console.log("Saved sick leave:", savedSickLeave); // Debug log

    return h
      .response({
        message: "Sick leave form submitted successfully",
        questions: formattedQuestions,
        formId: savedSickLeave._id.toString(), // Ensure formId is a string
      })
      .code(201);
  } catch (error) {
    console.error("Error details:", error);
    return h
      .response({
        message: "Error while processing the form",
        error: error.message,
      })
      .code(500);
  }
};

// Fungsi untuk menyimpan jawaban pada form sick leave
const saveAnswersHandler = async (request, h) => {
  const { formId, answers } = request.payload;
  
  console.log("Received payload:", request.payload); // Debug log

  try {
    // Find the document first to verify it exists
    const sickLeave = await SickLeave.findById(formId);
    
    if (!sickLeave) {
      console.log("Form not found for ID:", formId);
      return h.response({ 
        message: "Form not found",
        statusCode: 404 
      }).code(404);
    }

    // Update with formatted answers
    const updatedSickLeave = await SickLeave.findByIdAndUpdate(
      formId,
      { $set: { answers: answers } },
      { new: true }
    );

    console.log("Updated document:", updatedSickLeave); // Debug log

    return h.response({ 
      message: "Answers saved successfully",
      formId: updatedSickLeave._id,
      statusCode: 200
    }).code(200);
  } catch (error) {
    console.error("Error saving answers:", error);
    return h.response({ 
      message: "Error saving answers",
      error: error.message,
      statusCode: 500 
    }).code(500);
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
