const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
const nodemailer = require("nodemailer");
const SickLeave = require("../models/SickLeave");
const pdf2pic = require("pdf2pic");
const { sendEmailWithAttachment } = require("./sendEmail");
const { performance } = require('perf_hooks');
const { cacheManager, getCacheKey } = require('../utils/cache');
const rateLimiter = require('../utils/rateLimit');
const logger = require('../utils/logger');
const { sendPDFEmailUtility } = require('./emailHandler'); // Import sendPDFEmailUtility

class PDFGenerationError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'PDFGenerationError';
    this.cause = cause;
  }
}

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:5173",
    "X-Title": "Izin Sakit App",
  },
});

// Konfigurasi email
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Fungsi untuk menganalisis jawaban dengan AI dan menyimpan analisis
async function analyzeAnswers(sickLeave) {
  // Check if analysis already exists
  if (sickLeave.analisis && sickLeave.rekomendasi) {
    return {
      analisis: sickLeave.analisis,
      rekomendasi: sickLeave.rekomendasi,
      catatan: sickLeave.catatan || "Tidak ada catatan tambahan",
    };
  }

  const prompt = `
Lakukan analisis medis komprehensif untuk pasien berikut dan berikan respons dalam format JSON:
Pasien: 
- Gejala Utama: ${sickLeave.reason} ${sickLeave.otherReason ? `(${sickLeave.otherReason})` : ""}
- Usia: ${sickLeave.age}
- Jenis Kelamin: ${sickLeave.gender}
- Jawaban Tambahan: ${sickLeave.answers.map((a) => `${a.answer}`).join(" | ")}

Berikan analisis dengan kriteria berikut (semua poin harus dibahas):
1. Analisis Gejala:
   - Gejala utama dan manifestasi klinisnya
   - Gejala pendukung dan kaitannya dengan kondisi utama
2. Evaluasi Keparahan:
   - Tingkat keparahan berdasarkan usia dan kondisi
   - Dampak potensial pada aktivitas sehari-hari
3. Faktor Risiko:
   - Faktor risiko yang relevan berdasarkan data yang tersedia
   - Potensi komplikasi yang perlu diwaspadai
4. Rekomendasi Medis:
   - Rekomendasi spesifik dengan durasi yang jelas
   - Tindakan yang harus diambil oleh pasien
5. Catatan Tambahan:
   - Informasi preventif atau tindakan pencegahan yang perlu diperhatikan

Format respons JSON:
{
  "analisis": "Analisis komprehensif (maksimal 10 kalimat)",
  "rekomendasi": "Rekomendasi konkret dengan durasi spesifik",
  "catatan": "Catatan penting atau tindakan pencegahan (1-6 kalimat)"
}

Panduan Konten:
- Analisis: Fokus pada temuan kunci, hindari pengulangan informasi
- Rekomendasi: Sebutkan durasi istirahat dan tindakan spesifik
- Catatan: Tambahkan informasi penting yang perlu diperhatikan pasien

Output harus berupa JSON valid tanpa teks tambahan.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "google/gemini-pro",
      messages: [
        {
          role: "system",
          content:
            "Anda adalah dokter yang memberikan analisis dalam format JSON yang valid. Respon harus berupa JSON murni tanpa teks tambahan.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3, // Lower temperature for more consistent output
    });

    let response = completion.choices[0].message.content.trim();
    console.log("Raw AI Response:", response); // Debug log

    // Clean the response: remove any text before { and after }
    response = response.substring(
      response.indexOf("{"),
      response.lastIndexOf("}") + 1
    );

    // Remove any line breaks and escape characters
    response = response.replace(/[\n\r\t]/g, " ").replace(/\s+/g, " ");

    console.log("Cleaned AI Response:", response); // Debug log

    let result;
    try {
      result = JSON.parse(response);
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError);
      throw new Error("Invalid JSON format in AI response");
    }

    // Validate required fields
    if (!result.analisis || !result.rekomendasi) {
      throw new Error("Missing required fields in AI response");
    }

    // Save analysis to SickLeave
    sickLeave.analisis = result.analisis;
    sickLeave.rekomendasi = result.rekomendasi;
    sickLeave.catatan = result.catatan || "Tidak ada catatan tambahan";
    await sickLeave.save();

    return {
      analisis: result.analisis,
      rekomendasi: result.rekomendasi,
      catatan: result.catatan || "Tidak ada catatan tambahan",
    };
  } catch (error) {
    console.error("Error in analyzeAnswers:", error);

    // Fallback response
    const fallbackResponse = {
      analisis:
        "Berdasarkan gejala yang dilaporkan, pasien memerlukan istirahat.",
      rekomendasi: "Istirahat selama 1-2 hari",
      catatan:
        "Silahkan konsultasi lebih lanjut dengan dokter jika keluhan berlanjut.",
    };

    // Save fallback to SickLeave
    Object.assign(sickLeave, fallbackResponse);
    await sickLeave.save();

    return fallbackResponse;
  }
}

// Separate PDF generation logic
async function generatePDFDocument(sickLeave, filePath) {
  const startTime = performance.now();
  logger.info(`Starting PDF generation for ID: ${sickLeave._id}`);

  try {
    await rateLimiter.acquire('pdf_generation');
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      bufferPages: true // Enable buffer for memory optimization
    });

    // Create write stream with error handling
    const writeStream = fs.createWriteStream(filePath);
    const streamPromise = new Promise((resolve, reject) => {
      writeStream.on('error', reject);
      writeStream.on('finish', resolve);
    });

    // Pipe with error handling
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
    const formattedAnalysis = sickLeave.analisis
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
      .text(sickLeave.rekomendasi, {
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
    throw new PDFGenerationError('Failed to generate PDF', error);
  } finally {
    rateLimiter.release('pdf_generation');
  }
}

// Main handler with caching
const generateAndSendPDF = async (request, h) => {
  const startTime = performance.now();
  const { id } = request.params;
  const { email, format } = request.query;
  
  try {
    // Check cache first
    const cacheKey = getCacheKey(id);
    let pdfPath = cacheManager.get(cacheKey);
    let cacheHit = !!pdfPath;

    if (!pdfPath) {
      logger.info(`Cache miss for PDF ${id}, generating new file`);
      
      const sickLeave = await SickLeave.findById(id);
      if (!sickLeave) {
        throw new Error('Sick leave not found');
      }

      pdfPath = path.join(__dirname, `../../temp/surat_izin_sakit_${id}.pdf`);
      
      // Get or generate analysis
      const analysis = await analyzeAnswers(sickLeave);
      
      // Generate PDF
      await generatePDFDocument(sickLeave, pdfPath);
      
      // Cache the result
      cacheManager.set(cacheKey, pdfPath);
    } else {
      logger.info(`Cache hit for PDF ${id}`);
    }

    // Handle preview format
    if (format === "preview") {
      return await handlePreviewGeneration(pdfPath, id);
    }

    // If email is provided, send it
    if (email) {
      await sendPDFEmailUtility(id, email, pdfPath); // Use the utility function
      return h.response({
        message: 'PDF generated and sent successfully',
        cacheHit,
        executionTime: performance.now() - startTime
      });
    }

    // Stream the file
    return h.file(pdfPath, {
      mode: 'inline',
      filename: 'surat_keterangan_sakit.pdf',
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'public, max-age=3600'
      }
    });

  } catch (error) {
    logger.error('PDF generation/sending failed:', {
      error: error.message,
      stack: error.stack,
      id,
      email
    });

    if (error instanceof PDFGenerationError) {
      try {
        return await generateFallbackPDF(id);
      } catch (fallbackError) {
        logger.error('Fallback PDF generation failed:', fallbackError);
      }
    }

    return h.response({
      message: 'Error processing request',
      error: error.message
    }).code(500);
  }
};

async function handlePreviewGeneration(pdfPath, id) {
  const options = {
    density: 100,
    saveFilename: `preview_${id}`,
    savePath: path.join(__dirname, "../../temp"),
    format: "png",
    width: 595,
    height: 842
  };

  const convert = pdf2pic.fromPath(pdfPath, options);
  const pageImage = await convert(1);

  return h.file(pageImage.path, {
    mode: "inline",
    filename: "preview.png",
    headers: {
      "Content-Type": "image/png"
    }
  });
}

const convertPdfToImageHandler = async (request, h) => {
  const { id } = request.params;

  try {
    const sickLeave = await SickLeave.findById(id);
    if (!sickLeave) {
      return h.response({ message: "Sick leave not found" }).code(404);
    }

    // Path file PDF
    const filePath = path.join(
      __dirname,
      `../../temp/surat_izin_sakit_${id}.pdf`
    );

    // Generate PDF if it doesn't exist
    if (!fs.existsSync(filePath)) {
      await generatePDF(sickLeave, filePath);
    }

    // Konfigurasi pdf2pic
    const options = {
      density: 300, // Resolusi lebih tinggi untuk kualitas lebih baik
      saveFilename: `preview_${id}`,
      savePath: path.join(__dirname, "../../temp"),
      format: "png",
      width: 2480, // A4 width pada 300 DPI
      height: 3508, // A4 height pada 300 DPI
    };

    // Konversi PDF ke PNG
    const convert = pdf2pic.fromPath(filePath, options);
    const pageImage = await convert(1); // Convert halaman pertama saja

    return h.file(pageImage.path, {
      mode: "inline",
      filename: "preview.png",
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error converting PDF to image:", error);
    return h
      .response({
        message: "Error converting PDF to image",
        error: error.message,
      })
      .code(500);
  }
};

// Single export at the end of file
module.exports = {
  generateAndSendPDF,
  convertPdfToImageHandler,
  generatePDFDocument // Exported for testing
};