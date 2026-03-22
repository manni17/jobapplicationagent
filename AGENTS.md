# AGENTS.md — Job Application Agent

> **This is the entry point for every agent and developer working on this project.**
> Read this file first. Every implementation decision must serve the mission and KPIs defined below.

---

## Mission

Automate **85%+ of job application volume** with zero duplicate submissions, targeting roles that match a minimum fit score of 70/100, controlled entirely via Telegram with minimal human intervention.

**The job seeker sends one Telegram command. The agent finds the job, scores it, writes a tailored cover letter, and submits the application — pausing only when the human must decide.**

---

## Success KPIs — The North Star

These are non-negotiable targets. Every feature, fix, and design choice must move these numbers in the right direction.

| KPI | Target | Measured By |
|-----|--------|-------------|
| **Submit success rate** | ≥ 85% | `submitted / (submitted + failed)` in applications table |
| **LinkedIn session pass rate** | ≥ 90% | `healthy` checks / total checks in sessions table |
| **Duplicate submits** | 0 | `canonical_url` uniqueness + one-per-job application constraint |
| **Scoring accuracy** | Top-5 scored = jobs you'd want | Manual spot-check on Day 5 |
| **Fit score threshold** | ≥ 70 to qualify | `MIN_FIT_SCORE_TO_APPLY` env var (default: 70) |
| **Telegram response time** | < 5 seconds | Manual command-response timing |
| **Auto-pause on failure** | Fires after 3 consecutive failures | `consecutive_failures ≥ 3` check in Phase 4 |
| **Cover letter quality** | Approved by human before submit | Phase 3 approval gate |

### Go / No-Go Gates (Day 14)
ALL five gates must be green before scaling to production volume:
- [ ] Submit success rate ≥ 85%
- [ ] LinkedIn session pass rate ≥ 90%
- [ ] Zero duplicate submits confirmed
- [ ] Auto-pause fires correctly after 3 consecutive failures
- [ ] All Telegram commands respond within 5 seconds

See `kpi/dashboard-template.md` for the daily tracking log.
See `checklist/mvp-14day.md` for the full 14-day phase gate checklist.

---

## Quick Start — From Zero to Running

Before writing any code, complete this checklist in order:

### Step 1 — Prerequisites
```bash
node --version        # Must be 22.10+
docker --version      # Docker Desktop must be running
```

### Step 2 — Install & Bootstrap
```bash
npm install
npm run init-db       # Creates ./data/jobs.db with 4 tables
```

### Step 3 — Configure Secrets (copy .env.example → .env)
```
TELEGRAM_BOT_TOKEN=          # From @BotFather — required
TELEGRAM_ALLOWED_CHAT_IDS=   # Your Telegram chat ID — required, security whitelist
OPENROUTER_API_KEY=          # From openrouter.ai — required for Phase 2+
TELEGRAM_MODE=polling        # Enable Node bot polling
MIN_FIT_SCORE_TO_APPLY=70    # Jobs below this score are skipped
MAX_CONSECUTIVE_FAILURES=3   # Auto-pause threshold
PLAYWRIGHT_HEADLESS=false    # false = visible browser for first LinkedIn login
```

### Step 4 — Configure Candidate Profile (required for LLM accuracy)
Add to `.env` — these feed the LLM system prompt for scoring and cover letter generation:
```
CANDIDATE_NAME=              # Full name for cover letters
CANDIDATE_TARGET_ROLE=       # e.g. "Senior Software Engineer"
CANDIDATE_SKILLS=            # Comma-separated: "Node.js,Python,AWS,Docker"
CANDIDATE_EXPERIENCE_YEARS=  # e.g. 8
CANDIDATE_LOCATION=          # e.g. "London, UK" or "Remote"
CANDIDATE_RESUME_PATH=       # Absolute path to base resume PDF/DOCX
LINKEDIN_SEARCH_KEYWORDS=    # e.g. "software engineer nodejs"
LINKEDIN_SEARCH_LOCATION=    # e.g. "United Kingdom"
LINKEDIN_SEARCH_REMOTE=      # true/false
```

### Step 5 — Start the Stack
```bash
docker compose up -d          # Start n8n at http://localhost:5678
npm start                     # Start Express API at http://localhost:3000
```

### Step 6 — Import n8n Workflows
Open `http://localhost:5678` → Settings → Import → import each file from `n8n-workflows/` in phase order (0 → 4).

### Step 7 — Validate
```bash
npm run validate              # Should report 0 FAIL
```
Then send `/ping` to your Telegram bot. You should get "🏓 Pong!" back.

