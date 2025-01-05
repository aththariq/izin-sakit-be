const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
const nodemailer = require("nodemailer");
const SickLeave = require("../models/SickLeave");
const { fromPath } = require('pdf2pic');

// Remove pdfjsLib related code
// const pdfjsLib = require('pdfjs-dist');
// const { createCanvas } = require('canvas');

// Inisialisasi worker untuk pdf.js
// pdfjsLib.GlobalWorkerOptions.workerSrc = path.join(__dirname, '../../node_modules/pdfjs-dist/build/pdf.worker.js');

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:5173",
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

// Fungsi untuk menganalisis jawaban dengan AI
async function analyzeAnswers(sickLeave) {
  const prompt = `
    Berdasarkan data pasien berikut:
    - Gejala: ${sickLeave.reason}
    - Usia: ${sickLeave.age}
    - Jenis Kelamin: ${sickLeave.gender}
    - Jawaban tambahan:
    ${sickLeave.answers.map((a) => `  - ${a.answer}`).join("\n")}
    
    Berikan analisis medis dalam format JSON yang valid seperti contoh berikut:
    {
      "analisis": "Berdasarkan gejala yang dilaporkan...",
      "rekomendasi": "Istirahat selama X hari",
      "catatan": "Tambahan saran jika ada"
    }

    Pastikan output hanya berupa JSON yang valid, tanpa teks tambahan.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "google/gemini-pro",
      messages: [
        {
          role: "system",
          content:
            "Anda adalah dokter yang memberikan analisis dalam format JSON yang valid. Jangan tambahkan teks atau markdown diluar JSON.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.5, // Lower temperature for more consistent formatting
    });

    const response = completion.choices[0].message.content.trim();
    console.log("AI Response:", response); // Debug log

    // Try to extract JSON if response contains other text
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid JSON format in response");
    }

    const jsonStr = jsonMatch[0];
    const result = JSON.parse(jsonStr);

    // Validate required fields
    if (!result.analisis || !result.rekomendasi) {
      throw new Error("Missing required fields in AI response");
    }

    return {
      analisis: result.analisis,
      rekomendasi: result.rekomendasi,
      catatan: result.catatan || "Tidak ada catatan tambahan",
    };
  } catch (error) {
    console.error("Error analyzing answers:", error);
    // Return fallback analysis if AI fails
    return {
      analisis:
        "Berdasarkan gejala yang dilaporkan, pasien memerlukan istirahat.",
      rekomendasi: "Istirahat selama 1-2 hari",
      catatan:
        "Silahkan konsultasi lebih lanjut dengan dokter jika keluhan berlanjut.",
    };
  }
}

// Add this helper function at the top
const ensureTempDirExists = () => {
  const tempDir = path.join(__dirname, "../../temp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  return tempDir;
};

// Fungsi untuk mengkonversi PDF ke PNG menggunakan pdf2pic
const convertPDFToPNG = async (pdfPath, pngPath) => {
  try {
    console.log('Converting PDF:', pdfPath);
    console.log('Target PNG:', pngPath);

    const options = {
      density: 300,
      saveFilename: path.basename(pngPath, '.png'),
      savePath: path.dirname(pngPath),
      format: "png",
      width: 2000,
      height: 2830
    };

    const convert = fromPath(pdfPath, options);
    const pageToConvertAsImage = 1;
    
    const result = await convert(pageToConvertAsImage);
    console.log('Conversion result:', result);

    return true;
  } catch (error) {
    console.error('Error converting PDF to PNG:', error);
    throw error;
  }
};

// Fungsi untuk membuat dan menyimpan kedua format
const generateBothFormats = async (sickLeave, analysis, tempDir, id) => {
  const pdfPath = path.join(tempDir, `surat_izin_sakit_${id}.pdf`);
  const pngPath = path.join(tempDir, `surat_izin_sakit_${id}.png`);

  // Generate PDF
  const doc = new PDFDocument();
  await new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    // Header surat
    doc.fontSize(18).text("SURAT KETERANGAN SAKIT", { align: "center" });
    doc.moveDown();

    // Informasi pasien
    doc.fontSize(12)
      .text("Yang bertanda tangan di bawah ini menerangkan bahwa:", { align: "left" })
      .moveDown();

    doc.text(`Nama          : ${sickLeave.username}`)
      .text(`Jenis Kelamin : ${sickLeave.gender === "male" ? "Laki-laki" : "Perempuan"}`)
      .text(`Umur          : ${sickLeave.age} tahun`)
      .moveDown();

    // Analisis dan rekomendasi
    doc.text("HASIL PEMERIKSAAN:", { underline: true })
      .moveDown()
      .text(analysis.analisis)
      .moveDown()
      .text(`Rekomendasi istirahat: ${analysis.rekomendasi}`)
      .moveDown();

    if (analysis.catatan) {
      doc.text("Catatan:", { underline: true })
        .text(analysis.catatan)
        .moveDown();
    }

    // Tanda tangan dan cap
    doc.moveDown(2)
      .text(new Date().toLocaleDateString("id-ID"), { align: "right" })
      .moveDown()
      .text("Dokter yang bertugas,", { align: "right" })
      .moveDown(3)
      .text("dr. Sistem AI", { align: "right" });

    doc.end();
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  // Add delay to ensure PDF is completely written
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Convert to PNG
  await convertPDFToPNG(pdfPath, pngPath);
  
  return { pdfPath, pngPath };
};

const generateAndSendPDF = async (request, h) => {
  const { id } = request.params;
  const { email, format } = request.query;
  const tempDir = ensureTempDirExists();
  
  try {
    const pdfPath = path.join(tempDir, `surat_izin_sakit_${id}.pdf`);
    const pngPath = path.join(tempDir, `surat_izin_sakit_${id}.png`);
    
    // Cek apakah file sudah ada
    if (!fs.existsSync(pdfPath) || !fs.existsSync(pngPath)) {
      const sickLeave = await SickLeave.findById(id);
      if (!sickLeave) {
        return h.response({ message: "Sick leave not found" }).code(404);
      }

      const analysis = await analyzeAnswers(sickLeave);
      await generateBothFormats(sickLeave, analysis, tempDir, id);
    }

    // Return sesuai format yang diminta
    if (format === 'preview') {
      return h.file(pngPath, {
        mode: 'inline',
        filename: 'preview.png',
        headers: {
          'Content-Type': 'image/png'
        }
      });
    }

    // Handle email jika ada
    if (email) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Surat Keterangan Sakit",
        text: "Terlampir surat keterangan sakit Anda",
        attachments: [
          {
            filename: "surat_keterangan_sakit.pdf",
            path: pdfPath,
          },
        ],
      });

      return h
        .response({
          message: "PDF generated and sent to email successfully",
          analysis,
        })
        .code(200);
    }

    // Return PDF
    return h.file(pdfPath, {
      mode: "inline",
      filename: "surat_keterangan_sakit.pdf",
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=surat_keterangan_sakit.pdf",
      },
    });
  } catch (error) {
    console.error('Detailed error:', error);
    return h.response({
      message: "Error processing request",
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }).code(500);
  }
};

// Hapus atau comment out fungsi convertPdfToImageHandler karena sudah tidak digunakan
// const convertPdfToImageHandler = async (request, h) => { ... }

// Make sure export matches the imported name in routes
module.exports = {
  generateAndSendPDF,
  // Remove convertPdfToImageHandler from exports
};
