const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");

const downloadHandler = async (request, h) => {
  const { type, id } = request.params;

  try {
    // Tentukan path file berdasarkan type (pdf atau image)
    const filePath = path.join(
      __dirname,
      `../temp/${
        type === "pdf" ? `surat_izin_sakit_${id}.pdf` : `preview_${id}.png`
      }`
    );

    // Cek apakah file ada
    if (!fs.existsSync(filePath)) {
      return h.response({ message: "File not found" }).code(404);
    }

    // Tentukan mode dan nama file berdasarkan type
    const mode = type === "pdf" ? "attachment" : "inline"; // Gunakan "inline" untuk gambar
    const filename =
      type === "pdf" ? "Surat_Izin_Sakit.pdf" : "Surat_Izin_Sakit.png";

    // Kembalikan file sebagai respons
    return h.file(filePath, {
      mode, // Mode "inline" untuk gambar, "attachment" untuk PDF
      filename, // Nama file yang akan diunduh
      headers: {
        "Content-Type": type === "pdf" ? "application/pdf" : "image/png",
        "Cache-Control": "public, max-age=3600", // Cache untuk optimasi
      },
    });
  } catch (error) {
    logger.error("Failed to download file:", error);
    return h
      .response({
        message: "Error downloading file",
        error: error.message,
      })
      .code(500);
  }
};

module.exports = { downloadHandler };