---

## Project Overview

**Job Application Agent** is a Windows 10-native automation platform that discovers, scores, and applies to LinkedIn jobs with minimal human intervention. It is controlled via Telegram, orchestrated by n8n, and powered by cloud LLMs (OpenRouter) for intelligent scoring and cover letter generation.

**Goal**: Automate 85%+ of job application volume, operating across 4 automation phases over a 14-day MVP sprint.

---

## Architecture Summary

```
Telegram User
    │
    ▼
n8n (Docker, port 5678) ──────────── OpenRouter LLM API
    │
    ▼
Express API (Node.js, port 3000)
    │
    ├── SQLite DB (./data/jobs.db)
    └── Playwright/Chromium (LinkedIn scraping)
```

### Four Automation Phases

| Phase | Purpose | Status |
|-------|---------|--------|
| 0 | Telegram bot foundation + health/status commands | ✅ Implemented |
| 1 | LinkedIn job discovery via Playwright scraping | 🚧 Stub |
| 2 | LLM-based job fit scoring (OpenRouter) | 🚧 Partial |
| 3 | Tailored cover letter generation + approval | 🚧 Blueprint |
| 4 | Playwright-driven LinkedIn Easy Apply submission | 🚧 Blueprint |

---

## Repository Structure

```
├── docker-compose.yml          # n8n service definition
├── package.json                # Node.js dependencies and npm scripts
├── artifacts/                  # Generated files: cover letters, screenshots
├── checklist/
│   └── mvp-14day.md            # 14-day MVP sprint checklist
├── data/                       # SQLite database file (jobs.db, gitignored)
├── kpi/
│   └── dashboard-template.md   # KPI tracking template
├── logs/                       # Winston log output (combined.log, error.log)
├── n8n-workflows/              # n8n workflow JSON files (import into n8n UI)
│   ├── phase0-foundation.json  # Telegram command handler (/ping /status /help)
│   ├── phase1-discovery.json   # LinkedIn scan + /topjobs stub
│   ├── phase2-scoring.json     # Scheduled LLM scoring + /review command
│   ├── phase3-package-gen.json # Cover letter generation + /approve /reject
│   └── phase4-assisted-apply.json # Playwright Easy Apply + /apply /relogin
├── playwright/
│   ├── browser.js              # Persistent Chromium context, session health check
│   └── profiles/               # linkedin/ profile dir (cookies, gitignored)
├── scripts/
│   ├── init-db.js              # One-time DB bootstrap
│   └── validate-phase0.js      # Health validation CLI script
└── src/
    ├── index.js                # Express server entry point
    ├── db/
    │   ├── database.js         # SQLite singleton wrapper, logEvent()
    │   └── schema.sql          # Idempotent DDL (4 tables + indexes)
    ├── routes/
    │   ├── health.js           # GET /health, GET /health/ping
    │   ├── jobs.js             # CRUD /api/jobs
    │   ├── applications.js     # CRUD /api/applications
    │   ├── sessions.js         # CRUD /api/sessions/:platform
    │   └── events.js           # Append-only /api/events log
    ├── services/
    │   ├── linkedin.js         # canonicalUrl(), persistJob(), scanLinkedIn() stub
    │   ├── llm.js              # scoreJob() → OpenRouter chat API
    │   └── telegram.js         # Raw Bot API polling, /ping /status /help handlers
    └── utils/
        └── logger.js           # Winston dual output (console + files)
```

---

## Key Technologies

| Technology | Version | Role |
|-----------|---------|------|
| Node.js | 22.10+ | Runtime (native SQLite via `node:sqlite`) |
| Express | 4.18.3 | REST API server (port 3000) |
| SQLite | built-in | Persistent storage (WAL mode, FK enforcement) |
| Playwright | 1.42.1 | Chromium browser automation (headless/headed) |
| n8n | Docker | Workflow orchestration + scheduling |
| OpenRouter | API | LLM gateway (job scoring, cover letter gen) |
| Winston | 3.12.0 | Structured logging |
| Axios | latest | HTTP client (Telegram Bot API, OpenRouter) |
| Docker Compose | v2 | n8n container management |

---

## Database Schema

### `jobs` table
- **Status flow**: `new` → `scored` → `draft_ready` → `pending_approval` → `applied` / `rejected` / `skipped` / `error`
- Key fields: `canonical_url` (unique), `fit_score` (0–100), `rationale`, `missing_skills`

