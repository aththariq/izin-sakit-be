// handlers/userHandlers.js
const bcrypt = require("bcrypt");
const User = require("../models/User");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const axios = require("axios");

dotenv.config();

const registerUser = async (request, h) => {
  const { username, email, password } = request.payload;

  // Debugging: Tampilkan data yang diterima
  console.log("Data yang diterima saat registrasi:");
  console.log("Username:", username);
  console.log("Email:", email);
  console.log("Password:", password);

  // Cek apakah username sudah ada
  const existingUsername = await User.findOne({ username });
  if (existingUsername) {
    console.log("Username sudah terdaftar:", username); // Debugging
    return h.response({ message: "Username already exists" }).code(400);
  }

  // Cek apakah email sudah ada
  const existingEmail = await User.findOne({ email });
  if (existingEmail) {
    console.log("Email sudah terdaftar:", email); // Debugging
    return h.response({ message: "Email already exists" }).code(400);
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);
  console.log("Password yang di-hash:", hashedPassword); // Debugging

  // Buat user baru
  const user = new User({
    username,
    email,
    password: hashedPassword,
  });

  await user.save();
  console.log("User berhasil disimpan:", user); // Debugging

  return h.response({ message: "User registered successfully" }).code(201);
};

const loginUser = async (request, h) => {
  const { email, password } = request.payload;

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
  console.log('Received callback request:', request.query);  // Tambahkan logging
  const { code } = request.query;

  if (!code) {
    console.error('No authorization code received');
    return h.response({ message: 'Authorization code missing' }).code(400);
  }

  try {
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const tokenData = {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code'
    };

    console.log('Requesting token with data:', {
      ...tokenData,
      client_secret: '[HIDDEN]'
    });

    const { data } = await axios.post(tokenUrl, tokenData);
    console.log('Token response data:', data); // Debug log

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

    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
    const redirectUrl = `${FRONTEND_URL}/Dashboard?token=${jwtToken}`;
    console.log('Redirecting to:', redirectUrl); // Debug log

    return h.redirect(redirectUrl).code(302); // Pastikan status code 302
  } catch (error) {
    console.error('Google OAuth error:', {
      message: error.message,
      response: error.response?.data,
      config: {
        url: error.config?.url,
        data: error.config?.data
      }
    });
    
    return h.response({ 
      message: "Gagal login dengan Google",
      error: error.response?.data || error.message
    }).code(400);
  }
};

module.exports = {
  registerUser,
  loginUser,
  handleGoogleCallback,
};
