const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
const nodemailer = require("nodemailer");
const SickLeave = require("../models/SickLeave");
const { fromPath } = require("pdf2pic");

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

// Fungsi untuk membuat dan mengirim PDF
const generateAndSendPDF = async (request, h) => {
  const { id } = request.params;
  const { email, format } = request.query; // Email opsional untuk pengiriman

  try {
    const sickLeave = await SickLeave.findById(id);
    if (!sickLeave) {
      return h.response({ message: "Sick leave not found" }).code(404);
    }

    // Dapatkan analisis AI
    const analysis = await analyzeAnswers(sickLeave);

    // Buat PDF
    const doc = new PDFDocument();
    const filePath = path.join(
      __dirname,
      `../../temp/surat_izin_sakit_${id}.pdf`
    );
    const writeStream = fs.createWriteStream(filePath);

    // Tunggu hingga PDF selesai dibuat
    await new Promise((resolve, reject) => {
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
        .text(analysis.analisis)
        .moveDown()
        .text(`Rekomendasi istirahat: ${analysis.rekomendasi}`)
        .moveDown();

      if (analysis.catatan) {
        doc
          .text("Catatan:", { underline: true })
          .text(analysis.catatan)
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

      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    // If preview requested, use pdf2pic
    if (format === "preview") {
      const options = {
        density: 300,
        saveFilename: `preview_${id}`,
        savePath: path.join(__dirname, "../../temp"),
        format: "png",
        width: 1240,  // Half of A4 width for preview
        height: 1754  // Half of A4 height for preview
      };

      const convert = fromPath(filePath, options);
      const result = await convert(1);

      const imageBuffer = await fs.promises.readFile(result.path);
      
      // Clean up
      fs.unlink(result.path, (err) => {
        if (err) console.error('Error deleting preview image:', err);
      });

      return h.response(imageBuffer)
        .type('image/png')
        .header('Content-Disposition', 'inline; filename=preview.png');
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

    // Return PDF file with proper headers
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

const convertPdfToImageHandler = async (request, h) => {
  const { id } = request.params;

  try {
    const filePath = path.join(__dirname, `../../temp/surat_izin_sakit_${id}.pdf`);
    const outputPath = path.join(__dirname, `../../temp/`);

    if (!fs.existsSync(filePath)) {
      return h.response({ message: "PDF file not found" }).code(404);
    }

    const options = {
      density: 300,
      saveFilename: `surat_izin_sakit_${id}`,
      savePath: outputPath,
      format: "png",
      width: 2480,  // A4 width at 300 DPI
      height: 3508  // A4 height at 300 DPI
    };

    const convert = fromPath(filePath, options);
    const pageToConvertAsImage = 1;

    // Convert first page to image
    const result = await convert(pageToConvertAsImage);

    // Read the generated PNG
    const imageBuffer = await fs.promises.readFile(result.path);
    
    // Clean up temporary file
    fs.unlink(result.path, (err) => {
      if (err) console.error('Error deleting temporary image:', err);
    });

    return h.response(imageBuffer)
      .type('image/png')
      .header('Content-Disposition', 'inline; filename=surat_izin_sakit.png');
  } catch (error) {
    console.error("Error converting PDF to image:", error);
    return h.response({ message: "Error converting PDF to image" }).code(500);
  }
};

// Make sure export matches the imported name in routes
module.exports = {
  generateAndSendPDF,
  convertPdfToImageHandler,
};
