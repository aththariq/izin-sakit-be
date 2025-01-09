const { cacheManager, getCacheKey } = require('../utils/cache');
const aiCacheManager = require('../utils/aiCache');
const queue = require('../utils/queue');
const logger = require('../utils/logger');

const generatePDF = async (request, h) => {
  const { id } = request.params;
  const startTime = performance.now();
  
  try {
    // Check PDF cache
    const cacheKey = getCacheKey(id);
    let pdfPath = cacheManager.get(cacheKey);
    
    if (pdfPath) {
      logger.info(`Cache hit for PDF ${id}`);
      return h.response({ 
        status: 'success',
        path: pdfPath,
        cached: true 
      });
    }

    // Queue PDF generation job
    const job = await queue.add('generatePDF', { id }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    });

    return h.response({
      status: 'queued',
      jobId: job.id,
      message: 'PDF generation in progress'
    }).code(202);

  } catch (error) {
    logger.error('PDF generation failed:', error);
    return h.response({
      status: 'error',
      message: error.message
    }).code(500);
  }
};

module.exports = { generatePDF };
