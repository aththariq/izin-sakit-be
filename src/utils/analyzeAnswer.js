const OpenAI = require("openai");
const logger = require("../utils/logger");

// Inisialisasi OpenAI dengan baseURL OpenRouter
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1", // Mengarahkan ke OpenRouter
  apiKey: process.env.OPENROUTER_API_KEY, // Pastikan API key OpenRouter sudah diatur di environment variables
  defaultHeaders: {
    "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:5173", // Referer header untuk OpenRouter
    "X-Title": "Izin Sakit App", // Judul aplikasi untuk OpenRouter
  },
});

async function analyzeAnswers(sickLeave) {
  try {
    // Jika analisis sudah ada, kembalikan data yang ada
    if (sickLeave.analisis && sickLeave.rekomendasi) {
      return {
        analisis: sickLeave.analisis,
        rekomendasi: sickLeave.rekomendasi,
        catatan: sickLeave.catatan || "Tidak ada catatan tambahan",
      };
    }

    // Format jawaban untuk analisis
    const answersFormatted =
      sickLeave.answers
        ?.map((a) => `${a.questionId}: ${a.answer}`)
        .join("\n") || "Tidak ada jawaban tambahan";

    logger.info("Processing analysis for:", {
      reason: sickLeave.reason,
      age: sickLeave.age,
      gender: sickLeave.gender,
      hasAnswers: !!sickLeave.answers?.length,
    });

    // Prompt untuk AI
    const prompt = `
Berikan analisis medis profesional untuk pasien dengan data berikut:

INFORMASI PASIEN
Keluhan Utama: ${sickLeave.reason}
${sickLeave.otherReason ? `Keluhan Tambahan: ${sickLeave.otherReason}` : ""}
Usia: ${sickLeave.age} tahun
Jenis Kelamin: ${sickLeave.gender === "male" ? "Laki-laki" : "Perempuan"}

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

    logger.debug("Sending AI prompt:", { prompt });

    // Menggunakan OpenAI dengan model dari OpenRouter
    const completion = await openai.chat.completions.create({
      model: "meta-llama/llama-3.2-3b-instruct:free", // Model dari OpenRouter
      messages: [
        {
          role: "system",
          content:
            "Anda adalah dokter yang memberikan analisis medis profesional dalam format JSON yang valid dan terstruktur.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    logger.debug(
      "Raw AI response:",
      completion?.choices?.[0]?.message?.content
    );

    // Validasi respons AI
    if (!completion?.choices?.[0]?.message?.content) {
      throw new Error("Empty response from AI service");
    }

    const rawResponse = completion.choices[0].message.content.trim();

    // Parsing respons AI
    let analysisData;
    try {
      analysisData = JSON.parse(rawResponse);
    } catch (firstError) {
      logger.debug("First parse attempt failed, trying to extract JSON", {
        rawResponse,
      });

      // Coba ekstrak JSON dari respons
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.error("Could not find JSON pattern in response", {
          rawResponse,
        });
        throw new Error("Invalid response format from AI service");
      }

      try {
        analysisData = JSON.parse(jsonMatch[0]);
      } catch (secondError) {
        logger.error("All parsing attempts failed", {
          rawResponse,
          firstError,
          secondError,
        });
        throw new Error("Failed to parse AI response");
      }
    }

    // Validasi struktur respons
    if (!analysisData?.analisis || !analysisData?.rekomendasi) {
      logger.error("Invalid response structure", { analysisData });
      throw new Error("Invalid analysis data structure");
    }

    // Simpan hasil analisis ke database
    sickLeave.analisis = analysisData.analisis;
    sickLeave.rekomendasi = analysisData.rekomendasi;
    sickLeave.catatan = analysisData.catatan || "Tidak ada catatan tambahan";

    await sickLeave.save();
    logger.info("Successfully saved analysis");

    return {
      analisis: sickLeave.analisis,
      rekomendasi: sickLeave.rekomendasi,
      catatan: sickLeave.catatan,
    };
  } catch (error) {
    logger.error("Analysis generation error:", {
      error: error.message,
      sickLeaveId: sickLeave._id,
      reason: sickLeave.reason,
    });

    // Fallback jika terjadi error
    const fallbackAnalysis = {
      analisis:
        `Pasien ${sickLeave.username} (${
          sickLeave.age
        } tahun) melaporkan ${sickLeave.reason.toLowerCase()}` +
        (sickLeave.answers?.length
          ? ` yang telah berlangsung selama ${sickLeave.answers[0].answer}.`
          : ".") +
        " Berdasarkan keluhan yang dilaporkan, diperlukan istirahat untuk pemulihan optimal.",
      rekomendasi: `Direkomendasikan untuk istirahat selama 1-2 hari dan menghindari aktivitas yang memberatkan.`,
      catatan: `Harap segera konsultasi dengan dokter jika keluhan memberat atau tidak membaik dalam 48 jam.`,
    };

    Object.assign(sickLeave, fallbackAnalysis);
    await sickLeave.save();
    logger.info("Using fallback analysis");

    return fallbackAnalysis;
  }
}

module.exports = { analyzeAnswers };
