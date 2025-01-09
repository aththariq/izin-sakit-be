const queue = require('../utils/queue');
const logger = require('../utils/logger');
const { cacheManager, getCacheKey } = require('../utils/cache');
const { sendEmailWithAttachment } = require('./sendEmail');

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
      pdfPath
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
  checkEmailStatus
};
