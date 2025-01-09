const nodemailer = require("nodemailer");
const logger = require('../utils/logger');

// Create a transporter using environment variables
const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER, // Your Gmail address
    pass: process.env.EMAIL_PASSWORD, // Your Gmail password or App Password
  },
  pool: true, // Enable connection pooling
  maxConnections: 5, // Adjust based on your needs
  rateLimit: 10, // Allow up to 10 emails per second
  rateDelta: 1000, // Per second
});

// Function to send email with attachment
const sendEmailWithAttachment = async (to, subject, text, attachment) => {
  try {
    // Tambah retry logic
    const maxRetries = 3;
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to,
          subject,
          text,
          attachments: [attachment],
        };

        await transporter.sendMail(mailOptions);
        logger.info(`Email sent to ${to}`);
        return;
      } catch (error) {
        lastError = error;
        logger.error(`Retry ${i + 1} failed to send email to ${to}:`, error);
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
      }
    }
    throw lastError;
  } catch (error) {
    logger.error("Error sending email:", error);
    throw error;
  }
};

module.exports = {
  sendEmailWithAttachment,
};
