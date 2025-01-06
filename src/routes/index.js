// src/routes/index.js
const {
  loginUser,
  registerUser,
  handleGoogleCallback,
} = require("../handlers/userHandlers");
const {
  createSickLeave,
  getSickLeaveById,
} = require("../handlers/sickLeaveHandlers");
const {
  createSickLeaveForm,
  saveAnswersHandler,
} = require("../handlers/sickLeaveHandlers");
const {
  generateAndSendPDF,
  convertPdfToImageHandler,
} = require("../handlers/pdfHandler");
const verifyToken = require("../utils/jwtMiddleware");
const Joi = require("@hapi/joi");

const routes = [
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
        payload: Joi.object({
          username: Joi.string().min(3).max(30).required(),
          email: Joi.string().email().required(),
          password: Joi.string().min(8).required(),
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
        payload: Joi.object({
          email: Joi.string().email().required(),
          password: Joi.string().min(8).required(),
        }),
      },
    },
  },
  {
    method: "POST",
    path: "/sick-leave",
    handler: createSickLeave,
    options: {
      pre: [{ method: verifyToken }],
      validate: {
        payload: Joi.object({
          username: Joi.string().required(),
          reason: Joi.string().min(5).required(),
        }),
      },
    },
  },
  {
    method: "GET",
    path: "/sick-leave/{id}",
    handler: getSickLeaveById,
    options: {
      pre: [{ method: verifyToken }],
    },
  },
  {
    method: "GET",
    path: "/auth/google",
    handler: (request, h) => {
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${process.env.GOOGLE_REDIRECT_URI}&response_type=code&scope=email profile&access_type=offline`;
      console.log("Redirecting to Google OAuth URL:", googleAuthUrl); // Debug log
      return h.redirect(googleAuthUrl);
    },
  },
  {
    method: "GET",
    path: "/auth/google/callback",
    handler: handleGoogleCallback,
    options: {
      auth: false,
      cors: {
        origin: ["*"],
        additionalHeaders: ["cache-control", "x-requested-with"],
      },
    },
  },
  {
    method: "POST",
    path: "/api/sick-leave-form",
    handler: createSickLeaveForm,
    options: {
      validate: {
        payload: Joi.object({
          fullName: Joi.string().min(1).required(),
          position: Joi.string().min(1).required(),
          institution: Joi.string().min(1).required(),
          startDate: Joi.date().required(),
          sickReason: Joi.string().min(1).required(),
          otherReason: Joi.string().allow("", null),
          gender: Joi.string().valid("male", "female", "other").required(), // Jenis kelamin
          age: Joi.number().min(1).required(), // Umur
        }),
      },
    },
  },
  {
    method: "POST",
    path: "/api/save-answers",
    handler: saveAnswersHandler,
    options: {
      validate: {
        payload: Joi.object({
          formId: Joi.string().required(),
          answers: Joi.array()
            .items(
              Joi.object({
                questionId: Joi.string().required(),
                answer: Joi.string().required(),
              })
            )
            .required(),
        }),
      },
    },
  },
  {
    method: "GET",
    path: "/api/generate-pdf/{id}",
    handler: generateAndSendPDF,
    options: {
      cors: {
        origin: ["*"],
        additionalHeaders: ["cache-control", "x-requested-with"],
        credentials: true,
      },
    },
  },
  // Add static file serving route
  {
    method: "GET",
    path: "/temp/{param*}",
    handler: {
      directory: {
        path: "./temp",
        listing: false,
      },
    },
    options: {
      cors: true,
    },
  },
  {
    method: "GET",
    path: "/api/convert-pdf-to-image/{id}",
    handler: convertPdfToImageHandler,
    options: {
      cors: true,
    },
  },
];

module.exports = routes;
