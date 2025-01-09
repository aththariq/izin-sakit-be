// src/routes/index.js
const {
  loginUser,
  registerUser,
  handleGoogleCallback,
} = require("../handlers/userHandlers");
const {
  createSickLeave,
  getSickLeaveById,
  getSickLeaves,
  getDashboardSickLeaves,
  getUserSickLeaves,
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
const path = require("path");
const fs = require("fs");
const { generatePDF } = require('../handlers/pdfGenerationHandler');
const { sendPDFEmail } = require('../handlers/emailHandler');

const corsOptions = {
  origin: [
    "https://www.izinsakit.site",
    "http://izinsakit.site",
    "https://izin-sakit.vercel.app",
    "http://localhost:5173", // Add localhost for development
  ],
  headers: [
    "Accept",
    "Authorization",
    "Content-Type",
    "If-None-Match",
    "Accept-language",
    "cache-control",
    "x-requested-with",
  ],
  exposedHeaders: ["Accept", "Content-Type", "Authorization"],
  additionalExposedHeaders: ["access-control-allow-origin"],
  maxAge: 86400,
  credentials: true,
};

const standardRouteOptions = {
  cors: corsOptions,
  timeout: {
    server: 600000,
    socket: 620000,
  },
};

const tempPath = path.join(__dirname, "../temp");
if (!fs.existsSync(tempPath)) {
  fs.mkdirSync(tempPath, { recursive: true });
}

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
    options: {
      ...standardRouteOptions,
      description: "Welcome endpoint",
      notes: "Returns a welcome message",
      tags: ["api"],
      plugins: {
        "hapi-swagger": {
          responses: {
            200: {
              description: "Success",
              schema: Joi.object({
                message: Joi.string().required(),
              }),
            },
          },
        },
      },
    },
  },
  {
    method: "POST",
    path: "/register",
    handler: registerUser,
    options: {
      ...standardRouteOptions,
      description: "Register new user",
      notes: "Creates a new user account",
      tags: ["api", "users"],
      validate: {
        payload: Joi.object({
          username: Joi.string()
            .min(3)
            .max(30)
            .required()
            .description("Username between 3-30 characters"),
          email: Joi.string()
            .email()
            .required()
            .description("Valid email address"),
          password: Joi.string()
            .min(8)
            .required()
            .description("Password minimum 8 characters"),
        }),
      },
      response: {
        schema: Joi.object({
          message: Joi.string(),
        }),
      },
      plugins: {
        "hapi-swagger": {
          responses: {
            201: {
              description: "User created successfully",
              schema: Joi.object({
                message: Joi.string(),
              }),
            },
            400: {
              description: "Bad Request",
            },
          },
        },
      },
    },
  },
  {
    method: "POST",
    path: "/login",
    handler: loginUser,
    options: {
      ...standardRouteOptions,
      description: "User login",
      notes: "Authenticates user and returns JWT token",
      tags: ["api", "users"],
      validate: {
        payload: Joi.object({
          email: Joi.string()
            .email()
            .required()
            .description("Registered email address"),
          password: Joi.string().min(8).required().description("User password"),
        }),
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
    method: "POST",
    path: "/sick-leave",
    handler: createSickLeave,
    options: {
      ...standardRouteOptions,
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
      ...standardRouteOptions,
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
      ...standardRouteOptions,
      auth: false,
    },
  },
  {
    method: "POST",
    path: "/api/sick-leave-form",
    handler: createSickLeaveForm,
    options: {
      ...standardRouteOptions,
      validate: {
        payload: Joi.object({
          fullName: Joi.string().min(1).required(),
          position: Joi.string().min(1).required(),
          institution: Joi.string().min(1).required(),
          startDate: Joi.string().required(), // Changed from date to string
          sickReason: Joi.string().min(1).required(),
          otherReason: Joi.string().allow("", null),
          gender: Joi.string().valid("male", "female").required(),
          age: Joi.number().min(1).required(),
          contactEmail: Joi.string().email().required(),
          phoneNumber: Joi.string().min(1).required(),
        }),
      },
    },
  },
  {
    method: "POST",
    path: "/api/save-answers",
    handler: saveAnswersHandler,
    options: {
      ...standardRouteOptions,
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
      cors: corsOptions,
      timeout: {
        server: 600000,
        socket: 620000,
      },
      cache: {
        expiresIn: 30 * 60 * 1000,
        privacy: "public",
      },
    },
  },
  // Add static file serving route
  {
    method: "GET",
    path: "/temp/{param*}",
    handler: {
      directory: {
        path: tempPath,
        listing: false,
        index: false,
        defaultExtension: "pdf",
      },
    },
    options: {
      ...standardRouteOptions,
      auth: false,
    },
  },
  {
    method: "GET",
    path: "/api/convert-pdf-to-image/{id}",
    handler: convertPdfToImageHandler,
    options: {
      ...standardRouteOptions,
      description: "Convert PDF to Image",
      notes: "Generates an image preview from the sick leave PDF.",
      tags: ["api", "pdf"],
      plugins: {
        "hapi-swagger": {
          responses: {
            200: {
              description: "Image preview generated successfully",
              schema: Joi.object({
                // Define the response schema if necessary
              }),
            },
            404: {
              description: "Sick leave not found",
            },
            500: {
              description: "Internal Server Error",
            },
          },
        },
      },
    },
  },
  {
    method: "GET",
    path: "/api/sick-leaves",
    handler: getSickLeaves,
    options: {
      ...standardRouteOptions,
      pre: [{ method: verifyToken }],
    },
  },
  {
    method: "GET",
    path: "/api/dashboard/sick-leaves",
    handler: getDashboardSickLeaves,
    options: {
      ...standardRouteOptions,
      pre: [{ method: verifyToken }],
    },
  },
  {
    method: "GET",
    path: "/api/user/sick-leaves",
    handler: getUserSickLeaves,
    options: {
      ...standardRouteOptions,
      pre: [{ method: verifyToken }],
      auth: false,
    },
  },
  {
    method: 'POST',
    path: '/api/generate-pdf/{id}',
    handler: generatePDF,
    options: {
      description: 'Generate PDF document',
      tags: ['api', 'pdf'],
      validate: {
        params: Joi.object({
          id: Joi.string().required()
        })
      }
    }
  },
  {
    method: 'POST',
    path: '/api/send-pdf/{id}',
    handler: sendPDFEmail,
    options: {
      description: 'Send generated PDF via email',
      tags: ['api', 'pdf', 'email'],
      validate: {
        params: Joi.object({
          id: Joi.string().required()
        }),
        payload: Joi.object({
          email: Joi.string().email().required()
        })
      }
    }
  }
];

module.exports = routes;
