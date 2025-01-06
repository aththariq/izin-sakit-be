const jwt = require('jsonwebtoken');
const dotenv = require("dotenv");

dotenv.config();

const verifyToken = async (request, h) => {
  try {
    const token = request.headers.authorization?.split(' ')[1];
    
    if (!token) {
      console.log('No token provided');
      return h.response({ message: 'No token provided' }).code(401).takeover();
    }

    console.log('Verifying token:', token);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token:', decoded);

    // Set credentials that can be accessed in handlers
    request.auth = {
      credentials: {
        userId: decoded.userId,
        email: decoded.email
      },
      artifacts: { token }
    };

    return h.continue;
  } catch (error) {
    console.error('Token verification failed:', error);
    return h.response({ message: 'Invalid token' }).code(401).takeover();
  }
};

module.exports = verifyToken;
