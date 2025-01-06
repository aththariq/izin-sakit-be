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
      description: 'Welcome endpoint',
      notes: 'Returns a welcome message',
      tags: ['api'],
      plugins: {
        'hapi-swagger': {
          responses: {
            '200': {
              description: 'Success',
              schema: Joi.object({
                message: Joi.string().required()
              })
            }
          }
        }
      }
    }
  },
  {
    method: "POST",
    path: "/register",
    handler: registerUser,
    options: {
      description: 'Register new user',
      notes: 'Creates a new user account',
      tags: ['api', 'users'],
      validate: {
        payload: Joi.object({
          username: Joi.string().min(3).max(30).required()
            .description('Username between 3-30 characters'),
          email: Joi.string().email().required()
            .description('Valid email address'),
          password: Joi.string().min(8).required()
            .description('Password minimum 8 characters')
        })
      },
      response: {
        schema: Joi.object({
          message: Joi.string()
        })
      },
      plugins: {
        'hapi-swagger': {
          responses: {
            '201': {
              description: 'User created successfully',
              schema: Joi.object({
                message: Joi.string()
              })
            },
            '400': {
              description: 'Bad Request'
            }
          }
        }
      }
    }
  },
  {
    method: "POST",
    path: "/login",
    handler: loginUser,
    options: {
      description: 'User login',
      notes: 'Authenticates user and returns JWT token',
      tags: ['api', 'users'],
      validate: {
        payload: Joi.object({
          email: Joi.string().email().required()
            .description('Registered email address'),
          password: Joi.string().min(8).required()
            .description('User password')
        })
      },
      response: {
        schema: Joi.object({
          message: Joi.string(),
          token: Joi.string()
        })
      }
    }
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
          startDate: Joi.string().required(), // Changed from date to string
          sickReason: Joi.string().min(1).required(),
          otherReason: Joi.string().allow("", null),
          gender: Joi.string().valid("male", "female").required(),
          age: Joi.number().min(1).required(),
          contactEmail: Joi.string().email().required(),
          phoneNumber: Joi.string().min(1).required()
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
  {
    method: "GET",
    path: "/api/sick-leaves",
    handler: getSickLeaves,
    options: {
      pre: [{ method: verifyToken }],
      cors: {
        origin: ["*"],
        additionalHeaders: ["cache-control", "x-requested-with"],
      },
    },
  },
  {
    method: "GET",
    path: "/api/dashboard/sick-leaves",
    handler: getDashboardSickLeaves,
    options: {
      pre: [{ method: verifyToken }],
      cors: {
        origin: ["*"],
        additionalHeaders: ["cache-control", "x-requested-with"],
      },
    },
  },
  {
    method: "GET",
    path: "/api/user/sick-leaves",
    handler: getUserSickLeaves,
    options: {
      pre: [{ method: verifyToken }],
      cors: {
        origin: ["*"],
        additionalHeaders: ["cache-control", "x-requested-with", "authorization"],
        credentials: true
      }
    },
  },
];

module.exports = routes;
