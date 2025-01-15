const fs = require("fs");
const PDFDocument = require("pdfkit");
const { performance } = require("perf_hooks");
const rateLimiter = require("./rateLimit");
const logger = require("./logger");

class PDFGenerationError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "PDFGenerationError";
    this.cause = cause;
  }
}

async function generatePDFDocument(sickLeave, filePath, analysisResult) {
  const startTime = performance.now();
  logger.info(`Starting PDF generation for ID: ${sickLeave._id}`);

  try {
    await rateLimiter.acquire("pdf_generation");

    logger.info("SickLeave data:", { sickLeave });

    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      bufferPages: true,
    });

    logger.info("PDF will be saved to:", { filePath });

    const writeStream = fs.createWriteStream(filePath);
    const streamPromise = new Promise((resolve, reject) => {
      writeStream.on("error", (error) => {
        logger.error("Write stream error:", { error: error.message });
        reject(error);
      });
      writeStream.on("finish", resolve);
    });

    doc.pipe(writeStream);

    // Fungsi helper untuk membuat header section
    const addSectionHeader = (text) => {
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .text(text, { underline: true })
        .moveDown(0.5);
    };

    // Header surat dengan kop yang formal
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .text("SURAT KETERANGAN SAKIT", { align: "center" })
      .fontSize(12)
      .text(
        `Nomor: SKS/${new Date().getFullYear()}/${sickLeave._id
          .toString()
          .substr(-6)}`,
        {
          align: "center",
        }
      )
      .moveDown(2);

    // Data Pasien
    addSectionHeader("DATA PASIEN");
    doc
      .font("Helvetica")
      .fontSize(11)
      .text(
        [
          `Nama Lengkap      : ${sickLeave.username}`,
          `Jenis Kelamin     : ${
            sickLeave.gender === "male" ? "Laki-laki" : "Perempuan"
          }`,
          `Usia             : ${sickLeave.age} tahun`,
          `Institusi        : ${sickLeave.institution}`,
        ].join("\n"),
        {
          paragraphGap: 5,
          lineGap: 5,
        }
      )
      .moveDown(1.5);

    // Hasil Pemeriksaan
    addSectionHeader("HASIL PEMERIKSAAN");
    doc
      .font("Helvetica")
      .text("Anamnesis:", { continued: true })
      .text(
        ` ${sickLeave.reason} ${
          sickLeave.otherReason ? `(${sickLeave.otherReason})` : ""
        }`
      )
      .moveDown(0.5);

    // Format analisis dengan bullet points
    const formattedAnalysis = analysisResult.analisis
      .split(". ")
      .filter((point) => point.trim().length > 0)
      .map((point) => `• ${point.trim()}${point.endsWith(".") ? "" : "."}`);

    doc.text("Pemeriksaan Klinis:", { lineGap: 5 }).moveDown(0.5);

    formattedAnalysis.forEach((point) => {
      doc.text(point, {
        indent: 20,
        align: "justify",
        lineGap: 3,
      });
    });

    doc
      .moveDown(1)
      .font("Helvetica-Bold")
      .text("Diagnosis:", { continued: true })
      .font("Helvetica")
      .text(` ${sickLeave.reason}`)
      .moveDown(1.5);

    // Rekomendasi
    addSectionHeader("REKOMENDASI MEDIS");
    doc
      .font("Helvetica")
      .text(analysisResult.rekomendasi, {
        lineGap: 3,
        align: "justify",
      })
      .moveDown(1);

    // Tanda tangan dengan layout yang efisien
    const today = new Date().toLocaleDateString("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    doc
      .text(`Jakarta, ${today}`, { align: "right" })
      .moveDown(0.3)
      .text("Dokter Pemeriksa,", { align: "right" })
      .moveDown(1.5)
      .font("Helvetica-Bold")
      .text("dr. AI System, Sp.KA", { align: "right" })
      .font("Helvetica")
      .fontSize(8)
      .text("No. SIP: AI/2024/001", { align: "right" });

    // Footer
    doc
      .fontSize(7)
      .text(
        "Dokumen ini dihasilkan secara digital dan sah tanpa tanda tangan basah",
        {
          align: "center",
          color: "grey",
        }
      );

    // Finalize document
    doc.end();
    await streamPromise;

    return filePath;
  } catch (error) {
    logger.error("Error generating PDF:", {
      error: error.message,
      stack: error.stack,
    });
    throw new PDFGenerationError("Failed to generate PDF", error);
  } finally {
    rateLimiter.release("pdf_generation");
  }
}

module.exports = {
  generatePDFDocument,
};
