'use strict';

// node:sqlite is built-in from Node 22.10+ (unflagged in Node 23+/24+). No npm package needed.
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs   = require('fs');
const logger = require('../utils/logger');

let db;

function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

function initDatabase() {
  const dbPath = process.env.DB_PATH || './data/jobs.db';
  const dbDir  = path.dirname(path.resolve(dbPath));

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new DatabaseSync(path.resolve(dbPath));

  // Performance and safety pragmas
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec('PRAGMA temp_store = MEMORY');

  // Apply schema (idempotent — all statements use IF NOT EXISTS / INSERT OR IGNORE)
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);

  logger.info(`Database ready at ${path.resolve(dbPath)}`);
  return db;
}

function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Append an immutable event row.
 * @param {number|null} jobId
 * @param {string} eventType
 * @param {object} payload
 */
function logEvent(jobId, eventType, payload = {}) {
  getDb()
    .prepare('INSERT INTO events (job_id, event_type, payload) VALUES (?, ?, ?)')
    .run(jobId || null, eventType, JSON.stringify(payload));
}

module.exports = { initDatabase, getDb, closeDatabase, logEvent };