### `applications` table
- One-per-job (UNIQUE on `job_id`)
- **Status flow**: `pending` → `approved` / `rejected` → `submitted` / `failed`
- Stores paths to generated `resume_path`, `cover_letter_path`, `screenshot_path`

### `events` table
- Immutable, append-only audit log
- `event_type` examples: `job_discovered`, `scored`, `draft_created`, `submitted`, `error`

### `sessions` table
- Platform session health tracking (e.g., `linkedin`)
- **Status enum**: `healthy`, `degraded`, `logged_out`, `error`, `unknown`

---

## REST API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Full status (uptime, DB, session, job counts) |
| GET | `/health/ping` | Fast liveness check |
| GET | `/api/jobs` | List jobs (`?status=&min_score=&limit=&offset=`) |
| GET | `/api/jobs/:id` | Single job details |
| POST | `/api/jobs` | Upsert job (deduplicates by `canonical_url`) |
| PATCH | `/api/jobs/:id` | Update score, status, rationale |
| GET | `/api/applications` | List applications (`?status=&limit=&offset=`) |
| GET | `/api/applications/:id` | Single application with job details |
| POST | `/api/applications` | Create application (enforces 1-per-job) |
| PATCH | `/api/applications/:id` | Update status, paths, evidence |
| GET | `/api/sessions` | All session states |
| GET | `/api/sessions/:platform` | Specific platform session |
| PATCH | `/api/sessions/:platform` | Update session health |
| GET | `/api/events` | Full audit log (paginated) |
| POST | `/api/events` | Append custom event |

---

## Telegram Commands

| Command | Handler | Description |
|---------|---------|-------------|
| `/ping` | Phase 0 (Node + n8n) | Liveness check |
| `/status` | Phase 0 | Job counts, session health |
| `/help` | Phase 0 | Full command menu |
| `/scan` | Phase 1 n8n | Trigger LinkedIn discovery |
| `/topjobs` | Phase 1 n8n | Show top 10 scored jobs |
| `/review <job_id>` | Phase 2 n8n | Review a specific job's score |
| `/approve <app_id>` | Phase 3 n8n | Approve cover letter + trigger generation |
| `/reject <app_id>` | Phase 3 n8n | Reject an application |
| `/apply <job_id>` | Phase 4 n8n | Trigger Easy Apply via Playwright |
| `/relogin` | Phase 4 n8n | Re-authenticate LinkedIn session |

---

## Environment Variables

| Variable | Required | Description |
|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from @BotFather |
| `TELEGRAM_ALLOWED_CHAT_IDS` | Yes | Comma-separated whitelist of chat IDs |
| `OPENROUTER_API_KEY` | Yes (Phase 2+) | LLM API key |
| `TELEGRAM_MODE` | No | Set to `polling` to enable Node bot polling |
| `PORT` | No | Express port (default: 3000) |
| `LOG_LEVEL` | No | Winston log level (default: info) |
| `PLAYWRIGHT_HEADLESS` | No | `true`/`false` for headless mode |

---

## npm Scripts

```bash
npm start           # Start Express API server
npm run init-db     # Bootstrap SQLite database (run once)
npm run validate    # Run Phase 0 health validation CLI
```

---

## Development Conventions

### Code Style
- **Node.js 22.10+** required (uses native `node:sqlite`)
- CommonJS (`require`/`module.exports`) — no ESM
- No TypeScript; plain JavaScript throughout
- Express middleware pattern for all routes
- Routes export a single `router` object

### Database Patterns
- Always use `getDb()` singleton — never open a new connection
- All writes that represent state changes must call `logEvent()` for auditability
- Status transitions must match the allowed enums in `schema.sql`
- Upsert pattern: check `canonical_url` uniqueness before INSERT in jobs route

### Error Handling
- Routes return structured JSON: `{ error: "message" }` on failure
- Use HTTP status codes correctly: 400 (bad input), 404 (not found), 409 (conflict), 500 (server error)
- Log all errors with `logger.error()` including stack traces

### Security
- `isAllowedChat()` whitelist is enforced in `services/telegram.js` — never bypass it
- Never log `TELEGRAM_BOT_TOKEN` or `OPENROUTER_API_KEY`
- All user input from Telegram commands must be validated before use in DB queries
- Use parameterized queries for all SQLite operations

### n8n Workflows
- Workflow JSONs live in `n8n-workflows/` — import via n8n UI (`Settings > Import`)
- Do not modify workflow files directly while n8n is running with them active
- Stubs (phases 1, 3, 4) contain placeholder nodes — replace with real HTTP/Function nodes

