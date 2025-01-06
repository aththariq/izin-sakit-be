const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
const nodemailer = require("nodemailer");
const SickLeave = require("../models/SickLeave");
const pdf2pic = require("pdf2pic");
const { sendEmailWithAttachment } = require("./sendEmail");

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
    Berikan analisis medis untuk pasien dengan data berikut:
    - Gejala: ${sickLeave.reason} ${
    sickLeave.otherReason ? `(${sickLeave.otherReason})` : ""
  }
    - Usia: ${sickLeave.age}
    - Jenis Kelamin: ${sickLeave.gender}
    - Jawaban tambahan:
    ${sickLeave.answers.map((a) => `  - ${a.answer}`).join("\n")}
    
    Berikan respons dalam format JSON yang valid:
    {
      "analisis": "analisis medis disini",
      "rekomendasi": "rekomendasi disini",
      "catatan": "catatan tambahan disini"
    }`;

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

// Add a standalone function to generate PDF
async function generatePDF(sickLeave, filePath) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50
  });
  const writeStream = fs.createWriteStream(filePath);

  return new Promise((resolve, reject) => {
    doc.pipe(writeStream);

    // Fungsi helper untuk membuat header section
    const addSectionHeader = (text) => {
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .text(text, { underline: true })
        .moveDown(0.5);
    };

    // Header surat dengan kop yang formal
    doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .text('SURAT KETERANGAN SAKIT', { align: 'center' })
      .fontSize(12)
      .text(`Nomor: SKS/${new Date().getFullYear()}/${sickLeave._id.toString().substr(-6)}`, {
        align: 'center'
      })
      .moveDown(2);

    // Data Pasien
    addSectionHeader('DATA PASIEN');
    doc.font('Helvetica')
       .fontSize(11)
       .text([
         `Nama Lengkap      : ${sickLeave.username}`,
         `Jenis Kelamin     : ${sickLeave.gender === 'male' ? 'Laki-laki' : 'Perempuan'}`,
         `Usia             : ${sickLeave.age} tahun`,
         `Institusi        : ${sickLeave.institution}`
       ].join('\n'), {
         paragraphGap: 5,
         lineGap: 5
       })
       .moveDown(1.5);

    // Hasil Pemeriksaan
    addSectionHeader('HASIL PEMERIKSAAN');
    doc.font('Helvetica')
       .text('Anamnesis:', { continued: true })
       .text(` ${sickLeave.reason} ${sickLeave.otherReason ? `(${sickLeave.otherReason})` : ''}`)
       .moveDown(0.5);

    // Format analisis dengan bullet points
    const formattedAnalysis = sickLeave.analisis.split('. ')
      .filter(point => point.trim().length > 0)
      .map(point => `• ${point.trim()}${point.endsWith('.') ? '' : '.'}`);

    doc.text('Pemeriksaan Klinis:', { lineGap: 5 })
       .moveDown(0.5);
    
    formattedAnalysis.forEach(point => {
      doc.text(point, {
        indent: 20,
        align: 'justify',
        lineGap: 3
      });
    });
    
    doc.moveDown(1)
       .font('Helvetica-Bold')
       .text('Diagnosis:', { continued: true })
       .font('Helvetica')
       .text(` ${sickLeave.reason}`)
       .moveDown(1.5);

    // Rekomendasi
    addSectionHeader('REKOMENDASI MEDIS');
    doc.font('Helvetica')
       .text(sickLeave.rekomendasi, {
         lineGap: 3,
         align: 'justify'
       })
       .moveDown(1);

    // Catatan Khusus jika ada
    if (sickLeave.catatan && sickLeave.catatan.trim() !== 'Tidak ada catatan tambahan') {
      addSectionHeader('CATATAN KHUSUS');
      doc.font('Helvetica')
         .text(sickLeave.catatan, {
           lineGap: 3,
           align: 'justify'
         })
         .moveDown(1.5);
    }

    // Tanda tangan dan penutup
    const today = new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    doc.moveDown(1)
       .font('Helvetica')
       .text(`Diberikan di Jakarta, ${today}`, { align: 'right' })
       .moveDown(1)
       .text('Dokter Pemeriksa,', { align: 'right' })
       .moveDown(3)
       .font('Helvetica-Bold')
       .text('dr. AI System, Sp.KA', { align: 'right' })
       .font('Helvetica')
       .fontSize(10)
       .text('Nomor SIP: AI/2024/001', { align: 'right' })
       .text('Dokter Spesialis Kecerdasan Artifisial', { align: 'right' });

    // Footer
    doc.fontSize(8)
       .text('Dokumen ini dihasilkan secara digital dan sah tanpa tanda tangan basah', {
         align: 'center',
         color: 'grey'
       });

    doc.end();
    writeStream.on('finish', () => resolve(filePath));
    writeStream.on('error', reject);
  });
}

// Modify generateAndSendPDF to include contact information and additional details in the email prompt
const generateAndSendPDF = async (request, h) => {
  const { id } = request.params;
  const { email, format } = request.query; // Email opsional untuk pengiriman

  try {
    const sickLeave = await SickLeave.findById(id);
    if (!sickLeave) {
      return h.response({ message: "Sick leave not found" }).code(404);
    }

    // Path untuk menyimpan PDF
    const filePath = path.join(
      __dirname,
      `../../temp/surat_izin_sakit_${id}.pdf`
    );

    let analysis; // Define analysis variable

    // Check if PDF already exists
    if (!fs.existsSync(filePath)) {
      // Get or generate analysis
      analysis = await analyzeAnswers(sickLeave);

      // Generate PDF
      await generatePDF(sickLeave, filePath);

      // Generate image once PDF is created
      // Assuming convertPdfToImageHandler handles image generation
    } else {
      analysis = sickLeave.analisis; // Retrieve existing analysis
    }

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

    // Generate personalized email subject and body using Open Router AI
    const prompt = `
