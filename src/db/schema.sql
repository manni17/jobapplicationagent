-- ============================================================
-- Job Application Agent — SQLite Schema
-- ============================================================

-- Jobs discovered from LinkedIn (or other sources)
CREATE TABLE IF NOT EXISTS jobs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  canonical_url   TEXT    UNIQUE NOT NULL,
  title           TEXT    NOT NULL DEFAULT '',
  company         TEXT    NOT NULL DEFAULT '',
  location        TEXT             DEFAULT '',
  remote          INTEGER          DEFAULT 0,
  description     TEXT             DEFAULT '',
  requirements    TEXT             DEFAULT '',
  salary_range    TEXT             DEFAULT '',
  posted_at       TEXT,
  discovered_at   TEXT             DEFAULT (datetime('now')),
  source          TEXT    NOT NULL DEFAULT 'linkedin',
  status          TEXT    NOT NULL DEFAULT 'new'
                          CHECK(status IN (
                            'new', 'scored', 'draft_ready',
                            'pending_approval', 'applied',
                            'rejected', 'skipped', 'error'
                          )),
  fit_score       REAL,
  rationale       TEXT,
  missing_skills  TEXT,                        -- JSON array string
  created_at      TEXT             DEFAULT (datetime('now')),
  updated_at      TEXT             DEFAULT (datetime('now'))
);

-- Immutable audit trail for every pipeline event
CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id      INTEGER,
  event_type  TEXT    NOT NULL,                -- scan_found | scored | draft_created | submitted | error | …
  payload     TEXT             DEFAULT '{}',   -- JSON blob
  created_at  TEXT             DEFAULT (datetime('now')),
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL
);

-- One application record per job (enforced by UNIQUE on job_id)
CREATE TABLE IF NOT EXISTS applications (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id                INTEGER NOT NULL UNIQUE,
  status                TEXT    NOT NULL DEFAULT 'pending'
                                CHECK(status IN (
                                  'pending', 'approved', 'rejected',
                                  'submitted', 'failed'
                                )),
  approved_by           TEXT,                  -- Telegram user id / username
  resume_path           TEXT,
  cover_letter_path     TEXT,
  screenshot_path       TEXT,
  confirmation_text     TEXT,
  submitted_at          TEXT,
  error_text            TEXT,
  attempt_count         INTEGER          DEFAULT 0,
  created_at            TEXT             DEFAULT (datetime('now')),
  updated_at            TEXT             DEFAULT (datetime('now')),
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

-- Browser / LinkedIn session state
CREATE TABLE IF NOT EXISTS sessions (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  platform              TEXT    NOT NULL DEFAULT 'linkedin',
  status                TEXT    NOT NULL DEFAULT 'unknown'
                                CHECK(status IN (
                                  'healthy', 'degraded', 'logged_out', 'error', 'unknown'
                                )),
  last_check            TEXT,
  last_healthy          TEXT,
  consecutive_failures  INTEGER          DEFAULT 0,
  user_agent            TEXT,
  profile_path          TEXT,
  notes                 TEXT,
  created_at            TEXT             DEFAULT (datetime('now')),
  updated_at            TEXT             DEFAULT (datetime('now')),
  UNIQUE(platform)
);

-- Seed the LinkedIn session row so health checks always have a row to read
INSERT OR IGNORE INTO sessions (platform, status) VALUES ('linkedin', 'unknown');

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_jobs_status      ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_fit_score   ON jobs(fit_score DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at  ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_job_id    ON events(job_id);
CREATE INDEX IF NOT EXISTS idx_events_type      ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_apps_status      ON applications(status);
