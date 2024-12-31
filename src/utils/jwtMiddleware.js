const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

dotenv.config();

const verifyToken = async (request, h) => {
  const authorization = request.headers.authorization;

  if (!authorization) {
    return h.response({ message: "Token missing" }).code(401).takeover();
  }

  const token = authorization.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    request.auth = { user: decoded }; // Tambahkan data user ke request.auth
    return h.continue;
  } catch (error) {
    return h
      .response({ message: "Invalid or expired token" })
      .code(401)
      .takeover();
  }
};

module.exports = verifyToken;
