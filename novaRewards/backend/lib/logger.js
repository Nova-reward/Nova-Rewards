'use strict';

const { createLogger, format, transports } = require('winston');

const SERVICE_NAME = process.env.SERVICE_NAME || 'nova-rewards-backend';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const baseFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format((info) => {
    info.service = SERVICE_NAME;
    return info;
  })(),
  format.json()
);

const logger = createLogger({
  level: LOG_LEVEL,
  format: baseFormat,
  transports: [new transports.Console()],
});

// Attach CloudWatch transports when configured
if (process.env.CLOUDWATCH_LOG_GROUP && process.env.NODE_ENV !== 'test') {
  try {
    const WinstonCloudWatch = require('winston-cloudwatch');
    const commonCwOpts = {
      logGroupName: process.env.CLOUDWATCH_LOG_GROUP,
      awsRegion: process.env.AWS_REGION || 'us-east-1',
      jsonMessage: true,
      retentionInDays: undefined, // set per-stream below
    };

    // info stream — 30-day retention
    logger.add(
      new WinstonCloudWatch({
        ...commonCwOpts,
        logStreamName: `${SERVICE_NAME}/info`,
        level: 'info',
        retentionInDays: 30,
      })
    );

    // error/warn stream — 90-day retention
    logger.add(
      new WinstonCloudWatch({
        ...commonCwOpts,
        logStreamName: `${SERVICE_NAME}/error`,
        level: 'warn',
        retentionInDays: 90,
      })
    );
  } catch (e) {
    logger.warn('winston-cloudwatch not available; CloudWatch shipping disabled', { error: e.message });
  }
}

module.exports = logger;
