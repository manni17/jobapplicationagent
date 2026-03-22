'use strict';

const express   = require('express');
const router    = express.Router();
const { getDb } = require('../db/database');

// GET /api/events
router.get('/', (req, res) => {
  try {
    const { job_id, event_type, limit = 50, offset = 0 } = req.query;
    let query  = 'SELECT * FROM events WHERE 1=1';
    const args = [];

    if (job_id)     { query += ' AND job_id = ?';     args.push(job_id); }
    if (event_type) { query += ' AND event_type = ?'; args.push(event_type); }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    args.push(parseInt(limit, 10), parseInt(offset, 10));

    res.json(getDb().prepare(query).all(...args));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/events — external systems can log events
router.post('/', (req, res) => {
  try {
    const { job_id, event_type, payload } = req.body;
    if (!event_type) return res.status(400).json({ error: 'event_type is required' });

    const result = getDb()
      .prepare('INSERT INTO events (job_id, event_type, payload) VALUES (?, ?, ?)')
      .run(job_id || null, event_type, JSON.stringify(payload || {}));

    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
