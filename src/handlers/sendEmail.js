const nodemailer = require("nodemailer");
const logger = require("../utils/logger");

// Create a transporter using environment variables
const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "142.251.175.109",
  port: 587,
  secure: false, // Gunakan STARTTLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  pool: true,
  maxConnections: 5,
  rateLimit: 10,
  rateDelta: 1000,
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
