'use strict';

const express = require('express');
const router  = express.Router();
const { getDb } = require('../db/database');
const logger    = require('../utils/logger');

const START_TIME = Date.now();

// GET /health — full status object
router.get('/', (_req, res) => {
  try {
    const db = getDb();

    const session = db
      .prepare("SELECT * FROM sessions WHERE platform = 'linkedin'")
      .get();

    const stats = {
      total_jobs:       db.prepare('SELECT COUNT(*) as c FROM jobs').get().c,
      new_jobs:         db.prepare("SELECT COUNT(*) as c FROM jobs WHERE status = 'new'").get().c,
      scored_jobs:      db.prepare("SELECT COUNT(*) as c FROM jobs WHERE fit_score IS NOT NULL").get().c,
      applied_jobs:     db.prepare("SELECT COUNT(*) as c FROM jobs WHERE status = 'applied'").get().c,
      pending_approval: db.prepare("SELECT COUNT(*) as c FROM applications WHERE status = 'pending'").get().c,
    };

    res.json({
      status:          'ok',
      timestamp:       new Date().toISOString(),
      uptime_seconds:  Math.floor((Date.now() - START_TIME) / 1000),
      version:         '0.1.0',
      phase:           0,
      database:        { status: 'connected' },
      linkedin_session: {
        status:               session?.status               || 'unknown',
        last_check:           session?.last_check           || null,
        last_healthy:         session?.last_healthy         || null,
        consecutive_failures: session?.consecutive_failures || 0,
      },
      stats,
    });
  } catch (err) {
    logger.error('Health check failed:', err.message);
    res.status(503).json({ status: 'error', error: err.message, timestamp: new Date().toISOString() });
  }
});

// GET /health/ping — lightweight liveness probe
router.get('/ping', (_req, res) => {
  res.json({ pong: true, timestamp: new Date().toISOString() });
});

module.exports = router;
