const queue = require("../utils/queue");
const logger = require("../utils/logger");
const { cacheManager, getCacheKey } = require("../utils/cache");
const { sendEmailWithAttachment } = require("../services/sendEmail");
const OpenAI = require("openai");
const fs = require("fs");

// Initialize OpenAI instance
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:5173",
    "X-Title": "Izin Sakit App",
  },
});

// Add a new utility function to send PDF email with generated subject and body
const sendPDFEmailUtility = async (id, email) => {
  try {
    // Verify PDF exists in cache
    const cacheKey = getCacheKey(id);
    const existingPdfPath = cacheManager.get(cacheKey);
    console.log("PDF exists after first send:", fs.existsSync(existingPdfPath));

    // Cek apakah existingPdfPath valid
    if (!existingPdfPath || typeof existingPdfPath !== "string") {
      logger.warn(`PDF not found in cache for ID: ${id}`);
      throw new Error("PDF belum digenerate, silakan generate terlebih dahulu");
    }

    // Pastikan file PDF ada di sistem file
    if (!fs.existsSync(existingPdfPath)) {
      logger.error(`PDF file not found at: ${existingPdfPath}`);
      throw new Error("File PDF tidak ditemukan di server");
    }

    // Retrieve sick leave data
    const SickLeave = require("../models/SickLeave");
    const sickLeave = await SickLeave.findById(id);
    if (!sickLeave) {
      throw new Error("Data izin sakit tidak ditemukan");
    }

    // Update the prompt section with more detailed requirements
    const prompt = `Kamu adalah AI yang menghasilkan JSON valid untuk surat formal izin sakit. PENTING: Hasilkan HANYA JSON yang detail dan formal.

Data:
- Nama: ${sickLeave.username}
- Jabatan/Kelas: ${sickLeave.position}
- Institusi: ${sickLeave.institution}
- Diagnosis: ${sickLeave.reason} ${sickLeave.otherReason ? `(${sickLeave.otherReason})` : ""}
- Tanggal Izin: ${new Date(sickLeave.date).toLocaleDateString("id-ID")}
- Hasil Pemeriksaan: ${sickLeave.analisis}
- Rekomendasi Medis: ${sickLeave.rekomendasi}
- Catatan Medis: ${sickLeave.catatan}
- Nomor Telepon: ${sickLeave.phoneNumber}
- Email: ${sickLeave.contactEmail}

Format JSON yang diharapkan:
{
  "subject": "Permohonan Izin Sakit - [nama] - [tanggal]",
  "emailContent": {
    "recipient": "Pimpinan/Atasan",
    "name": "[nama lengkap]",
    "position": "[jabatan lengkap]",
    "institution": "[institusi lengkap]",
    "mainBody": {
      "paragraph1": "[Paragraf 1: Perkenalan dan tujuan surat - minimal 2 kalimat]",
      "paragraph2": "[Paragraf 2: Penjelasan kondisi sakit dan hasil pemeriksaan - minimal 2 kalimat]",
      "paragraph3": "[Paragraf 3: Durasi izin dan rekomendasi dokter - minimal 2 kalimat]"
    },
    "contactInfo": {
      "phone": "[nomor telepon]",
      "email": "[email]"
    }
  }
}

PENTING:
1. Gunakan bahasa Indonesia formal yang sopan dan profesional
2. Setiap paragraf harus menyatu dan mengalir dengan baik
3. Sertakan informasi konkret tentang durasi izin
4. Hindari penggunaan kata ganti '[Nama]' dll, langsung gunakan data yang diberikan
5. Pastikan tidak ada placeholder yang tersisa dalam konten`;

    const completion = await openai.chat.completions.create({
      model: "meta-llama/llama-3.2-3b-instruct:free",
      messages: [
        {
          role: "system",
          content:
            "Anda adalah penulis surat profesional yang akan membuat surat izin sakit formal dalam format JSON dengan proper line breaks.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.5,
    });

    // Improve error handling for JSON parsing
    try {
      const aiResponse = completion.choices[0]?.message?.content;
      if (!aiResponse) throw new Error("Empty response from AI");

      // Clean and parse JSON
      const cleanedResponse = cleanAIResponse(aiResponse);
      const jsonData = JSON.parse(cleanedResponse);

      // Validate the parsed data structure
      if (!jsonData?.subject || !jsonData?.emailContent) {
        throw new Error("Invalid response structure: missing required fields");
      }

      // Validate and fill missing content with defaults
      jsonData.emailContent = validateEmailContent(jsonData.emailContent, sickLeave);

      const emailData = {
        subject: jsonData.subject,
        body: formatEmailBody(jsonData.emailContent)
      };

      // Send email with generated content
      await sendEmailWithAttachment(email, emailData.subject, emailData.body, {
        filename: "surat_keterangan_sakit.pdf",
        path: existingPdfPath, // <-- Gunakan properti `path`
        contentType: "application/pdf",
      });

      logger.info(`Email sent successfully to ${email} for ID: ${id}`);
    } catch (error) {
      logger.error("Error processing AI response:", error);
      throw new Error(`Failed to process AI response: ${error.message}`);
    }
  } catch (error) {
    logger.error("sendPDFEmailUtility failed:", {
      error: error.message,
      id,
      email,
    });
    throw error;
  }
};

// Update the cleanAIResponse function with more robust cleaning
function cleanAIResponse(response) {
  try {
    // Remove any text before the first {
    const jsonStart = response.indexOf('{');
    const jsonEnd = response.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('No valid JSON structure found');
    }
    
    // Extract only the JSON part
    let cleaned = response.slice(jsonStart, jsonEnd + 1);
    
    // Remove markdown, comments and other non-JSON content
    cleaned = cleaned
      .replace(/```json\s*/g, '')
      .replace(/```\s*$/g, '')
      .replace(/\/\/.*/g, '') // Remove single line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
      .trim();

    // Validate JSON structure
    const parsedJSON = JSON.parse(cleaned);
    return JSON.stringify(parsedJSON); // Normalize JSON format
  } catch (error) {
    throw new Error(`JSON cleaning failed: ${error.message}`);
  }
}

// Add JSON validation function
function validateEmailContent(content, sickLeave) {
  const defaultContent = getDefaultContent(sickLeave);
  
  // Merge with defaults for any missing or undefined values
  Object.keys(defaultContent).forEach(key => {
    if (key === 'contactInfo') {
      content[key] = {
        phone: content[key]?.phone || defaultContent[key].phone,
        email: content[key]?.email || defaultContent[key].email
      };
    } else {
      content[key] = content[key] || defaultContent[key];
    }
  });

  return content;
}

// Update the getDefaultContent function
function getDefaultContent(sickLeave) {
  const date = new Date(sickLeave.date);
  const endDate = new Date(date);
  endDate.setDate(date.getDate() + 3); // Asumsi 3 hari izin jika tidak disebutkan

  return {
    recipient: "Pimpinan/Atasan",
    name: sickLeave.username,
    position: sickLeave.position,
    institution: sickLeave.institution,
    mainBody: {
      paragraph1: `Saya, ${sickLeave.username}, yang berjabatan sebagai ${sickLeave.position} di ${sickLeave.institution}, dengan ini mengajukan permohonan izin sakit. Permohonan ini diajukan karena saya sedang mengalami ${sickLeave.reason}${sickLeave.otherReason ? ` (${sickLeave.otherReason})` : ''} yang membutuhkan perawatan medis.`,
      paragraph2: `Berdasarkan hasil pemeriksaan dokter, ${sickLeave.analisis || 'kondisi kesehatan saya memerlukan istirahat untuk pemulihan optimal'}. ${sickLeave.catatan || 'Saya akan mengikuti semua anjuran medis yang diberikan untuk memastikan pemulihan yang cepat.'}`,
      paragraph3: `Sesuai dengan rekomendasi dokter, ${sickLeave.rekomendasi || 'saya memerlukan waktu istirahat untuk pemulihan'}, terhitung mulai tanggal ${date.toLocaleDateString('id-ID')} hingga ${endDate.toLocaleDateString('id-ID')}. Saya berkomitmen untuk kembali bekerja setelah kondisi kesehatan saya pulih sepenuhnya.`
    },
    contactInfo: {
      phone: sickLeave.phoneNumber,
      email: sickLeave.contactEmail
    }
  };
}

// Update the formatEmailBody function for formal letter formatting
function formatEmailBody(content) {
  const currentDate = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const letterContent = [
    `Kepada Yth.\n${content.recipient}\n${content.institution}`,
    "Dengan hormat,",
    content.mainBody.paragraph1,
    content.mainBody.paragraph2,
    content.mainBody.paragraph3,
    "Untuk informasi lebih lanjut, saya dapat dihubungi melalui:\n" +
    `\nNo. Telepon: ${content.contactInfo.phone}` +
    `\nEmail: ${content.contactInfo.email}`,
    "Demikian permohonan ini saya sampaikan. Atas perhatian dan kebijaksanaan Bapak/Ibu, saya ucapkan terima kasih.",
    `\n${currentDate}\n\nHormat saya,\n\n\n\n${content.name}\n${content.position}\n${content.institution}`
  ];

  return letterContent
    .filter(Boolean)
    .map(paragraph => paragraph.trim())
    .join("\n\n");
}

// Email status check endpoint
const checkEmailStatus = async (request, h) => {
  const { jobId } = request.params;

  try {
    const job = await queue.getJob(jobId);
    if (!job) {
      return h
        .response({
          status: "not_found",
          message: "Job tidak ditemukan",
        })
        .code(404);
    }

    const state = await job.getState();
    const progress = job.progress();

    return h.response({
      status: state,
      progress,
      message: getStatusMessage(state),
    });
  } catch (error) {
    logger.error("Error checking email status:", error);
    return h
      .response({
        status: "error",
        message: "Gagal memeriksa status email",
      })
      .code(500);
  }
};

function getStatusMessage(state) {
  const messages = {
    completed: "Email berhasil dikirim",
    failed: "Pengiriman email gagal",
    active: "Email sedang dikirim",
    waiting: "Email dalam antrian",
    delayed: "Pengiriman email ditunda",
    paused: "Pengiriman email dijeda",
  };
  return messages[state] || "Status tidak diketahui";
}

module.exports = {
  checkEmailStatus,
  sendPDFEmailUtility,
};
