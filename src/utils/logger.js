const winston = require('winston');
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(process.cwd(), 'logs');
fs.mkdirSync(LOG_DIR, { recursive: true });

// JSON format for structured logging
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Human-readable format for console
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    if (stack) {
      log += `\n${stack}`;
    }
    return log;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'bingo-game' },
  transports: [
    new winston.transports.Console({
      format: consoleFormat
    }),
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'error.log'), 
      level: 'error',
      format: jsonFormat
    }),
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'combined.log'),
      format: jsonFormat
    })
  ]
});

// Add structured logging helpers
logger.logGameEvent = (event, gameId, data = {}) => {
  logger.info('Game event', {
    ...data,
    event,
    gameId
  });
};

logger.logMetric = (metric, value, tags = {}) => {
  logger.info('Metric', {
    ...tags,
    metric,
    value
  });
};

logger.logError = (error, context = {}) => {
  logger.error('Error occurred', {
    ...context,
    error: error.message,
    stack: error.stack
  });
};

module.exports = logger;
