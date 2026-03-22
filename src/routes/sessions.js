'use strict';

const express             = require('express');
const router              = express.Router();
const { getDb, logEvent } = require('../db/database');

// GET /api/sessions
router.get('/', (_req, res) => {
  try {
    res.json(getDb().prepare('SELECT * FROM sessions').all());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/:platform
router.get('/:platform', (req, res) => {
  try {
    const row = getDb().prepare('SELECT * FROM sessions WHERE platform = ?').get(req.params.platform);
    if (!row) return res.status(404).json({ error: 'Session not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/sessions/:platform — update session state
router.patch('/:platform', (req, res) => {
  try {
    const db = getDb();
    const { platform } = req.params;

    const row = db.prepare('SELECT id FROM sessions WHERE platform = ?').get(platform);
    if (!row) return res.status(404).json({ error: 'Session not found' });

    const { status, consecutive_failures, user_agent, profile_path, notes } = req.body;
    const setClauses = ["updated_at = datetime('now')", "last_check = datetime('now')"];
    const args       = [];

    if (status !== undefined) {
      setClauses.push('status = ?');
      args.push(status);
      if (status === 'healthy') {
        setClauses.push("last_healthy = datetime('now')");
        setClauses.push('consecutive_failures = 0');
      }
    }
    if (consecutive_failures !== undefined) { setClauses.push('consecutive_failures = ?'); args.push(consecutive_failures); }
    if (user_agent           !== undefined) { setClauses.push('user_agent = ?');           args.push(user_agent); }
    if (profile_path         !== undefined) { setClauses.push('profile_path = ?');         args.push(profile_path); }
    if (notes                !== undefined) { setClauses.push('notes = ?');                args.push(notes); }

    args.push(platform);
    db.prepare(`UPDATE sessions SET ${setClauses.join(', ')} WHERE platform = ?`).run(...args);

    logEvent(null, 'session_updated', { platform, status });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
