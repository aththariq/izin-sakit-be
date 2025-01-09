const OpenAI = require("openai");
const { v4: uuidv4 } = require("uuid");
const SickLeave = require("../models/SickLeave");
const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");

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
    // Add detailed payload logging
    console.log("Raw payload:", JSON.stringify(request.payload, null, 2));

    const { payload } = request;

    // Validate payload exists
    if (!payload) {
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

    // Log each field for debugging
    console.log("Received fields:", {
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

    // Validate required fields with detailed messages
    const requiredFields = {
      fullName: "Nama lengkap",
      position: "Jabatan",
      institution: "Institusi",
      startDate: "Tanggal mulai",
      sickReason: "Alasan sakit",
      gender: "Jenis kelamin",
      contactEmail: "Email",
      phoneNumber: "Nomor telepon",
    };

    for (const [field, label] of Object.entries(requiredFields)) {
      if (
        !payload[field] ||
        (typeof payload[field] === "string" && !payload[field].trim())
      ) {
        return h
          .response({
            statusCode: 400,
            error: "Bad Request",
            message: `${label} wajib diisi`,
            field,
          })
          .code(400);
      }
    }

    // Validate and convert age
    const numericAge = Number(age);
    if (isNaN(numericAge) || numericAge < 1) {
      return h
        .response({
          statusCode: 400,
          error: "Bad Request",
          message: "Usia harus berupa angka positif",
          field: "age",
        })
        .code(400);
    }

    // Create sanitized data object
    const sanitizedData = {
      id: uuidv4(),
      username: fullName.trim(),
      reason: sickReason.trim(),
      otherReason: otherReason ? otherReason.trim() : "",
      date: new Date(startDate),
      gender: gender.trim(),
      age: numericAge,
      institution: institution.trim(),
      contactEmail: contactEmail.trim(),
      phoneNumber: phoneNumber.trim(),
      status: "Diajukan",
    };

    // Create new SickLeave instance
    const sickLeave = new SickLeave(sanitizedData);

    // Save to database
    const savedSickLeave = await sickLeave.save();
    console.log("Saved sick leave:", savedSickLeave);

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

    // Return response with saved data and questions
    return h
      .response({
        message: "Sick leave form submitted successfully",
        questions: formattedQuestions,
        formId: savedSickLeave._id.toString(),
        sickLeave: savedSickLeave,
      })
      .code(201);
  } catch (error) {
    console.error("Error details:", error);
    return h
      .response({
        statusCode: 500,
        error: "Internal Server Error",
        message: error.message,
        details: error.stack,
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

// Add this new handler
const getSickLeaves = async (request, h) => {
  try {
    const sickLeaves = await SickLeave.find()
      .sort({ date: -1 }) // Sort by date in descending order
      .select("reason date status institution _id"); // Select only needed fields

    // Debug log to check the structure
    console.log("Fetched sick leaves:", sickLeaves);

    // Ensure we're sending an array
    return h.response(Array.isArray(sickLeaves) ? sickLeaves : []).code(200);
  } catch (error) {
    console.error("Error fetching sick leaves:", error);
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

const getUserSickLeaves = async (request, h) => {
  try {
    // Add debug logging for the entire request
    console.log("Full request:", {
      auth: request.auth,
      headers: request.headers,
      state: request.state,
    });

    // Get token from authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return h.response({ message: "No authorization header" }).code(401);
    }

    // Extract token
    const token = authHeader.split(" ")[1];
    if (!token) {
      return h.response({ message: "Invalid token format" }).code(401);
    }

    // For now, return all sick leaves since we can't get user info
    const userSickLeaves = await SickLeave.find()
      .sort({ date: -1 })
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

    console.log("Found sick leaves:", userSickLeaves);

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
  createSickLeave,
  getSickLeaveById,
  getSickLeaves,
  getDashboardSickLeaves,
  getUserSickLeaves,
};
