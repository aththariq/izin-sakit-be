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
  try {
    // Check if analysis already exists
    if (sickLeave.analisis && sickLeave.rekomendasi) {
      return {
        analisis: sickLeave.analisis,
        rekomendasi: sickLeave.rekomendasi,
        catatan: sickLeave.catatan || "Tidak ada catatan tambahan",
      };
    }

    // Format answers for analysis
    const answersFormatted = sickLeave.answers?.map(a => 
      `${a.questionId}: ${a.answer}`
    ).join("\n") || "Tidak ada jawaban tambahan";

    logger.info('Processing analysis for:', {
      reason: sickLeave.reason,
      age: sickLeave.age,
      gender: sickLeave.gender,
      hasAnswers: !!sickLeave.answers?.length
    });

    const prompt = `
Berikan analisis medis profesional untuk pasien dengan data berikut:

INFORMASI PASIEN
Keluhan Utama: ${sickLeave.reason}
${sickLeave.otherReason ? `Keluhan Tambahan: ${sickLeave.otherReason}` : ''}
Usia: ${sickLeave.age} tahun
Jenis Kelamin: ${sickLeave.gender === 'male' ? 'Laki-laki' : 'Perempuan'}

HASIL WAWANCARA MEDIS
${answersFormatted}

Berikan analisis dalam format JSON berikut:
{
  "analisis": "Analisis lengkap kondisi pasien berdasarkan keluhan dan jawaban (3-4 kalimat)",
  "rekomendasi": "Rekomendasi konkret termasuk durasi istirahat dan tindakan yang diperlukan (1-2 kalimat)",
  "catatan": "Catatan tambahan untuk pencegahan atau hal yang perlu diperhatikan (1 kalimat)"
}

PANDUAN ANALISIS:
1. Fokus pada korelasi antara gejala dan jawaban pasien
2. Pertimbangkan faktor usia dan gender
3. Berikan rekomendasi spesifik dan terukur
4. Sertakan langkah pencegahan yang relevan

Berikan respons dalam format JSON yang valid.`;

    logger.debug('Sending AI prompt:', { prompt });

    const completion = await openai.chat.completions.create({
      model: "google/gemini-2.0-flash-thinking-exp:free",
      messages: [
        {
          role: "system",
          content: "Anda adalah dokter yang memberikan analisis medis profesional dalam format JSON yang valid dan terstruktur.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    logger.debug('Raw AI response:', completion?.choices?.[0]?.message?.content);

    if (!completion?.choices?.[0]?.message?.content) {
      throw new Error('Empty response from AI service');
    }

    const rawResponse = completion.choices[0].message.content.trim();
    
    // Try multiple parsing approaches
    let analysisData;
    try {
      // Direct parse attempt
      analysisData = JSON.parse(rawResponse);
    } catch (firstError) {
      logger.debug('First parse attempt failed, trying to extract JSON', { rawResponse });
      
      // Try to extract JSON object
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.error('Could not find JSON pattern in response', { rawResponse });
        throw new Error('Invalid response format from AI service');
      }

      try {
        analysisData = JSON.parse(jsonMatch[0]);
      } catch (secondError) {
        logger.error('All parsing attempts failed', { rawResponse, firstError, secondError });
        throw new Error('Failed to parse AI response');
      }
    }

    // Validate the response structure
    if (!analysisData?.analisis || !analysisData?.rekomendasi) {
      logger.error('Invalid response structure', { analysisData });
      throw new Error('Invalid analysis data structure');
    }

    // Save to SickLeave document
    sickLeave.analisis = analysisData.analisis;
    sickLeave.rekomendasi = analysisData.rekomendasi;
    sickLeave.catatan = analysisData.catatan || "Tidak ada catatan tambahan";
    
    await sickLeave.save();
    logger.info('Successfully saved analysis');

    return {
      analisis: sickLeave.analisis,
      rekomendasi: sickLeave.rekomendasi,
      catatan: sickLeave.catatan,
    };

  } catch (error) {
    logger.error('Analysis generation error:', {
      error: error.message,
      sickLeaveId: sickLeave._id,
      reason: sickLeave.reason
    });

    // Create context-aware fallback response
    const fallbackAnalysis = {
      analisis: `Pasien ${sickLeave.username} (${sickLeave.age} tahun) melaporkan ${sickLeave.reason.toLowerCase()}` + 
                (sickLeave.answers?.length ? ` yang telah berlangsung selama ${sickLeave.answers[0].answer}.` : '.') +
                ' Berdasarkan keluhan yang dilaporkan, diperlukan istirahat untuk pemulihan optimal.',
      rekomendasi: `Direkomendasikan untuk istirahat selama 1-2 hari dan menghindari aktivitas yang memberatkan.`,
      catatan: `Harap segera konsultasi dengan dokter jika keluhan memberat atau tidak membaik dalam 48 jam.`,
    };

    // Save fallback response
    Object.assign(sickLeave, fallbackAnalysis);
    await sickLeave.save();
    logger.info('Using fallback analysis');

    return fallbackAnalysis;
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