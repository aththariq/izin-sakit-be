const bcrypt = require("bcrypt");
const User = require("../models/User");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const axios = require("axios");

dotenv.config();

// Validasi FRONTEND_URL saat startup
const FRONTEND_URL = process.env.FRONTEND_URL;
if (!FRONTEND_URL) {
  throw new Error("FRONTEND_URL environment variable is not configured");
}

console.log("Frontend URL configured as:", FRONTEND_URL);

const registerUser = async (request, h) => {
  try {
    console.log("=== Start Registration Process ===");
    console.log("Request payload:", request.payload);

    const { username, email, password } = request.payload;

    // Log validasi input
    console.log("Validating input fields...");
    if (!username || !email || !password) {
      console.log("Validation failed: Missing required fields");
      return h
        .response({
          error: "Bad Request",
          message: "Semua field harus diisi",
        })
        .code(400);
    }

    // Log pengecekan existing user
    console.log("Checking for existing user...");
    console.log("Query:", { $or: [{ username }, { email }] });

    const existingUser = await User.findOne({
      $or: [{ username: username }, { email: email }],
    });

    if (existingUser) {
      console.log("Existing user found:", {
        existingUsername: existingUser.username,
        existingEmail: existingUser.email,
      });

      const field = existingUser.username === username ? "Username" : "Email";
      return h
        .response({
          error: "Bad Request",
          message: `${field} sudah terdaftar`,
        })
        .code(400);
    }

    console.log("Hashing password...");
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log("Creating new user object...");
    const user = new User({
      username,
      email,
      password: hashedPassword,
    });

    console.log("Attempting to save user...");
    await user.save();
    console.log("User saved successfully");

    return h
      .response({
        message: "User registered successfully",
      })
      .code(201);
  } catch (error) {
    console.error("=== Registration Error Details ===");
    console.error("Error name:", error.name);
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    if (error.code === 11000) {
      console.error("Duplicate key error details:", error.keyValue);
    }

    const response = {
      error: "Internal Server Error",
      message: "Terjadi kesalahan saat registrasi",
    };

    if (error.code === 11000) {
      const duplicatedField = Object.keys(error.keyValue)[0];
      console.log("Duplicate field:", duplicatedField);
      response.message = `${
        duplicatedField.charAt(0).toUpperCase() + duplicatedField.slice(1)
      } sudah terdaftar`;
      response.error = "Bad Request";
    }

    if (process.env.NODE_ENV !== "production") {
      response.details = error.message;
      response.stack = error.stack;
    }

    console.error("Final error response:", response);
    return h.response(response).code(response.statusCode || 500);
  }
};

const loginUser = async (request, h) => {
  const { email, password } = request.payload;

  // Remove incorrect validation
  console.log("Login attempt for:", email);

  // Cek apakah email terdaftar
  const user = await User.findOne({ email });
  if (!user) {
    return h.response({ message: "Email tidak terdaftar" }).code(400);
  }

  // Cek apakah kata sandi benar
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return h.response({ message: "Kata sandi salah" }).code(400);
  }

  // Buat JWT
  const token = jwt.sign(
    { id: user._id, email: user.email, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY }
  );

  // Kembalikan token
  return h
    .response({
      message: "Login berhasil",
      token, // Kirim token ke client
    })
    .code(200);
};

const handleGoogleCallback = async (request, h) => {
  console.log("Received callback request:", request.query);
  const { code } = request.query;

  if (!code) {
    console.error("No authorization code received");
    return h.response({ message: "Authorization code missing" }).code(400);
  }

  try {
    const tokenUrl = "https://oauth2.googleapis.com/token";
    const tokenData = {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    };

    console.log("Requesting token with data:", {
      ...tokenData,
      client_secret: "[HIDDEN]",
    });

    const { data } = await axios.post(tokenUrl, tokenData);
    console.log("Token response data:", data); // Debug log

    const { access_token } = data;

    // Dapatkan informasi pengguna dari Google
    const { data: profile } = await axios.get(
      "https://www.googleapis.com/oauth2/v1/userinfo",
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

    const { email, name, picture } = profile;

    // Cek apakah user sudah terdaftar
    let user = await User.findOne({ email });

    // Jika user belum terdaftar, buat user baru
    if (!user) {
      user = new User({
        username: name,
        email,
        password: "google-oauth", // Password default untuk user Google
        profilePicture: picture,
      });
      await user.save();
      console.log("New user created:", user); // Debug log
    }

    // Buat JWT untuk user
    const jwtToken = jwt.sign(
      { id: user._id, email: user.email, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY }
    );

    // Remove Bearer prefix
    const authToken = jwtToken;
    const redirectUrl = `${FRONTEND_URL}/login?token=${encodeURIComponent(
      jwtToken
    )}`;

    // Ensure FRONTEND_URL is properly configured
    if (!FRONTEND_URL) {
      throw new Error("FRONTEND_URL is not configured");
    }

    // Redirect with token
    console.log("Redirecting to:", redirectUrl);

    return h.redirect(redirectUrl).code(302);
  } catch (error) {
    console.error("Google OAuth error:", error);
    return h.redirect(`${FRONTEND_URL}/login?error=auth_failed`).code(302);
  }
};

module.exports = {
  registerUser,
  loginUser,
  handleGoogleCallback,
};