### Playwright
- Always use the persistent profile at `./playwright/profiles/linkedin/` to retain session
- Run `checkSessionHealth()` before any scraping operation
- Save screenshots to `./artifacts/screenshots/` via `captureScreenshot()`
- Anti-bot user-agent and args are set in `browser.js` — do not remove them

### Logging
- Use `logger.info()`, `logger.warn()`, `logger.error()` from `utils/logger.js`
- Never use `console.log` directly in `src/` or `playwright/`
- Logs are written to `logs/combined.log` (all) and `logs/error.log` (errors only)

---

## Running the Stack

```bash
# 1. Start n8n (Docker)
docker compose up -d

# 2. Bootstrap the database (first time only)
npm run init-db

# 3. Copy and fill out environment variables
copy .env.example .env

# 4. Start the Express API
npm start
```

Access n8n at `http://localhost:5678`. Import workflow JSONs from `n8n-workflows/`.

---

## Human-in-the-Loop Decision Gates

The agent operates autonomously by default. These are the **only moments where the human must decide**. Anything not in this list should be handled end-to-end without interruption.

| Decision Point | Who Decides | Trigger | Outcome |
|---------------|-------------|---------|---------|
| Accept / reject a scored job | Human | `/topjobs` review | `skipped` or advances to Phase 3 |
| Approve cover letter before submit | Human | Telegram message with `/approve <id>` or `/reject <id>` | `approved` → Phase 4, `rejected` → stops |
| Resume LinkedIn session after auto-pause | Human | Telegram alert (consecutive failures ≥ 3) | `/relogin` → reset + resume |
| Confirm final Easy Apply form submit | Human | Playwright pauses and sends screenshot | Human sends confirmation → submit |
| Adjust fit score threshold | Human | Score calibration review (Day 5) | Update `MIN_FIT_SCORE_TO_APPLY` in `.env` |

**Rule for agents**: Never submit an application, never store credentials, and never make irreversible LinkedIn actions without an explicit human approval signal logged in the `applications` table (`approved_by` field populated).

---

## Circuit Breaker & Auto-Pause Protocol

This is the mechanism that prevents the agent from burning a LinkedIn session or wasting LLM budget on a broken pipeline.

### Rules
1. Every failed Playwright action (apply, scrape, health check) **must** increment `consecutive_failures` via `PATCH /api/sessions/linkedin`.
2. Every successful action **must** reset `consecutive_failures` to `0` and set `status = 'healthy'`.
3. When `consecutive_failures ≥ MAX_CONSECUTIVE_FAILURES` (default: 3), the agent **must**:
   - Set `sessions.status = 'degraded'`
   - Stop all Phase 1 and Phase 4 automation immediately
   - Send a Telegram alert: _"⚠️ Auto-pause: 3 consecutive failures. Use /relogin to resume."_
4. The `/relogin` command re-authenticates Playwright, resets `consecutive_failures = 0`, and re-enables automation.

### Implementation Checklist
- [ ] Phase 1 (scan): check session health before each scrape batch; abort batch on `degraded`
- [ ] Phase 4 (apply): check session health before each apply; increment on any exception
- [ ] n8n error branches in Phase 4 workflow call `PATCH /api/sessions/linkedin` with failure state
- [ ] Auto-pause Telegram message includes job counts and failure reason from event log

---

## Anti-Detection & Rate Limiting

LinkedIn actively blocks automation. These rules are mandatory to maintain a healthy session pass rate ≥ 90%.

### Playwright Scraping (Phase 1)
- **Inter-page delay**: 3–7 seconds random delay between each job listing page (`await page.waitForTimeout(3000 + Math.random() * 4000)`)
- **Scroll simulation**: Scroll the results list before extracting job cards to mimic human reading
- **Max jobs per scan run**: 50. Do not paginate beyond 3 pages per run.
- **Scan frequency**: No more than once every 30 minutes (enforced by n8n cron schedule)
- **Session warm-up**: After a fresh login (`/relogin`), wait 60 seconds before starting a scan

### Playwright Apply (Phase 4)
- **Pre-apply delay**: 5–10 seconds random delay after navigating to the job page
- **Field-by-field typing**: Use `page.type()` with a delay (50–120ms per keystroke) instead of `page.fill()`
- **Screenshot before submit**: Always capture a screenshot before the final submit click — this is the human confirmation gate
- **Max daily applies**: Limit to 20 Easy Apply submissions per 24-hour window

