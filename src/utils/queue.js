const Queue = require('bull');
const Redis = require('ioredis');
const logger = require('./logger');

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
};

const defaultQueue = new Queue('default', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
});

defaultQueue.on('failed', (job, err) => {
  logger.error(`Job ${job.id} failed:`, err);
});

defaultQueue.on('completed', (job) => {
  logger.info(`Job ${job.id} completed`);
});

module.exports = defaultQueue;
