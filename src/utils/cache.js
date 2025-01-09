const NodeCache = require('node-cache');
const pdfCache = new NodeCache({ stdTTL: 3600, checkperiod: 120 }); // 1 hour TTL

const getCacheKey = (id, type = 'pdf') => `${type}_${id}`;

const cacheManager = {
  get: (key) => pdfCache.get(key),
  set: (key, value, ttl = 3600) => pdfCache.set(key, value, ttl),
  del: (key) => pdfCache.del(key),
  flush: () => pdfCache.flushAll(),
  stats: () => pdfCache.getStats(),
};

module.exports = {
  cacheManager,
  getCacheKey,
};
