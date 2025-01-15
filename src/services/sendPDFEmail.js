const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");
const { sendPDFEmailUtility } = require("../utils/generateEmail");

const sendPDFEmailHandler = async (request, h) => {
  const { id } = request.params;
  const { email } = request.payload;

  try {
    const pdfPath = path.join(
      __dirname,
      `../temp/surat_izin_sakit_${id}.pdf`
    );

    if (!fs.existsSync(pdfPath)) {
      return h.response({ message: "PDF not found" }).code(404);
    }

    await sendPDFEmailUtility(id, email, pdfPath);
    return h.response({ message: "PDF sent successfully" });
  } catch (error) {
    logger.error("Failed to send email:", error);
    return h
      .response({
        message: "Error sending email",
        error: error.message,
      })
      .code(500);
  }
};

module.exports = { sendPDFEmailHandler };
