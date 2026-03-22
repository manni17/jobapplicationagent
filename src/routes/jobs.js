'use strict';

const express         = require('express');
const router          = express.Router();
const { getDb, logEvent } = require('../db/database');
const logger          = require('../utils/logger');

// GET /api/jobs — list with optional filters
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { status, min_score, limit = 20, offset = 0 } = req.query;

    let query  = 'SELECT * FROM jobs WHERE 1=1';
    const args = [];

    if (status) {
      query += ' AND status = ?';
      args.push(status);
    }
    if (min_score !== undefined) {
      query += ' AND fit_score >= ?';
      args.push(parseFloat(min_score));
    }

    query += ' ORDER BY fit_score DESC, created_at DESC LIMIT ? OFFSET ?';
    args.push(parseInt(limit, 10), parseInt(offset, 10));

    const jobs  = db.prepare(query).all(...args);
    const total = db.prepare('SELECT COUNT(*) as c FROM jobs').get().c;

    res.json({ jobs, total, limit: parseInt(limit, 10), offset: parseInt(offset, 10) });
  } catch (err) {
    logger.error('GET /api/jobs:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jobs/:id
router.get('/:id', (req, res) => {
  try {
    const job = getDb().prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/jobs — upsert by canonical_url (dedup)
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const {
      canonical_url, title, company, location, remote,
      description, requirements, salary_range, posted_at, source,
    } = req.body;

    if (!canonical_url) return res.status(400).json({ error: 'canonical_url is required' });

    // Dedup check — return 200 if already known
    const existing = db.prepare('SELECT id FROM jobs WHERE canonical_url = ?').get(canonical_url);
    if (existing) {
      return res.status(200).json({ id: existing.id, created: false, message: 'Duplicate — job already exists' });
    }

    const result = db.prepare(`
      INSERT INTO jobs
        (canonical_url, title, company, location, remote, description, requirements, salary_range, posted_at, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      canonical_url,
      title        || '',
      company      || '',
      location     || '',
      remote ? 1 : 0,
      description  || '',
      requirements || '',
      salary_range || '',
      posted_at    || null,
      source       || 'linkedin',
    );

    logEvent(result.lastInsertRowid, 'job_discovered', { source, title, company });

    res.status(201).json({ id: result.lastInsertRowid, created: true });
  } catch (err) {
    logger.error('POST /api/jobs:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/jobs/:id — update score / status
router.patch('/:id', (req, res) => {
  try {
    const db = getDb();
    const job = db.prepare('SELECT id FROM jobs WHERE id = ?').get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const { status, fit_score, rationale, missing_skills } = req.body;
    const setClauses = ["updated_at = datetime('now')"];
    const args       = [];

    if (status        !== undefined) { setClauses.push('status = ?');         args.push(status); }
    if (fit_score     !== undefined) { setClauses.push('fit_score = ?');       args.push(fit_score); }
    if (rationale     !== undefined) { setClauses.push('rationale = ?');       args.push(rationale); }
    if (missing_skills !== undefined) {
      setClauses.push('missing_skills = ?');
      args.push(Array.isArray(missing_skills) ? JSON.stringify(missing_skills) : missing_skills);
    }

    if (args.length === 0) return res.status(400).json({ error: 'No updatable fields provided' });

    args.push(req.params.id);
    db.prepare(`UPDATE jobs SET ${setClauses.join(', ')} WHERE id = ?`).run(...args);

    if (status) logEvent(req.params.id, 'status_changed', { status });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
