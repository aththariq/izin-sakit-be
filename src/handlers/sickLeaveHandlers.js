const OpenAI = require("openai");
const { v4: uuidv4 } = require("uuid");
const SickLeave = require("../models/SickLeave");
const path = require("path");
const dotenv = require("dotenv");
const logger = require("../utils/logger"); // Add logger import

// Load environment variables based on NODE_ENV
dotenv.config({
  path: path.resolve(
    __dirname,
    "../..",
    process.env.NODE_ENV === "production"
      ? ".env.production"
      : ".env.development"
  ),
});

// Debug log untuk memeriksa environment variables
console.log("Environment:", process.env.NODE_ENV);
console.log(
  "OPENROUTER_API_KEY:",
  process.env.OPENROUTER_API_KEY ? "Present" : "Missing"
);
console.log(
  "Using config file:",
  path.resolve(
    __dirname,
    "../..",
    process.env.NODE_ENV === "production"
      ? ".env.production"
      : ".env.development"
  )
);

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:5173",
    "X-Title": "Izin Sakit App",
  },
});

// Fungsi untuk membuat form sick leave
const createSickLeaveForm = async (request, h) => {
  try {
    // Detailed logging at the start
    logger.info("Received sick leave form submission:", {
      payload: request.payload,
      headers: request.headers,
    });

    const { payload } = request;
    const userId = request.auth.credentials.userId;
    const username = request.auth.credentials.username;

    // Validate payload exists
    if (!payload) {
      logger.warn("No payload received in createSickLeaveForm");
      return h
        .response({
          statusCode: 400,
          error: "Bad Request",
          message: "No payload received",
        })
        .code(400);
    }

    let {
      fullName,
      position,
      institution,
      startDate,
      sickReason,
      otherReason,
      gender,
      age,
      contactEmail,
      phoneNumber,
    } = payload;

    // Log sanitized input data
    logger.debug("Sanitized input data:", {
      fullName,
      position,
      institution,
      startDate,
      sickReason,
      otherReason,
      gender,
      age,
      contactEmail,
      phoneNumber,
    });

    // Create sanitized data object with id field
    const sanitizedData = {
      userId,
      username,
      fullName: fullName?.trim(),
      position: position?.trim(),
      institution: institution?.trim(),
      date: new Date(startDate),
      reason: sickReason?.trim(),
      otherReason: otherReason ? otherReason.trim() : "",
      gender: gender?.trim(),
      age: Number(age),
      contactEmail: contactEmail?.trim(),
      phoneNumber: phoneNumber?.trim(),
      status: "Diajukan",
    };

    // Validate required fields
    const missingFields = Object.entries(sanitizedData).filter(
      ([key, value]) => {
        if (key === "otherReason") return false; // Optional field
        return !value && value !== 0;
      }
    );

    if (missingFields.length > 0) {
      logger.warn("Missing required fields:", missingFields);
      return h
        .response({
          statusCode: 400,
          error: "Bad Request",
          message: `Missing required fields: ${missingFields
            .map(([key]) => key)
            .join(", ")}`,
          fields: missingFields,
        })
        .code(400);
    }

    // Create new SickLeave instance with error handling
    const sickLeave = new SickLeave(sanitizedData);

    // Validate model before saving
    const validationError = sickLeave.validateSync();
    if (validationError) {
      logger.error("Mongoose validation error:", validationError);
      return h
        .response({
          statusCode: 400,
          error: "Validation Error",
          message: validationError.message,
          details: validationError.errors,
        })
        .code(400);
    }

    // Save to database with detailed error handling
    let savedSickLeave;
    try {
      savedSickLeave = await sickLeave.save();
      logger.info("Successfully saved sick leave:", {
        id: savedSickLeave._id,
        username: savedSickLeave.username,
      });
    } catch (dbError) {
      logger.error("Database save error:", dbError);
      return h
        .response({
          statusCode: 500,
          error: "Database Error",
          message: "Failed to save sick leave form",
          details: dbError.message,
        })
        .code(500);
    }

    // Generate AI questions
    let questions;
    try {
      const promptMessage = `Sebagai dokter, buatkan 5 pertanyaan penilaian medis untuk pasien:
Kondisi Pasien:
- Keluhan: ${sickReason}
- Usia: ${age} tahun
- Jenis Kelamin: ${gender}

Kriteria Pertanyaan:
1. DURASI & ONSET: Tanyakan kapan gejala mulai dan pola kemunculannya
2. SEVERITY: Ukur tingkat keparahan dengan skala atau dampak ke aktivitas
3. ASSOCIATED SYMPTOMS: Identifikasi gejala tambahan yang mungkin terkait
4. AGGRAVATING/RELIEVING FACTORS: Faktor yang memperburuk atau meringankan
5. RIWAYAT & PENANGANAN: Tanyakan riwayat medis terkait dan upaya penanganan

Format output WAJIB dalam bentuk array JSON sederhana:
[
  "Pertanyaan tentang durasi/onset",
  "Pertanyaan tentang severity",
  "Pertanyaan tentang gejala tambahan",
  "Pertanyaan tentang faktor yang mempengaruhi",
  "Pertanyaan tentang riwayat & penanganan"
]

Panduan Khusus:
- Gunakan bahasa yang mudah dipahami pasien
- Buat pertanyaan spesifik untuk keluhan ${sickReason}
- Hindari pertanyaan ya/tidak, gunakan pertanyaan terbuka
- Susun pertanyaan secara sistematis sesuai urutan kriteria
- Pastikan setiap pertanyaan memberikan informasi bernilai medis

Output harus berupa array JSON valid, tanpa teks tambahan.`;

      logger.info("Sending AI prompt for question generation:", {
        sickReason,
        gender,
        age,
        timestamp: new Date().toISOString(),
      });

      const completion = await openai.chat.completions.create({
        model: "meta-llama/llama-3.2-3b-instruct:free",
        messages: [
          {
            role: "system",
            content:
              "Anda adalah dokter yang membuat pertanyaan evaluasi medis. Berikan output HANYA dalam format array JSON.",
          },
          { role: "user", content: promptMessage },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      logger.debug(
        "Raw AI response:",
        completion?.choices?.[0]?.message?.content
      );

      if (!completion?.choices?.[0]?.message?.content) {
        throw new Error("Empty response from AI service");
      }

      const rawResponse = completion.choices[0].message.content.trim();

      // Try multiple parsing strategies
      let parsedQuestions;
      try {
        // Direct JSON parse attempt
        parsedQuestions = JSON.parse(rawResponse);
      } catch (firstError) {
        logger.debug("First parse attempt failed, trying to extract array", {
          rawResponse,
        });

        // Try to extract array from text
        const arrayMatch = rawResponse.match(/\[([\s\S]*)\]/);
        if (!arrayMatch) {
          throw new Error("Could not find array pattern in response");
        }

        try {
          parsedQuestions = JSON.parse(`[${arrayMatch[1]}]`);
        } catch (secondError) {
          logger.error("All parsing attempts failed", {
            rawResponse,
            firstError,
            secondError,
          });
          throw new Error("Failed to parse questions from AI response");
        }
      }

      // Validate questions array
      if (!Array.isArray(parsedQuestions)) {
        throw new Error("AI response is not an array");
      }

      // Filter and clean questions
      questions = parsedQuestions
        .filter((q) => typeof q === "string" && q.trim().length > 0)
        .map((q) => q.trim());

      if (questions.length < 3) {
        throw new Error("Not enough valid questions generated");
      }

      logger.info(`Successfully generated ${questions.length} questions`);
    } catch (aiError) {
      logger.error("AI question generation error:", {
        error: aiError.message,
        sickReason,
        gender,
        age,
        timestamp: new Date().toISOString(),
      });

      // Update fallback questions to match the systematic approach
      questions = [
        `Kapan pertama kali Anda mengalami ${sickReason.toLowerCase()} dan bagaimana pola kemunculannya?`,
        `Seberapa mengganggu ${sickReason.toLowerCase()} ini terhadap aktivitas sehari-hari Anda?`,
        "Gejala atau keluhan lain apa saja yang Anda rasakan bersamaan dengan kondisi ini?",
        `Hal-hal apa yang membuat ${sickReason.toLowerCase()} ini membaik atau memburuk?`,
        "Apakah Anda memiliki riwayat kondisi serupa dan bagaimana penanganan yang sudah dilakukan?",
      ];

      logger.info("Using improved fallback questions", {
        timestamp: new Date().toISOString(),
      });
    }

    // Format response with validated questions
    return h
      .response({
        message: "Sick leave form submitted successfully",
        questions: questions.map((q, idx) => ({
          id: `q${idx + 1}`,
          text: q,
          type: "open-ended",
        })),
        formId: savedSickLeave._id.toString(), // Hanya menggunakan _id
        sickLeave: savedSickLeave, // Objek sickLeave sudah mengandung _id
      })
      .code(201);
  } catch (error) {
    logger.error("createSickLeaveForm error:", {
      error: error.message,
      stack: error.stack,
      payload: request.payload,
    });

    return h
      .response({
        statusCode: 500,
        error: "Internal Server Error",
        message: "Failed to process sick leave form",
        details: error.message,
      })
      .code(500);
  }
};

// Fungsi untuk menyimpan jawaban pada form sick leave
const saveAnswersHandler = async (request, h) => {
  // Detailed logging of the entire payload
  console.log("Received payload in handler:", request.payload);

  const { formId, answers } = request.payload;

  // Log the type and value of formId
  console.log(`Type of formId: ${typeof formId}`);
  console.log(`Value of formId: ${formId}`);

  // Log untuk debugging
  console.log("Menerima payload:", {
    formId: formId,
    answersCount: answers?.length,
  });

  try {
    // Validasi answers
    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return h
        .response({
          message: "answers tidak valid",
          statusCode: 400,
        })
        .code(400);
    }

    // Cari dokumen untuk verifikasi
    const sickLeave = await SickLeave.findById(formId);

    if (!sickLeave) {
      console.log("Form tidak ditemukan:", formId);
      return h
        .response({
          message: "Form tidak ditemukan",
          statusCode: 404,
        })
        .code(404);
    }

    // Update dokumen dengan jawaban yang diformat
    const updatedSickLeave = await SickLeave.findByIdAndUpdate(
      formId,
      {
        $set: {
          answers: answers.map(({ questionId, answer }) => ({
            questionId,
            answer: answer.trim(),
          })),
        },
      },
      { new: true }
    );

    return h
      .response({
        message: "Jawaban berhasil disimpan",
        formId: updatedSickLeave._id,
        statusCode: 200,
      })
      .code(200);
  } catch (error) {
    console.error("Error saat menyimpan jawaban:", error);
    return h
      .response({
        message: "Gagal menyimpan jawaban",
        error: error.message,
        statusCode: 500,
      })
      .code(500);
  }
};

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

// Add this new handler
const getSickLeaves = async (request, h) => {
  try {
    const sickLeaves = await SickLeave.find()
      .sort({ date: -1 }) // Sort by date in descending order
      .select("reason date status institution _id"); // Select only needed fields

    logger.debug("Fetched sick leaves:", sickLeaves);

    // Ensure we're sending an array
    return h.response(Array.isArray(sickLeaves) ? sickLeaves : []).code(200);
  } catch (error) {
    logger.error("Error fetching sick leaves:", error);
    return h.response({ message: "Error fetching sick leaves" }).code(500);
  }
};

// Add new handler for dashboard data
const getDashboardSickLeaves = async (request, h) => {
  try {
    const dashboardData = await SickLeave.find()
      .sort({ date: -1 })
      .select({
        _id: 1,
        reason: 1,
        date: 1,
        status: 1,
        institution: 1,
        username: 1,
      })
      .lean(); // Use lean() for better performance since we only need the data

    console.log("Fetched dashboard data:", dashboardData); // Debug log
    return h.response(dashboardData).code(200);
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return h.response({ message: "Error fetching dashboard data" }).code(500);
  }
};

// src/handlers/sickLeaveHandlers.js

const getUserSickLeaves = async (request, h) => {
  try {
    // Ambil userId dari request.auth.credentials
    const userId = request.auth.credentials.userId;

    // Cari semua sick leave yang dibuat oleh user dengan userId tersebut
    const userSickLeaves = await SickLeave.find({ userId })
      .sort({ date: -1 }) // Urutkan berdasarkan tanggal terbaru
      .select({
        _id: 1,
        reason: 1,
        date: 1,
        status: 1,
        institution: 1,
        username: 1,
        otherReason: 1,
        contactEmail: 1,
      })
      .lean();

    return h.response(userSickLeaves).type("application/json").code(200);
  } catch (error) {
    console.error("Error in getUserSickLeaves:", error);
    return h
      .response({
        message: "Error fetching user sick leaves",
        error: error.message,
      })
      .type("application/json")
      .code(500);
  }
};

module.exports = {
  createSickLeaveForm,
  saveAnswersHandler,
  getSickLeaveById,
  getSickLeaves,
  getDashboardSickLeaves,
  getUserSickLeaves,
};