Buatkan surat permohonan izin sakit yang formal dengan data berikut:
- Nama: ${sickLeave.username}
- Jabatan/Kelas: ${sickLeave.position}
- Institusi: ${sickLeave.institution}
- Diagnosis: ${sickLeave.reason} ${
      sickLeave.otherReason ? `(${sickLeave.otherReason})` : ""
    }
- Tanggal Izin: ${new Date(sickLeave.date).toLocaleDateString("id-ID")}
- Hasil Pemeriksaan: ${sickLeave.analisis}
- Rekomendasi Medis: ${sickLeave.rekomendasi}
- Catatan Medis: ${sickLeave.catatan}
- Nomor Telepon: ${sickLeave.phoneNumber}
- Email: ${sickLeave.contactEmail}

Buat format JSON dengan struktur berikut:
{
  "subject": "Permohonan Izin Sakit - [Nama] - [Tanggal]",
  "body": "Surat formal dengan format:

  Yth.
  [Pimpinan/Atasan sesuai konteks, contoh: Kepala Departemen IT !!EDIT DENGAN SESUAIKAN KONTEKS SURAT!!]
  [Nama Institusi]
  di Tempat

  Dengan hormat,

  [Paragraf 1: Perkenalan diri dan maksud surat. Contoh: Saya, [Nama], [Jabatan] di [Institusi], dengan ini mengajukan permohonan izin sakit...]
  
  [Paragraf 2: Penjelasan kondisi medis berdasarkan hasil pemeriksaan. Gunakan bahasa yang sopan dan objektif.]
  
  [Paragraf 3: Sebutkan durasi izin dengan jelas dan cantumkan rekomendasi medis. Contoh: Berdasarkan rekomendasi dokter, saya memerlukan istirahat selama...]
  
  [Paragraf 4: Berikan informasi kontak yang jelas untuk komunikasi lebih lanjut.]
  
  [Penutup formal, contoh: Demikian permohonan ini saya sampaikan. Atas perhatian dan kebijaksanaan Bapak/Ibu, saya ucapkan terima kasih.]

  Hormat saya,
  [Nama Lengkap]
  
  Kontak:
  No. Telp: [Nomor Telepon]
  Email: [Email]"
}

Instruksi tambahan:
1. Gunakan bahasa Indonesia yang formal, sopan, dan profesional.
2. Sesuaikan penyebutan pimpinan/atasan dengan konteks institusi (misal: Kepala Sekolah untuk siswa, Manajer untuk karyawan).
3. Jelaskan kondisi medis secara ringkas namun informatif, tanpa mengulangi informasi yang sudah ada di bagian lain surat.
4. Pastikan setiap paragraf memiliki transisi yang baik dan saling terkait.
5. Hindari penggunaan kata-kata yang berlebihan atau terlalu dramatis.
6. Format tanggal dalam bentuk standar Indonesia (contoh: 7 Januari 2025).

Output harus berupa JSON yang valid tanpa teks tambahan di luar struktur JSON.
`;

    const completion = await openai.chat.completions.create({
      model: "google/gemini-pro",
      messages: [
        {
          role: "system",
          content:
            "Anda adalah penulis surat profesional yang akan membuat surat izin sakit formal dalam format JSON. Fokus pada pembuatan narasi yang mengalir dan formal.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    const aiResponse = completion.choices[0].message.content.trim();
    console.log("AI Email Response before sanitization:", aiResponse); // Added logging

    // Sanitize the AI response by removing unwanted control characters
    const sanitizedResponse = aiResponse.replace(/[\u0000-\u001F\u007F]/g, "");
    console.log("AI Email Response after sanitization:", sanitizedResponse); // Added logging

    // Extract JSON from response
    const jsonMatch = sanitizedResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid JSON format in AI email response");
    }

    const jsonStr = jsonMatch[0];
    let emailData;
    try {
      emailData = JSON.parse(jsonStr);
    } catch (e) {
      throw new Error("Failed to parse AI email JSON response");
    }

    // Validate required fields
    if (!emailData.subject || !emailData.body) {
      throw new Error("Missing 'subject' or 'body' in AI email response");
    }

    // Kirim email jika ada alamat email
    if (email) {
      await sendEmailWithAttachment(
        email,
        emailData.subject, // Use dynamic subject
        emailData.body, // Use dynamic body
        {
          filename: "surat_keterangan_sakit.pdf",
          path: filePath,
        }
      );

      return h
        .response({
          message: "PDF generated and sent to email successfully",
          analysis, // Ensure analysis is defined
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
    const filePath = path.join(
      __dirname,
      `../../temp/surat_izin_sakit_${id}.pdf`
    );

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
