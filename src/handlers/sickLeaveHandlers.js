const OpenAI = require("openai");
const { v4: uuidv4 } = require("uuid");
const SickLeave = require("../models/SickLeave");
const mongoose = require("mongoose");
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables based on NODE_ENV
dotenv.config({
  path: path.resolve(
    __dirname,
    '../..',
    process.env.NODE_ENV === "production" ? ".env.production" : ".env.development"
  ),
});

// Debug log untuk memeriksa environment variables
console.log('Environment:', process.env.NODE_ENV);
console.log('OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? 'Present' : 'Missing');
console.log('Using config file:', path.resolve(
  __dirname,
  '../..',
  process.env.NODE_ENV === "production" ? ".env.production" : ".env.development"
));

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:5173",
    "X-Title": "Izin Sakit App"
  }
});

// Fungsi untuk membuat form sick leave
const createSickLeaveForm = async (request, h) => {
  try {
    // Log incoming data
    console.log("Received payload:", request.payload);

    let {
      fullName,
      position,
      institution,
      startDate,
      sickReason,
      otherReason,
      gender,
      age,
      contactEmail, // Extract contactEmail from payload
      phoneNumber, // Extract phoneNumber from payload
    } = request.payload;

    // Ensure age is a number
    age = typeof age === "string" ? Number(age) : age;

    if (isNaN(age)) {
      return h
        .response({
          message: "Age must be a valid number",
          receivedData: { age, type: typeof age },
        })
        .code(400);
    }

    // Reintroduce type coercion
    age = Number(age); // Convert age to number
    console.log("Coerced Age:", age, typeof age);

    // Log types of received fields
    console.log("Data Types:", {
      age: typeof age,
      startDate: typeof startDate,
      contactEmail: typeof contactEmail,
      phoneNumber: typeof phoneNumber,
    });

    // Validasi data yang diperlukan
    if (
      !fullName ||
      !position ||
      !institution ||
      !startDate ||
      !sickReason ||
      !gender ||
      isNaN(age) || // Check if age is a valid number
      !contactEmail ||
      !phoneNumber
    ) {
      console.log("Missing or invalid required fields");
      return h
        .response({
          message: "Missing or invalid required fields",
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
      otherReason, // Include otherReason from payload
      date: new Date(startDate), // Ensure date is properly formatted
      gender,
      age: Number(age), // Ensure age is stored as number
      institution, // Save institution from payload
      contactEmail, // Save contactEmail
      phoneNumber, // Save phoneNumber
      status: "Diajukan",
      // Remove the explicit _id assignment
    });

    const savedSickLeave = await sickLeave.save();
    console.log("Created new sick leave:", savedSickLeave); // Debug log

    return h
      .response({
        message: "Sick leave form submitted successfully",
        questions: formattedQuestions,
        formId: savedSickLeave._id.toString(), // Ensure formId is a string
        sickLeave: savedSickLeave, // Include the created sick leave data
      })
      .code(201);
  } catch (error) {
    console.error("Error in createSickLeaveForm:", error); // Enhanced error logging
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
      return h
        .response({
          message: "Form not found",
          statusCode: 404,
        })
        .code(404);
    }

    // Update with formatted answers
    const updatedSickLeave = await SickLeave.findByIdAndUpdate(
      formId,
      { $set: { answers: answers } },
      { new: true }
    );

    console.log("Updated document:", updatedSickLeave); // Debug log

    return h
      .response({
        message: "Answers saved successfully",
        formId: updatedSickLeave._id,
        statusCode: 200,
      })
      .code(200);
  } catch (error) {
    console.error("Error saving answers:", error);
    return h
      .response({
        message: "Error saving answers",
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
