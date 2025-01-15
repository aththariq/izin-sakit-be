const {
  generatePdfAndImageHandler,
} = require("../services/generatePdfAndImage");
const { sendPDFEmailHandler } = require("../services/sendPDFEmail");

module.exports = {
  generatePdfAndImageHandler,
  sendPDFEmailHandler,
};
