const queue = require('../utils/queue');
const logger = require('../utils/logger');
const { cacheManager, getCacheKey } = require('../utils/cache');
const { sendEmailWithAttachment } = require('./sendEmail');
const OpenAI = require("openai"); // Import OpenAI

// Initialize OpenAI instance
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:5173",
    "X-Title": "Izin Sakit App",
  },
});

const sendPDFEmail = async (request, h) => {
  const { id } = request.params;
  const { email } = request.payload;

  try {
    // Verify PDF exists
    const cacheKey = getCacheKey(id);
    const pdfPath = cacheManager.get(cacheKey);
    
    if (!pdfPath) {
      logger.warn(`PDF not found in cache for ID: ${id}`);
      return h.response({
        status: 'error',
        message: 'PDF belum digenerate, silakan generate terlebih dahulu'
      }).code(400);
    }

    // Queue email sending job
    const job = await queue.add('sendEmail', {
      id,
      email,
      subject: 'Surat Keterangan Sakit', // Add subject dynamically if needed
      text: 'Silakan lihat lampiran untuk surat keterangan sakit Anda.',
      attachment: {
        filename: "surat_keterangan_sakit.pdf",
        path: pdfPath
      }
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      timeout: 300000 // 5 minutes
    });

    logger.info(`Email job queued for ${id} to ${email}, job ID: ${job.id}`);

    return h.response({
      status: 'queued',
      jobId: job.id,
      message: 'Email sedang dalam proses pengiriman'
    }).code(202);

  } catch (error) {
    logger.error('Email queuing failed:', {
      error: error.message,
      id,
      email
    });

    return h.response({
      status: 'error',
      message: 'Gagal mengirim email',
      error: error.message
    }).code(500);
  }
};

// Add a new utility function to send PDF email with generated subject and body
const sendPDFEmailUtility = async (id, email, pdfPath) => {
  try {
    // Verify PDF exists in cache
    const cacheKey = getCacheKey(id);
    const existingPdfPath = cacheManager.get(cacheKey);
    
    if (!existingPdfPath) {
      logger.warn(`PDF not found in cache for ID: ${id}`);
      throw new Error('PDF belum digenerate, silakan generate terlebih dahulu');
    }

    // Retrieve sick leave data
    const SickLeave = require("../models/SickLeave"); // Import SickLeave model
    const sickLeave = await SickLeave.findById(id);
    if (!sickLeave) {
      throw new Error('Data izin sakit tidak ditemukan');
    }

    // Generate email subject and body using OpenAI
    const prompt = `
Buatkan surat permohonan izin sakit yang formal dengan data berikut:
- Nama: ${sickLeave.username}
- Jabatan/Kelas: ${sickLeave.position}
- Institusi: ${sickLeave.institution}
- Diagnosis: ${sickLeave.reason} ${sickLeave.otherReason ? '(${sickLeave.otherReason})' : ""}
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
  [Pimpinan/Atasan sesuai konteks, contoh: Kepala Departemen IT ((ini perintah: !!EDIT DENGAN SESUAIKAN KONTEKS SURAT!!))]
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
      model: "google/gemini-2.0-flash-thinking-exp:free",
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

    // Add error checking for completion response
    if (!completion || !completion.choices || completion.choices.length === 0) {
      logger.error('Invalid AI response structure:', completion);
      throw new Error('Failed to get valid response from AI');
    }

    const aiResponse = completion.choices[0]?.message?.content;
    if (!aiResponse) {
      logger.error('No content in AI response');
      throw new Error('Empty response from AI');
    }

    const sanitizedResponse = aiResponse.trim().replace(/[\u0000-\u001F\u007F]/g, "");
    logger.debug("AI Email Response after sanitization:", sanitizedResponse);

    // Improved JSON extraction
    let jsonData;
    try {
      // First try direct parse
      jsonData = JSON.parse(sanitizedResponse);
    } catch (e) {
      // If direct parse fails, try to extract JSON
      const jsonMatch = sanitizedResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Could not find valid JSON in AI response");
      }
      jsonData = JSON.parse(jsonMatch[0]);
    }

    // Validate the parsed data
    if (!jsonData || typeof jsonData !== 'object') {
      throw new Error('Invalid JSON structure in AI response');
    }

    // Use fallback values if needed
    const emailData = {
      subject: jsonData.subject || `Surat Keterangan Sakit - ${sickLeave.username}`,
      body: jsonData.body || 'Terlampir surat keterangan sakit.'
    };

    // Send email with generated content
    await sendEmailWithAttachment(
      email,
      emailData.subject,
      emailData.body,
      {
        filename: "surat_keterangan_sakit.pdf",
        path: existingPdfPath,
      }
    );

    logger.info(`Email sent successfully to ${email} for ID: ${id}`);

  } catch (error) {
    logger.error('sendPDFEmailUtility failed:', {
      error: error.message,
      id,
      email
    });
    throw error;
  }
}; // Added missing closing brace

// Email status check endpoint
const checkEmailStatus = async (request, h) => {
  const { jobId } = request.params;

  try {
    const job = await queue.getJob(jobId);
    if (!job) {
      return h.response({
        status: 'not_found',
        message: 'Job tidak ditemukan'
      }).code(404);
    }

    const state = await job.getState();
    const progress = job.progress();

    return h.response({
      status: state,
      progress,
      message: getStatusMessage(state)
    });

  } catch (error) {
    logger.error('Error checking email status:', error);
    return h.response({
      status: 'error',
      message: 'Gagal memeriksa status email'
    }).code(500);
  }
};

function getStatusMessage(state) {
  const messages = {
    'completed': 'Email berhasil dikirim',
    'failed': 'Pengiriman email gagal',
    'active': 'Email sedang dikirim',
    'waiting': 'Email dalam antrian',
    'delayed': 'Pengiriman email ditunda',
    'paused': 'Pengiriman email dijeda'
  };
  return messages[state] || 'Status tidak diketahui';
}

module.exports = {
  sendPDFEmail,
  checkEmailStatus,
  sendPDFEmailUtility // Export the new utility function
};
