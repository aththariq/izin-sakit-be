const fs = require("fs");
const path = require("path");
const pdf2pic = require("pdf2pic");
const { generatePDFDocument } = require("../utils/generatePDFDocument");
const SickLeave = require("../models/SickLeave");
const logger = require("../utils/logger");
const { cacheManager, getCacheKey } = require("../utils/cache");
const { analyzeAnswers } = require("../utils/analyzeAnswer");

const generatePdfAndImageHandler = async (request, h) => {
  const { id } = request.params;

  try {
    const pdfPath = path.join(__dirname, `../temp/surat_izin_sakit_${id}.pdf`);
    const imagePath = path.join(__dirname, `../temp/preview_${id}.png`);

    // Cek cache
    const cacheKey = getCacheKey(id);
    const cachedPdfPath = cacheManager.get(cacheKey);

    if (
      cachedPdfPath &&
      fs.existsSync(cachedPdfPath) &&
      fs.existsSync(imagePath)
    ) {
      logger.info(`Cache hit for PDF and image ${id}`);
      return h.response({
        message: "PDF and image already generated",
        pdfUrl: `/api/download/pdf/${id}`,
        imageUrl: `/api/download/image/${id}`,
      });
    }

    // Generate PDF
    const sickLeave = await SickLeave.findById(id);
    if (!sickLeave) {
      throw new Error("Sick leave not found");
    }

    // Generate analysis using AI
    const analysisResult = await analyzeAnswers(sickLeave);

    // Generate PDF dengan menyertakan hasil analisis
    await generatePDFDocument(sickLeave, pdfPath, analysisResult);

    // Simpan path PDF di cache
    cacheManager.set(cacheKey, pdfPath);
    logger.info(`PDF saved to cache with key: ${cacheKey}`);

    // Generate image dari PDF
    const options = {
      density: 300,
      saveFilename: `preview_${id}`,
      savePath: path.join(__dirname, "../temp"),
      format: "png",
      width: 2480,
      height: 3508,
    };

    const convert = pdf2pic.fromPath(pdfPath, options);
    await convert(1); // Convert halaman pertama

    // Rename file setelah konversi
    const oldPath = path.join(__dirname, `../temp/preview_${id}.1.png`);
    const newPath = path.join(__dirname, `../temp/preview_${id}.png`);

    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
    }

    return h.response({
      message: "PDF and image generated successfully",
      pdfUrl: `/api/download/pdf/${id}`,
      imageUrl: `/api/download/image/${id}`,
    });
  } catch (error) {
    logger.error("Failed to generate PDF and image:", error);
    return h
      .response({
        message: "Error generating PDF and image",
        error: error.message,
      })
      .code(500);
  }
};

module.exports = { generatePdfAndImageHandler };
