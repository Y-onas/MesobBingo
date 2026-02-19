const winston = require('winston');
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(process.cwd(), 'logs');
fs.mkdirSync(LOG_DIR, { recursive: true });

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack }) => {
      if (stack) {
        return `${timestamp} [${level.toUpperCase()}]: ${message}\n${stack}`;
      }
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'combined.log') 
    })
  ]
});

module.exports = logger;
