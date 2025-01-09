const NodeCache = require('node-cache');
const aiCache = new NodeCache({ stdTTL: 86400 }); // 24 hours

const getAICacheKey = (input) => {
  return `ai_${Buffer.from(input).toString('base64')}`;
};

const aiCacheManager = {
  get: (input) => aiCache.get(getAICacheKey(input)),
  set: (input, result) => aiCache.set(getAICacheKey(input), result),
  del: (input) => aiCache.del(getAICacheKey(input))
};

module.exports = aiCacheManager;
