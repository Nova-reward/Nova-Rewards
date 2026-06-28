'use strict';

const { AsyncLocalStorage } = require('async_hooks');
const { createLogger, format, transports } = require('winston');

// Per-request store: { correlationId: string }
const asyncLocalStorage = new AsyncLocalStorage();

// Patterns for PII/sensitive data redaction
const REDACT_PATTERNS = [
  // JWT tokens (Bearer + raw)
  { pattern: /Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]*/gi, replacement: 'Bearer [REDACTED]' },
  { pattern: /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]*/g, replacement: '[JWT_REDACTED]' },
  // Passwords in JSON bodies / query strings
  { pattern: /"password"\s*:\s*"[^"]*"/gi, replacement: '"password":"[REDACTED]"' },
  { pattern: /password=[^&\s]*/gi, replacement: 'password=[REDACTED]' },
  // Stellar secret keys (S... 56-char base32)
  { pattern: /S[A-Z2-7]{55}/g, replacement: '[STELLAR_SECRET_REDACTED]' },
  // AWS secret keys
  { pattern: /(?:AWS_SECRET_ACCESS_KEY|aws_secret_access_key)[=:\s]+\S+/gi, replacement: '[AWS_SECRET_REDACTED]' },
  // Generic secret/token/key fields
  { pattern: /"(?:secret|token|apiKey|api_key|privateKey|private_key)"\s*:\s*"[^"]*"/gi, replacement: (m) => m.replace(/"[^"]*"$/, '"[REDACTED]"') },
  // Email addresses
  { pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL_REDACTED]' },
];

function redact(value) {
  if (typeof value !== 'string') return value;
  return REDACT_PATTERNS.reduce((s, { pattern, replacement }) => s.replace(pattern, replacement), value);
}

const redactFormat = format((info) => {
  info.message = redact(String(info.message ?? ''));
  if (info.stack) info.stack = redact(info.stack);
  return info;
});

// Pulls correlationId from AsyncLocalStorage and stamps it on every log entry.
const correlationFormat = format((info) => {
  const store = asyncLocalStorage.getStore();
  if (store?.correlationId && !info.correlationId) {
    info.correlationId = store.correlationId;
  }
  return info;
});

const baseFormats = [
  format.timestamp(),
  correlationFormat(),
  redactFormat(),
  format.errors({ stack: true }),
];

const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

const loggerTransports = [
  new transports.Console({
    format: isProduction
      ? format.combine(...baseFormats, format.json())
      : format.combine(...baseFormats, format.colorize(), format.simple()),
  }),
];

// Add CloudWatch transport only when credentials + group are configured
if (process.env.CLOUDWATCH_LOG_GROUP) {
  try {
    const WinstonCloudWatch = require('winston-cloudwatch');
    const awsRegion = process.env.AWS_REGION || 'us-east-1';
    const environment = process.env.NODE_ENV || 'development';

    loggerTransports.push(
      new WinstonCloudWatch({
        logGroupName: process.env.CLOUDWATCH_LOG_GROUP,
        logStreamName: `backend/${environment}/{hostname}`,
        awsRegion,
        jsonValueFormatter: (v) => redact(JSON.stringify(v)),
        messageFormatter: ({ level, message, timestamp, correlationId, ...meta }) => {
          const cid = correlationId ? ` [${correlationId}]` : '';
          const metaStr = Object.keys(meta).length ? ' ' + redact(JSON.stringify(meta)) : '';
          return `[${timestamp}]${cid} ${level.toUpperCase()}: ${message}${metaStr}`;
        },
        retentionInDays: 90,
        uploadRate: 2000,
        errorHandler: (err) => {
          process.stderr.write(`[winston-cloudwatch] ${err.message}\n`);
        },
      })
    );
  } catch (e) {
    process.stderr.write(`[logger] winston-cloudwatch not available: ${e.message}\n`);
  }
}

const logger = createLogger({
  level: logLevel,
  defaultMeta: {
    service: 'nova-rewards-backend',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: loggerTransports,
});

// Returns the singleton logger (used by tracingMiddleware and other callers).
function getLogger() {
  return logger;
}

module.exports = logger;
module.exports.asyncLocalStorage = asyncLocalStorage;
module.exports.getLogger = getLogger;
