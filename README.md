# Job Application Agent

Local-first Windows 10 job-application agent with Telegram control and cloud LLM scoring.

## Architecture

| Component | Role |
|-----------|------|
| **Express.js** | Local API server — SQLite, health endpoint, Playwright |
| **SQLite** | Persistent storage (jobs, events, applications, sessions) |
| **Telegram bot** | Control interface (polling mode or via n8n) |
| **n8n** | Workflow orchestrator — imports workflow JSONs from `n8n-workflows/` |
| **Playwright** | Browser automation with persistent LinkedIn profile |
| **OpenRouter** | Cloud LLM for scoring and package generation |

---

## Quick Start

### Prerequisites

- Windows 10, Node.js ≥ 18, npm ≥ 9
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- An [OpenRouter](https://openrouter.ai) API key
- n8n (Docker or global install — only needed for n8n workflows)

### 1. Install dependencies

```powershell
cd C:\n8n\jobapplicationagent
npm install
```

### 2. Configure environment

```powershell
copy .env.example .env
# Open .env and fill in your secrets
notepad .env
```

Minimum required secrets for Phase 0:
```
TELEGRAM_BOT_TOKEN=...
OPENROUTER_API_KEY=...
TELEGRAM_ALLOWED_CHAT_IDS=<your Telegram chat ID>
```

> **Find your chat ID:** Send any message to [@userinfobot](https://t.me/userinfobot) on Telegram.

### 3. Initialise the database

```powershell
npm run init-db
```

### 4. Start the API server

```powershell
npm start
# or with hot-reload:
npm run dev
```

The server starts on `http://localhost:3000` by default.

### 5. Install Playwright browser (Phase 1+)

```powershell
npm run install:playwright
```

### 6. Validate Phase 0

Open a **second** terminal while the server is running:

```powershell
npm run validate
```

Expected output: all items green (✅ PASS), zero failures.

### 7. Start n8n (optional — for workflow orchestration)

**Option A — Docker (recommended):**

```powershell
docker-compose up -d
# n8n available at http://localhost:5678 (admin / changeme)
```

**Option B — npx:**

```powershell
npx n8n start
```

### 8. Import n8n workflows

1. Open n8n at `http://localhost:5678`
2. Go to **Workflows → Import from file**
3. Import each file from the `n8n-workflows/` folder in order:
   - `phase0-foundation.json`
   - `phase1-discovery.json`
   - `phase2-scoring.json`
   - `phase3-package-gen.json`
   - `phase4-assisted-apply.json`
4. In n8n **Credentials**, add:
   - **Telegram Bot API** (Bot Token)
   - **HTTP Header Auth** named "OpenRouter API Key" with header `Authorization: Bearer <key>`
5. In each workflow, update credential references (`SETUP_REQUIRED`) to the IDs n8n assigned
6. Set `TELEGRAM_MODE=n8n` in `.env` and restart the server to avoid double-polling

---

## Telegram Commands

| Command | Phase | Description |
|---------|-------|-------------|
| `/ping` | 0 | Liveness check |
| `/status` | 0 | System health + pipeline stats |
| `/help` | 0 | Full command list |
| `/scan` | 1 | Trigger LinkedIn job scan |
| `/topjobs` | 1 | Top scored jobs |
| `/review <job_id>` | 2 | Review a job's score and rationale |
| `/approve <app_id>` | 3 | Approve an application package |
| `/reject <app_id>` | 3 | Reject an application package |
| `/apply <job_id>` | 4 | Playwright-assisted submit |
| `/relogin` | 4 | Re-authenticate LinkedIn |

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Full status object |
| `GET` | `/health/ping` | Quick liveness probe |
| `GET` | `/api/jobs` | List jobs (`?status=&min_score=&limit=&offset=`) |
| `POST` | `/api/jobs` | Upsert job by canonical URL (dedup built-in) |
| `PATCH` | `/api/jobs/:id` | Update job status / score |
| `GET` | `/api/sessions` | All session states |
| `PATCH` | `/api/sessions/:platform` | Update session state |
| `GET` | `/api/applications` | List applications |
| `POST` | `/api/applications` | Create application (blocks duplicates) |
| `PATCH` | `/api/applications/:id` | Update status / evidence |
| `GET` | `/api/events` | Audit event log |
| `POST` | `/api/events` | Log a custom event |

---

## Project Structure

```
jobapplicationagent/
├── src/
│   ├── index.js                # Express server entry point
│   ├── db/
│   │   ├── schema.sql          # SQLite schema (idempotent)
│   │   └── database.js         # DB init, getDb(), logEvent()
│   ├── routes/
│   │   ├── health.js           # GET /health, GET /health/ping
│   │   ├── jobs.js             # CRUD + dedup for jobs
│   │   ├── sessions.js         # LinkedIn session state
│   │   ├── applications.js     # Application lifecycle
│   │   └── events.js           # Audit log
│   ├── services/
│   │   ├── telegram.js         # Polling bot (/ping /status /help)
│   │   ├── llm.js              # OpenRouter scoring (Phase 2)
│   │   └── linkedin.js         # Playwright scraper (Phase 1)
│   └── utils/
│       └── logger.js           # Winston logger
├── n8n-workflows/
│   ├── phase0-foundation.json
│   ├── phase1-discovery.json
│   ├── phase2-scoring.json
│   ├── phase3-package-gen.json
│   └── phase4-assisted-apply.json
├── playwright/
│   ├── browser.js              # Chromium persistent context helper
│   └── profiles/               # LinkedIn session data (gitignored)
├── scripts/
│   ├── init-db.js              # One-time DB bootstrapper
│   └── validate-phase0.js      # Phase 0 health-check script
├── data/                       # SQLite file (gitignored)
├── artifacts/                  # Generated resumes/covers (gitignored)
├── logs/                       # Log files (gitignored)
├── kpi/
│   └── dashboard-template.md   # KPI tracking template
├── checklist/
│   └── mvp-14day.md            # 14-day MVP test checklist
├── .env.example                # Secret template
├── docker-compose.yml          # n8n Docker setup
└── README.md
```

---

## Quality Gates

| Metric | Target |
|--------|--------|
| Submit success rate | ≥ 85% |
| LinkedIn session pass rate | ≥ 90% |
| Duplicate submits | 0 |
| Auto-pause trigger | 3 consecutive failures |
| Telegram response time | < 5 s |

---

## Phase Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| **0** | ✅ | Foundation: API, SQLite, health, /ping /status |
| **1** | 🔲 | LinkedIn scan + dedup + /scan /topjobs |
| **2** | 🔲 | LLM scoring via OpenRouter + /review |
| **3** | 🔲 | Tailored resume/cover generation + approve/reject |
| **4** | 🔲 | Playwright-assisted apply + session health + /relogin |

---

## Security Checklist

- [x] All secrets read from `.env` — never hardcoded
- [x] `.env` in `.gitignore` — never committed
- [x] Telegram access restricted to `TELEGRAM_ALLOWED_CHAT_IDS`
- [x] All SQL uses parameterised queries — no injection risk
- [x] Duplicate-submit guard at DB level (`UNIQUE` constraint on `applications.job_id`)
- [x] Auto-pause after `MAX_CONSECUTIVE_FAILURES` failures
