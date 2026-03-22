'use strict';

require('dotenv').config();

const express = require('express');
const { initDatabase }      = require('./db/database');
const healthRouter          = require('./routes/health');
const jobsRouter            = require('./routes/jobs');
const sessionsRouter        = require('./routes/sessions');
const applicationsRouter    = require('./routes/applications');
const eventsRouter          = require('./routes/events');
const { startTelegramBot }  = require('./services/telegram');
const logger                = require('./utils/logger');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use((req, _res, next) => { logger.debug(`${req.method} ${req.path}`); next(); });

// ── Routes ────────────────────────────────────────────────────
app.use('/health',            healthRouter);
app.use('/api/jobs',          jobsRouter);
app.use('/api/sessions',      sessionsRouter);
app.use('/api/applications',  applicationsRouter);
app.use('/api/events',        eventsRouter);

// 404
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Global error handler
app.use((err, _req, res, _next) => {
  logger.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Boot ──────────────────────────────────────────────────────
async function main() {
  try {
    initDatabase();
    logger.info('Database initialized');

    const server = app.listen(PORT, () => {
      logger.info(`API server listening on http://localhost:${PORT}`);
      logger.info(`Health: http://localhost:${PORT}/health`);
    });

    // Start Telegram bot only in polling mode (not when n8n owns the webhook)
    const telegramMode = (process.env.TELEGRAM_MODE || 'polling').toLowerCase();
    if (process.env.TELEGRAM_BOT_TOKEN && telegramMode === 'polling') {
      startTelegramBot();
    } else if (!process.env.TELEGRAM_BOT_TOKEN) {
      logger.warn('TELEGRAM_BOT_TOKEN not set — Telegram bot disabled');
    } else {
      logger.info('TELEGRAM_MODE=n8n — Telegram polling skipped (n8n handles it)');
    }

    // Graceful shutdown
    const shutdown = () => {
      logger.info('Shutting down gracefully...');
      server.close(() => process.exit(0));
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT',  shutdown);

  } catch (err) {
    logger.error('Fatal startup error:', err.message);
    process.exit(1);
  }
}

main();
