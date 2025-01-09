const nodemailer = require("nodemailer");
const logger = require("../utils/logger");

// Create a transporter using Brevo SMTP
const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_SMTP_USER, // Email yang terdaftar di Brevo
    pass: process.env.BREVO_SMTP_KEY, // SMTP key dari Brevo
  },
  pool: true,
  maxConnections: 5,
  rateLimit: 10,
  rateDelta: 1000,
});

// Function to send email with attachment
const sendEmailWithAttachment = async (to, subject, text, attachment) => {
  try {
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
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
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
