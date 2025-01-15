const NodeCache = require("node-cache");
const pdfCache = new NodeCache({ stdTTL: 3600, checkperiod: 120 }); // 1 hour TTL

const getCacheKey = (id, type = "pdf") => `${type}_${id}`;

const cacheManager = {
  get: (key) => {
    try {
      const value = pdfCache.get(key);
      if (value === undefined) {
        console.log(`Cache miss for key: ${key}`);
      } else {
        console.log(`Cache hit for key: ${key}`);
      }
      return value;
    } catch (error) {
      console.error("Cache get error:", error);
      return null;
    }
  },

  set: (key, value, ttl = 3600) => {
    if (!key || !value) {
      throw new Error("Key and value are required");
    }
    if (typeof ttl !== "number" || ttl < 0) {
      throw new Error("TTL must be a positive number");
    }
    console.log(`Setting cache for key: ${key} with TTL: ${ttl}`);
    return pdfCache.set(key, value, ttl);
  },

  del: (key) => {
    try {
      console.log(`Deleting cache for key: ${key}`);
      return pdfCache.del(key);
    } catch (error) {
      console.error("Cache delete error:", error);
      return false;
    }
  },

  flush: () => {
    console.log("Flushing all cache");
    return pdfCache.flushAll();
  },

  stats: () => {
    const stats = pdfCache.getStats();
    console.log("Cache stats:", stats);
    return stats;
  },
};

module.exports = {
  cacheManager,
  getCacheKey,
};
