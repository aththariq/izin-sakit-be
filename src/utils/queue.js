const Queue = require("bull");
const logger = require("./logger");

// Update the require path to point to the handlers directory
const { sendEmailWithAttachment } = require("../handlers/sendEmail");

const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
};

const defaultQueue = new Queue("default", {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
});

// Initialize the email queue
// Tambahkan timeout yang lebih lama untuk proses email
const emailQueue = new Queue("sendEmail", {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    timeout: 600000, // 10 menit
  },
});

// Tambahkan monitoring lebih detail
emailQueue.on("active", (job) => {
  logger.info(`Processing job ${job.id}`);
});

emailQueue.on("stalled", (job) => {
  logger.warn(`Job ${job.id} has stalled`);
});

emailQueue.on("progress", (job, progress) => {
  logger.info(`Job ${job.id} is ${progress}% complete`);
});

module.exports = emailQueue;
