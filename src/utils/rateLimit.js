const AsyncLock = require('async-lock');
const lock = new AsyncLock();
const requestQueue = new Map();

const rateLimiter = {
  maxConcurrent: 5,
  waitTimeout: 30000,
  
  async acquire(key) {
    return lock.acquire(key, async () => {
      const currentRequests = requestQueue.get(key) || 0;
      if (currentRequests >= this.maxConcurrent) {
        throw new Error('Rate limit exceeded');
      }
      requestQueue.set(key, currentRequests + 1);
      return true;
    }, { timeout: this.waitTimeout });
  },

  release(key) {
    const current = requestQueue.get(key) || 1;
    requestQueue.set(key, Math.max(0, current - 1));
  }
};

module.exports = rateLimiter;
