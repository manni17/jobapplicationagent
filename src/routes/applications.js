'use strict';

const express             = require('express');
const router              = express.Router();
const { getDb, logEvent } = require('../db/database');
const logger              = require('../utils/logger');

// GET /api/applications
router.get('/', (req, res) => {
  try {
    const { status, limit = 20, offset = 0 } = req.query;
    let query  = `
      SELECT a.*, j.title, j.company, j.canonical_url, j.fit_score
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      WHERE 1=1
    `;
    const args = [];

    if (status) { query += ' AND a.status = ?'; args.push(status); }
    query += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
    args.push(parseInt(limit, 10), parseInt(offset, 10));

    res.json(getDb().prepare(query).all(...args));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/applications/:id
router.get('/:id', (req, res) => {
  try {
    const row = getDb()
      .prepare('SELECT a.*, j.title, j.company FROM applications a JOIN jobs j ON a.job_id = j.id WHERE a.id = ?')
      .get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Application not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/applications — create (one per job, enforced by UNIQUE)
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { job_id, resume_path, cover_letter_path } = req.body;
    if (!job_id) return res.status(400).json({ error: 'job_id is required' });

    // Guard against duplicate applications (quality gate: zero duplicate submits)
    const existing = db.prepare('SELECT id FROM applications WHERE job_id = ?').get(job_id);
    if (existing) {
      return res.status(409).json({ error: 'Application already exists for this job', id: existing.id });
    }

    const result = db.prepare(
      'INSERT INTO applications (job_id, resume_path, cover_letter_path) VALUES (?, ?, ?)'
    ).run(job_id, resume_path || null, cover_letter_path || null);

    logEvent(job_id, 'application_created', { application_id: result.lastInsertRowid });
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    logger.error('POST /api/applications:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/applications/:id — update status, evidence, approval
router.patch('/:id', (req, res) => {
  try {
    const db  = getDb();
    const app = db.prepare('SELECT id, job_id FROM applications WHERE id = ?').get(req.params.id);
    if (!app) return res.status(404).json({ error: 'Application not found' });

    const { status, screenshot_path, confirmation_text, error_text, approved_by } = req.body;
    const setClauses = ["updated_at = datetime('now')"];
    const args       = [];

    if (status !== undefined) {
      setClauses.push('status = ?');
      args.push(status);
      if (status === 'submitted') setClauses.push("submitted_at = datetime('now')");
      setClauses.push('attempt_count = attempt_count + 1');
    }
    if (screenshot_path    !== undefined) { setClauses.push('screenshot_path = ?');    args.push(screenshot_path); }
    if (confirmation_text  !== undefined) { setClauses.push('confirmation_text = ?');  args.push(confirmation_text); }
    if (error_text         !== undefined) { setClauses.push('error_text = ?');         args.push(error_text); }
    if (approved_by        !== undefined) { setClauses.push('approved_by = ?');        args.push(approved_by); }

    args.push(req.params.id);
    db.prepare(`UPDATE applications SET ${setClauses.join(', ')} WHERE id = ?`).run(...args);

    logEvent(app.job_id, 'application_updated', { status, application_id: parseInt(req.params.id, 10) });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
