const ApiKey = require('../models/apiKey');

const validateApiKey = async (request, h) => {
  const apiKey = request.headers['x-api-key'];
  
  if (!apiKey) {
    return h.continue;
  }

  const key = await ApiKey.findOne({ key: apiKey, isActive: true });
  if (!key) {
    return h.response({ message: 'Invalid API key' }).code(401).takeover();
  }

  // Update last used timestamp
  key.lastUsed = new Date();
  await key.save();

  return h.continue;
};

module.exports = validateApiKey;
