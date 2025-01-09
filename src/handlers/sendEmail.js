const nodemailer = require("nodemailer");

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
          pool: true, // Enable connection pooling
          maxConnections: 5,
          rateDelta: 1000, // Limit rate
          rateLimit: 5, // Max 5 emails per second
        };

        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${to}`);
        return;
      } catch (error) {
        lastError = error;
        console.error(`Retry ${i + 1} failed:`, error);
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
      }
    }
    throw lastError;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

module.exports = {
  sendEmailWithAttachment,
};