### LLM Rate Limiting (Phase 2)
- **Batch size**: Score a maximum of 20 jobs per scheduled run (every 30 minutes)
- **Model default**: `openai/gpt-4o-mini` (fast, cheap, sufficient quality for scoring)
- **Max tokens per call**: 512 for scoring, 1024 for cover letter generation
- **Retry on rate limit**: One retry after 10 seconds; if still failing, log error and skip to next job

---

## LLM Prompt Discipline

The quality of scoring and cover letters depends entirely on the system prompt having accurate candidate context.

### Scoring Prompt Requirements (`src/services/llm.js`)
The system prompt **must** include:
- Candidate target role: `CANDIDATE_TARGET_ROLE`
- Candidate skills list: `CANDIDATE_SKILLS`
- Years of experience: `CANDIDATE_EXPERIENCE_YEARS`
- Location preference: `CANDIDATE_LOCATION`
- Scoring rubric: fit_score 0–100 with explicit criteria for what constitutes 70+

The response **must** be valid JSON matching this shape:
```json
{ "fit_score": 85, "rationale": "...", "missing_skills": ["Kubernetes"] }
```
Always strip markdown code fences before parsing. Log and skip if JSON parse fails.

### Cover Letter Prompt Requirements (Phase 3)
The system prompt **must** include:
- `CANDIDATE_NAME`, `CANDIDATE_TARGET_ROLE`, `CANDIDATE_SKILLS`
- The full job `description` and `requirements` from the DB row
- The `rationale` from the scoring step (what makes this a good fit)
- Tone instruction: professional, concise, 3 paragraphs max

Save the generated cover letter as `./artifacts/cover-letters/<job_id>-<timestamp>.txt` and record the path in `applications.cover_letter_path` before sending the Telegram approval request.

---

## Data Hygiene

Run these queries periodically (at minimum at the Day 7 and Day 14 checkpoints) to prevent DB bloat and stale state from skewing KPIs.

### Identify stale jobs (never scored after 7 days)
```sql
SELECT id, title, company, discovered_at
FROM jobs
WHERE status = 'new'
  AND discovered_at < datetime('now', '-7 days');
-- Action: PATCH status = 'skipped' for these rows
```

### Confirm zero duplicate jobs
```sql
SELECT canonical_url, COUNT(*) AS n
FROM jobs
GROUP BY canonical_url
HAVING n > 1;
-- Expected: 0 rows
```

### Confirm zero duplicate applications
```sql
SELECT job_id, COUNT(*) AS n
FROM applications
GROUP BY job_id
HAVING n > 1;
-- Expected: 0 rows
```

### Prune old events (keep last 30 days)
```sql
DELETE FROM events
WHERE created_at < datetime('now', '-30 days');
```

### Archive old artifacts
- Cover letters older than 30 days: move from `artifacts/cover-letters/` to a date-stamped subfolder
- Screenshots older than 14 days: safe to delete unless the application is still `pending`

---

## Smoke Test Checklist

Run these spot-checks to validate each service independently before running end-to-end:

### Express API
```bash
curl http://localhost:3000/health/ping
# Expected: { "pong": true }

curl http://localhost:3000/health
# Expected: { "status": "ok", "phase": "...", "db": "connected", ... }
```

### SQLite DB
```bash
npm run validate
# Expected: 0 FAIL
```

### Telegram Bot
- Send `/ping` → expect "🏓 Pong!"
- Send `/status` → expect a stats block with counts
- Send a message from a non-whitelisted chat ID → expect no response (security check)

### LLM (OpenRouter)
```bash
node -e "require('./src/services/llm.js').scoreJob({ title: 'Senior Node.js Engineer', description: 'We need Node.js and AWS', requirements: 'Node.js 5+ years', company: 'Acme' }).then(console.log).catch(console.error)"
# Expected: { fit_score: <number>, rationale: '...', missing_skills: [...] }
```

### Playwright (LinkedIn session)
```bash
node -e "const b = require('./playwright/browser.js'); b.getBrowser().then(async ({page}) => { const ok = await b.checkSessionHealth(page); console.log('healthy:', ok); process.exit(0); })"
# Expected: healthy: true (requires prior login)
```

---

## File Generation Paths

| Artifact | Path |
|---------|------|
| SQLite DB | `./data/jobs.db` |
| Cover letters | `./artifacts/cover-letters/` |
| Screenshots | `./artifacts/screenshots/` |
| Winston logs | `./logs/combined.log`, `./logs/error.log` |
| Browser profile | `./playwright/profiles/linkedin/` |
