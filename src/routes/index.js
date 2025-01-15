// src/routes/index.js
const {
  loginUser,
  registerUser,
  handleGoogleCallback,
} = require("../handlers/userHandlers");
const {
  createSickLeaveForm,
  saveAnswersHandler,
  getUserSickLeaves,
} = require("../handlers/sickLeaveHandlers");
const Joi = require("@hapi/joi");
const fs = require("fs");
const {
  cancelReservation,
  createCoworkingReservation,
} = require("../handlers/coworkingHandler");
const ApiKey = require("../models/apiKey");
const authenticate = require("../middlewares/authenticate");
const {
  generatePdfAndImageHandler,
  sendPDFEmailHandler,
} = require("../handlers/pdfHandler");
const { downloadHandler } = require("../handlers/downloadHandler");

const routes = [
  {
    method: "OPTIONS",
    path: "/{any*}",
    handler: (request, h) => {
      const response = h.response().code(204);
      response.header(
        "Access-Control-Allow-Origin",
        "https://www.izinsakit.site"
      );
      response.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      response.header(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
      );
      return response;
    },
    options: {
      auth: false,
    },
  },
  {
    method: "GET",
    path: "/",
    handler: (request, h) => {
      return {
        message:
          "Selamat datang di API Izin Sakit! Platform untuk pengajuan surat izin sakit digital yang cepat dan terpercaya.",
      };
    },
  },
  {
    method: "POST",
    path: "/register",
    handler: registerUser,
    options: {
      validate: {
        failAction: (request, h, err) => {
          console.error("Validation error:", err.details);
          return h
            .response({
              error: "Bad Request",
              message: err.details[0].message,
            })
            .code(400)
            .takeover();
        },
        payload: Joi.object({
          username: Joi.string().min(3).required().messages({
            "string.base": "Username harus berupa string",
            "string.min": "Username harus minimal 3 karakter",
            "any.required": "Username wajib diisi",
          }),
          email: Joi.string().email().required().messages({
            "string.email": "Silakan masukkan email yang valid",
            "any.required": "Email wajib diisi",
          }),
          password: Joi.string().min(8).required().messages({
            "string.min": "Password harus minimal 8 karakter",
            "any.required": "Password wajib diisi",
          }),
        }).options({ stripUnknown: true }),
      },
      payload: {
        output: "data",
        parse: true,
        allow: ["application/json"],
      },
      response: {
        schema: Joi.object({
          message: Joi.string(),
        }),
      },
    },
  },
  {
    method: "POST",
    path: "/login",
    handler: loginUser,
    options: {
      validate: {
        failAction: (request, h, err) => {
          console.error("Validation error:", err.details);
          return h
            .response({
              error: "Bad Request",
              message: err.details[0].message,
            })
            .code(400)
            .takeover();
        },
        payload: Joi.object({
          email: Joi.string().email().required().messages({
            "string.email": "Silakan masukkan email yang valid",
            "any.required": "Email wajib diisi",
          }),
          password: Joi.string().min(8).required().messages({
            "string.min": "Password harus minimal 8 karakter",
            "any.required": "Password wajib diisi",
          }),
        }).options({ stripUnknown: true }),
      },
      response: {
        schema: Joi.object({
          message: Joi.string(),
          token: Joi.string(),
        }),
      },
    },
  },
  {
    method: "GET",
    path: "/auth/google",
    handler: (request, h) => {
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${process.env.GOOGLE_REDIRECT_URI}&response_type=code&scope=email profile&access_type=offline`;
      console.log("Redirecting to Google OAuth URL:", googleAuthUrl);
      return h.redirect(googleAuthUrl);
    },
  },
  {
    method: "GET",
    path: "/auth/google/callback",
    handler: handleGoogleCallback,
    options: {
      auth: false,
    },
  },
  {
    method: "POST",
    path: "/api/sick-leave-form",
    handler: createSickLeaveForm,
    options: {
      pre: [{ method: authenticate }],
      payload: {
        output: "data",
        parse: true,
        allow: ["application/json"],
        maxBytes: 10485760,
      },
      validate: {
        failAction: (request, h, err) => {
          console.log("Payload before failAction:", request.payload);
          console.error("Validation error:", err.details);
          throw err;
        },
        payload: Joi.object({
          fullName: Joi.string().trim().min(1).required().messages({
            "string.empty": "Nama lengkap tidak boleh kosong",
            "string.min": "Nama lengkap minimal 1 karakter",
            "any.required": "Nama lengkap wajib diisi",
          }),
          position: Joi.string().trim().min(1).required().messages({
            "string.empty": "Jabatan/Posisi tidak boleh kosong",
            "any.required": "Jabatan/Posisi wajib diisi",
          }),
          institution: Joi.string().trim().min(1).required().messages({
            "string.empty": "Institusi tidak boleh kosong",
            "any.required": "Institusi wajib diisi",
          }),
          startDate: Joi.string().isoDate().required().messages({
            "any.required": "Tanggal mulai wajib diisi",
            "string.isoDate": "Tanggal mulai harus dalam format ISO",
          }),
          sickReason: Joi.string().trim().min(1).required().messages({
            "string.empty": "Alasan sakit tidak boleh kosong",
            "any.required": "Alasan sakit wajib diisi",
          }),
          otherReason: Joi.string().allow("", null),
          gender: Joi.string().valid("male", "female").required().messages({
            "any.only": "Jenis kelamin harus male atau female",
            "any.required": "Jenis kelamin wajib diisi",
          }),
          age: Joi.number().min(1).required().messages({
            "number.base": "Usia harus berupa angka",
            "number.min": "Usia minimal 1 tahun",
            "any.required": "Usia wajib diisi",
          }),
          contactEmail: Joi.string().email().required().messages({
            "string.email": "Format email tidak valid",
            "any.required": "Email wajib diisi",
          }),
          phoneNumber: Joi.string().min(1).required().messages({
            "string.empty": "Nomor telepon tidak boleh kosong",
            "any.required": "Nomor telepon wajib diisi",
          }),
        }).options({ stripUnknown: true }),
      },
    },
  },
  {
    method: "POST",
    path: "/api/save-answers",
    handler: saveAnswersHandler,
    options: {
      pre: [{ method: authenticate }],
      payload: {
        output: "data",
        parse: true,
        allow: ["application/json"],
        maxBytes: 10485760,
      },
      validate: {
        failAction: async (request, h, err) => {
          console.log("Validation Error for /api/save-answers:", err.details);
          console.log("Received payload:", request.payload);
          return h
            .response({ message: "Invalid payload", errors: err.details })
            .code(400)
            .takeover();
        },
        payload: Joi.object({
          formId: Joi.string().required().messages({
            "string.empty": "formId tidak boleh kosong",
            "string.base": "formId harus berupa string",
            "any.required": "formId wajib diisi",
          }),
          answers: Joi.array()
            .items(
              Joi.object({
                questionId: Joi.string().required().messages({
                  "any.required": "questionId wajib diisi",
                }),
                answer: Joi.string().required().messages({
                  "any.required": "jawaban wajib diisi",
                }),
              })
            )
            .required()
            .messages({
              "array.base": "answers harus berupa array",
              "any.required": "answers wajib diisi",
            }),
        }).required(),
      },
    },
  },
  {
    method: "GET",
    path: "/api/user/sick-leaves",
    handler: getUserSickLeaves,
    options: {
      pre: [{ method: authenticate }], // Middleware autentikasi
    },
  },
  {
    method: "GET",
    path: "/api/generate-pdf-and-image/{id}",
    handler: generatePdfAndImageHandler,
    options: {
      pre: [{ method: authenticate }],
      timeout: {
        server: 600000,
        socket: 620000,
      },
      validate: {
        params: Joi.object({
          id: Joi.string().required(),
        }),
      },
    },
  },
  {
    method: "GET",
    path: "/api/download/{type}/{id}",
    handler: downloadHandler,
    options: {
      pre: [{ method: authenticate }],
      validate: {
        params: Joi.object({
          type: Joi.string().valid("pdf", "image").required(),
          id: Joi.string().required(),
        }),
      },
    },
  },
  {
    method: "POST",
    path: "/api/send-pdf/{id}",
    handler: sendPDFEmailHandler,
    options: {
      pre: [{ method: authenticate }],
      validate: {
        params: Joi.object({
          id: Joi.string().required(),
        }),
        payload: Joi.object({
          email: Joi.string().email().required(),
        }),
      },
    },
  },
];

// Simplify coworking routes
const coworkingRoutes = [
  {
    method: "POST",
    path: "/api/coworking/reservations",
    handler: createCoworkingReservation,
    options: {
      validate: {
        payload: Joi.object({
          seat_number: Joi.string()
            .pattern(/^[A-Z]\d+$/)
            .required(), // Contoh: A1, B2, dll.
          reservation_date: Joi.string().isoDate().required(),
          sickLeaveId: Joi.string().required(),
        }),
      },
      auth: false, // Aktifkan auth setelah testing selesai
    },
  },
  {
    method: "DELETE",
    path: "/api/coworking/reservations/{reservation_id}",
    handler: cancelReservation,
    options: {
      pre: [{ method: authenticate }],
      validate: {
        params: Joi.object({
          reservation_id: Joi.string().required(),
        }),
      },
    },
  },
];

const apiKeyRoutes = [
  {
    method: "POST",
    path: "/api/keys/generate",
    handler: async (request, h) => {
      try {
        console.log("User data:", request.auth.credentials); // Log untuk debugging
        const key = ApiKey.generateKey();
        const apiKey = new ApiKey({
          key,
          userId: request.auth.credentials.userId, // Ambil userId dari request.auth.credentials
          description: request.payload?.description || "Auto-generated key",
          generatedAt: new Date(),
        });
        await apiKey.save();
        return { key };
      } catch (error) {
        console.error("Error generating API key:", error);
        return h.response({ message: "Error generating API key" }).code(500);
      }
    },
    options: {
      pre: [{ method: authenticate }], // Panggil middleware authenticate
      validate: {
        payload: Joi.object({
          description: Joi.string().optional(),
        }).optional(),
      },
    },
  },
];

const { sendEmailWithAttachment } = require("../services/sendEmail"); // Sesuaikan path ke modul email Anda

const testEmailRoute = {
  method: "POST",
  path: "/api/test-email",
  handler: async (request, h) => {
    try {
      const { to, subject, text } = request.payload;

      // Path ke file PDF yang akan dikirim sebagai attachment
      const attachment = {
        path: "C:\\izin-sakit\\backend\\src\\temp\\surat_izin_sakit_678655163b74814b3cd54ec1.pdf", // Ganti dengan path file PDF Anda
        filename: "surat_izin_sakit.pdf", // Nama file yang akan dikirim
        contentType: "application/pdf", // Tipe konten file
      };

      // Panggil fungsi untuk mengirim email
      await sendEmailWithAttachment(to, subject, text, attachment);

      return h.response({ message: "Test email sent successfully!" }).code(200);
    } catch (error) {
      return h
        .response({
          error: "Failed to send test email",
          details: error.message,
        })
        .code(500);
    }
  },
  options: {
    auth: false, // Nonaktifkan autentikasi untuk endpoint percobaan
    validate: {
      payload: Joi.object({
        to: Joi.string().email().required().messages({
          "string.email": "Format email tidak valid",
          "any.required": "Email penerima wajib diisi",
        }),
        subject: Joi.string().min(1).required().messages({
          "string.empty": "Subjek email tidak boleh kosong",
          "any.required": "Subjek email wajib diisi",
        }),
        text: Joi.string().min(1).required().messages({
          "string.empty": "Isi email tidak boleh kosong",
          "any.required": "Isi email wajib diisi",
        }),
      }),
    },
  },
};

module.exports = [
  ...routes,
  ...coworkingRoutes,
  ...apiKeyRoutes,
  testEmailRoute,
];
