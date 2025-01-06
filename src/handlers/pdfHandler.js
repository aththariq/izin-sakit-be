const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
const nodemailer = require("nodemailer");
const SickLeave = require("../models/SickLeave");
const pdf2pic = require("pdf2pic");

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

    // Extract JSON from response
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
    console.error("Error analyzing answers:", error);
    // Return fallback analysis if AI fails
    sickLeave.analisis = "Berdasarkan gejala yang dilaporkan, pasien memerlukan istirahat.";
    sickLeave.rekomendasi = "Istirahat selama 1-2 hari";
    sickLeave.catatan = "Silahkan konsultasi lebih lanjut dengan dokter jika keluhan berlanjut.";
    await sickLeave.save();
    return {
      analisis: sickLeave.analisis,
      rekomendasi: sickLeave.rekomendasi,
      catatan: sickLeave.catatan,
    };
  }
}

// Add a standalone function to generate PDF
async function generatePDF(sickLeave, filePath) {
  const doc = new PDFDocument();
  const writeStream = fs.createWriteStream(filePath);

  return new Promise((resolve, reject) => {
    doc.pipe(writeStream);

    // Header surat
    doc.fontSize(18).text("SURAT KETERANGAN SAKIT", { align: "center" });
    doc.moveDown();

    // Informasi pasien
    doc
      .fontSize(12)
      .text("Yang bertanda tangan di bawah ini menerangkan bahwa:", {
        align: "left",
      })
      .moveDown();

    doc
      .text(`Nama          : ${sickLeave.username}`)
      .text(
        `Jenis Kelamin : ${
          sickLeave.gender === "male" ? "Laki-laki" : "Perempuan"
        }`
      )
      .text(`Umur          : ${sickLeave.age} tahun`)
      .moveDown();

    // Analisis dan rekomendasi
    doc
      .text("HASIL PEMERIKSAAN:", { underline: true })
      .moveDown()
      .text(sickLeave.analisis)
      .moveDown()
      .text(`Rekomendasi istirahat: ${sickLeave.rekomendasi}`)
      .moveDown();

    if (sickLeave.catatan) {
      doc
        .text("Catatan:", { underline: true })
        .text(sickLeave.catatan)
        .moveDown();
    }

    // Tanda tangan dan cap
    doc
      .moveDown(2)
      .text(new Date().toLocaleDateString("id-ID"), { align: "right" })
      .moveDown()
      .text("Dokter yang bertugas,", { align: "right" })
      .moveDown(3)
      .text("dr. Sistem AI", { align: "right" });

    doc.end();

    writeStream.on("finish", () => resolve(filePath));
    writeStream.on("error", reject);
  });
}

// Modify generateAndSendPDF to use generatePDF
const generateAndSendPDF = async (request, h) => {
  const { id } = request.params;
  const { email, format } = request.query; // Email opsional untuk pengiriman

  try {
    const sickLeave = await SickLeave.findById(id);
    if (!sickLeave) {
      return h.response({ message: "Sick leave not found" }).code(404);
    }

    // Get or generate analysis
    const analysis = await analyzeAnswers(sickLeave);

    // Path untuk menyimpan PDF
    const filePath = path.join(__dirname, `../../temp/surat_izin_sakit_${id}.pdf`);

    // Generate PDF
    await generatePDF(sickLeave, filePath);

    // If preview requested, convert first page to PNG
    if (format === "preview") {
      const options = {
        density: 100,
        saveFilename: `preview_${id}`,
        savePath: path.join(__dirname, "../../temp"),
        format: "png",
        width: 595, // A4 width in pixels at 72 DPI
        height: 842, // A4 height in pixels at 72 DPI
      };

      const convert = pdf2pic.fromPath(filePath, options);
      const pageImage = await convert(1); // Convert first page

      return h.file(pageImage.path, {
        mode: "inline",
        filename: "preview.png",
        headers: {
          "Content-Type": "image/png",
        },
      });
    }

    // Kirim email jika ada alamat email
    if (email) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Surat Keterangan Sakit",
        text: "Terlampir surat keterangan sakit Anda",
        attachments: [
          {
            filename: "surat_keterangan_sakit.pdf",
            path: filePath,
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

    // Return PDF file dengan header yang tepat
    return h.file(filePath, {
      mode: "inline",
      filename: "surat_keterangan_sakit.pdf",
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=surat_keterangan_sakit.pdf",
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return h
      .response({
        message: "Error processing request",
        error: error.message,
      })
      .code(500);
  }
};

const { pdfToPng } = require("pdf-to-png-converter");

const convertPdfToImageHandler = async (request, h) => {
  const { id } = request.params;

  try {
    const sickLeave = await SickLeave.findById(id);
    if (!sickLeave) {
      return h.response({ message: "Sick leave not found" }).code(404);
    }

    // Path file PDF
    const filePath = path.join(__dirname, `../../temp/surat_izin_sakit_${id}.pdf`);

    // Generate PDF if it doesn't exist
    if (!fs.existsSync(filePath)) {
      await generatePDF(sickLeave, filePath);
    }

    // Periksa apakah file PDF ada
    if (!fs.existsSync(filePath)) {
      return h.response({ message: "PDF file not found" }).code(404);
    }

    // Konversi halaman pertama PDF ke gambar PNG
    const pngPages = await pdfToPng(filePath, {
      outputFolder: "", // Tidak menyimpan ke folder, hanya menghasilkan buffer
      outputFileMaskFunc: (pageNum) => `page_${pageNum}.png`,
      pagesToProcess: [1], // Hanya halaman pertama
      viewportScale: 2.0, // Skala viewport untuk resolusi tinggi
    });

    // Kirim halaman pertama sebagai respons (PNG)
    return h.response(pngPages[0].content).type("image/png");
  } catch (error) {
    console.error("Error converting PDF to image:", error.message);
    return h.response({ message: "Error converting PDF to image" }).code(500);
  }
};

// Make sure export matches the imported name in routes
module.exports = {
  generateAndSendPDF,
  convertPdfToImageHandler,
};
