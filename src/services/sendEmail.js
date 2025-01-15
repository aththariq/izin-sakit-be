const nodemailer = require("nodemailer");
const logger = require("../utils/logger");
const fs = require("fs");

// Create a transporter using Brevo SMTP
const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: {
    user: "833700001@smtp-brevo.com",
    pass: process.env.BREVO_SMTP_KEY,
  },
  pool: true,
  maxConnections: 5,
  rateLimit: 10,
  rateDelta: 1000,
  debug: true, 
  logger: true, 
});

// Function to send email with PDF attachment
const sendEmailWithAttachment = async (to, subject, text, attachment) => {
  try {
    const maxRetries = 3;
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
      try {
        // Baca file PDF sebagai stream
        const mailOptions = {
          from: '"Izin Sakit" <surat@izinsakit.site>',
          to,
          subject,
          text,
          attachments: [
            {
              filename: attachment.filename || "surat_keterangan_sakit.pdf",
              content: fs.createReadStream(attachment.path), 
              contentType: attachment.contentType || "application/pdf",
            },
          ],
        };

        await transporter.sendMail(mailOptions);
        logger.info(`Email sent successfully to ${to}`);
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

module.exports = { sendEmailWithAttachment };
