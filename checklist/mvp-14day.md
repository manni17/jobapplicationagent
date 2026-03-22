# 14-Day MVP Test Checklist — Job Application Agent

Track each item as ✅ Pass | ❌ Fail | ⏭ Skipped.

---

## Go / No-Go Gates (Day 14)

ALL five gates must be green before scaling to production volume.

- [ ] Submit success rate ≥ 85%
- [ ] LinkedIn session pass rate ≥ 90%
- [ ] Zero duplicate submits confirmed
- [ ] Auto-pause triggers correctly after 3 consecutive failures
- [ ] All Telegram commands respond within 5 seconds

---

## Week 1 — Foundation & Discovery

### Day 1 — Phase 0 Validation

**Goal:** Confirm the entire API + Telegram stack is operational.

- [ ] `npm install` completes without errors
- [ ] `npm run init-db` succeeds and reports 4 tables
- [ ] `npm start` starts on PORT 3000 without errors
- [ ] `GET http://localhost:3000/health` returns `{ status: "ok" }`
- [ ] `GET http://localhost:3000/health/ping` returns `{ pong: true }`
- [ ] `npm run validate` reports **0 FAIL** (WARNs for unconfigured secrets are OK)
- [ ] Telegram `/ping` → bot replies "🏓 Pong!"
- [ ] Telegram `/status` → returns stats block
- [ ] Telegram `/help` → returns full command list
- [ ] n8n Phase 0 workflow imported, credentials configured, and activated
- [ ] No errors in `logs/error.log`

**Day 1 Gate:** API alive + Telegram operational ✅ / ❌

---

### Day 2 — Phase 1: First LinkedIn Scan

**Goal:** ≥ 10 real job records in DB from a live scan.

- [ ] LinkedIn credentials set in `.env`
- [ ] `npm run install:playwright` competes (Chromium downloaded)
- [ ] Playwright profile directory created at `playwright/profiles/linkedin/`
- [ ] Phase 1 LinkedIn scraper implementation started
- [ ] Telegram `/scan` triggers scrape (no error)
- [ ] ≥ 10 jobs visible in DB: `GET /api/jobs`
- [ ] All jobs have valid `canonical_url` (matches `/jobs/view/<id>/`)
- [ ] Event log shows `job_discovered` events

**Day 2 Gate:** ≥ 10 real jobs in DB ✅ / ❌

---

### Day 3 — Phase 1: Dedup & Discovery Refinement

**Goal:** Re-scan produces 0 new duplicates; ≥ 25 jobs total.

- [ ] Telegram `/topjobs` returns formatted list (even if unscored)
- [ ] Job titles and companies correctly scraped (no garbled text)
- [ ] All URLs are canonical (no `?trackingId=` params)
- [ ] Pagination working — scan finds ≥ 25 jobs per run
- [ ] Re-run `/scan` → duplicate count equals previous total, 0 new rows added
- [ ] `POST /api/jobs` with existing URL returns `created: false`

**Day 3 Gate:** Dedup rate = 100% on re-scan ✅ / ❌

---

### Day 4 — Phase 2: First LLM Scoring

**Goal:** ≥ 10 jobs scored with valid fit_score values.

- [ ] `OPENROUTER_API_KEY` configured in `.env`
- [ ] `LLM_MODEL` configured (default: `openai/gpt-4o-mini`)
- [ ] Phase 2 scoring workflow activated in n8n (runs every 30 min)
- [ ] `fit_score` values appear in DB: `GET /api/jobs?status=scored`
- [ ] Scores are integers 0–100 (not all the same value)
- [ ] `rationale` text is coherent and job-specific
- [ ] `missing_skills` is a valid JSON array
- [ ] Telegram `/review <id>` shows score + rationale + skills
- [ ] No LLM API errors in event log

**Day 4 Gate:** ≥ 10 scored jobs with plausible scores ✅ / ❌

---

### Day 5 — Phase 2: Score Calibration

**Goal:** Scores feel accurate relative to your target role.

- [ ] Manually review 10 scored jobs
- [ ] Do the top 5 scores match jobs you'd actually want? (subjective)
- [ ] Do the bottom 5 scores match jobs that are clearly off-target?
- [ ] Adjust LLM system prompt in `src/services/llm.js` or n8n if needed
- [ ] Re-score a test set after prompt change
- [ ] `MIN_FIT_SCORE_TO_APPLY` threshold calibrated (default: 70)

**Day 5 Gate:** Score ordering feels correct (manual spot-check) ✅ / ❌

---

### Day 6 — Phase 3: Package Generation

**Goal:** First tailored cover letter generated and approved via Telegram.

- [ ] Phase 3 package generation implemented (calls OpenRouter)
- [ ] At least one high-scoring job triggers package generation
- [ ] Cover letter draft saved to `artifacts/`
- [ ] Telegram message sent with approve/reject buttons
- [ ] Telegram `/approve <app_id>` marks application as `approved`
- [ ] Telegram `/reject <app_id>` marks application as `rejected`
- [ ] `approved_by` field populated with Telegram username
- [ ] No duplicate application rows created on re-run

**Day 6 Gate:** First package generated + approved ✅ / ❌

---

### Day 7 — Week 1 Review

**Goal:** Consolidate Week 1 — no regressions, pipeline healthy.

- [ ] KPI dashboard filled in for Days 1–7
- [ ] `logs/error.log` reviewed and recurring errors addressed
- [ ] `SELECT canonical_url, COUNT(*) FROM jobs GROUP BY canonical_url HAVING COUNT(*) > 1` returns 0 rows
- [ ] `SELECT job_id, COUNT(*) FROM applications GROUP BY job_id HAVING COUNT(*) > 1` returns 0 rows
- [ ] ≥ 5 packages approved and ready for submit
- [ ] All Telegram commands still working

**Day 7 Gate:** ≥ 5 packages approved, 0 duplicates ✅ / ❌

---

## Week 2 — Apply & Optimise

### Day 8 — Phase 4: First Apply Attempt

**Goal:** End-to-end apply flow executes without crash.

- [ ] Playwright apply flow implemented
- [ ] Session health check runs before each apply
- [ ] Telegram `/apply <job_id>` triggers the flow
- [ ] LinkedIn "Easy Apply" form identified and filled
- [ ] Human confirmation required before final submit (bot pauses)
- [ ] Screenshot saved to `artifacts/screenshots/`
- [ ] On success: `applications.status = 'submitted'`, screenshot + confirmation text saved
- [ ] On failure: `error_text` saved, `consecutive_failures` incremented

**Day 8 Gate:** First apply attempt completes (success OR clear error diagnosis) ✅ / ❌

---

### Day 9 — Measure Submit Success Rate

**Goal:** Establish baseline submit success rate.

- [ ] Run ≥ 5 apply attempts
- [ ] Log outcome for each in KPI dashboard
- [ ] Calculate: `success_rate = submitted / (submitted + failed) × 100`
- [ ] Screenshot evidence saved for each attempt
- [ ] Telegram confirms each submission
- [ ] Review failure screenshots to identify patterns

**Day 9 Gate:** Submit success rate trend visible ✅ / ❌

---

### Day 10 — Session Stability

**Goal:** LinkedIn session pass rate ≥ 90%.

- [ ] `consecutive_failures` counter increments correctly on failure
- [ ] `GET /api/sessions/linkedin` reflects current session state correctly
- [ ] `/relogin` command successfully re-authenticates if session is expired
- [ ] Auto-pause fires when `consecutive_failures ≥ MAX_CONSECUTIVE_FAILURES`
- [ ] Auto-pause sends Telegram alert with instructions
- [ ] After auto-pause, manual `/relogin` resets failures and resumes

**Day 10 Gate:** No unexpected session drops; pass rate ≥ 90% ✅ / ❌

---

### Day 11 — Error Rate Review

**Goal:** Reduce error rate; identify + fix top recurring failure.

- [ ] Query all error events: `GET /api/events?event_type=error`
- [ ] Categorise errors: LinkedIn DOM change | auth failure | form detection | rate limit | other
- [ ] Fix the top recurring error
- [ ] Re-run 3 apply attempts after fix
- [ ] Verify error rate has decreased

**Day 11 Gate:** Error rate declining vs Day 9 ✅ / ❌

---

### Day 12 — Duplicate Prevention Audit

**Goal:** Confirm zero duplicate submits — a hard quality gate.

```sql
-- Both queries must return 0 rows
SELECT canonical_url, COUNT(*) FROM jobs         GROUP BY canonical_url HAVING COUNT(*) > 1;
SELECT job_id,        COUNT(*) FROM applications GROUP BY job_id        HAVING COUNT(*) > 1;
```

- [ ] Both SQL queries return 0 rows
- [ ] Attempt to `/apply` a job already marked `submitted` → graceful rejection
- [ ] Attempt to `POST /api/applications` with existing `job_id` → HTTP 409
- [ ] Re-run `/scan` → 0 new duplicate job rows
- [ ] Dedup logic verified under concurrent requests (if applicable)

**Day 12 Gate:** Zero duplicate submits confirmed ✅ / ❌

---

### Day 13 — Full Pipeline Run

**Goal:** One end-to-end pipeline run: scan → score → package → approve → submit × 3.

- [ ] Fresh `/scan` finds ≥ 5 new jobs
- [ ] LLM scores all new jobs within 30 minutes
- [ ] `/topjobs` shows 3 jobs with score ≥ 70
- [ ] Packages generated for top 3
- [ ] All 3 packages approved via Telegram
- [ ] All 3 applications submitted
- [ ] Event trail in DB shows complete lifecycle for each job
- [ ] KPI dashboard updated

**Day 13 Gate:** 3 applications submitted in one pipeline run ✅ / ❌

---

### Day 14 — Go / No-Go Assessment

**Goal:** Final quality gate evaluation.

#### Final Metrics Checklist

| Metric | Target | Actual | Pass? |
|--------|--------|--------|-------|
| Submit success rate | ≥ 85% | __% | ✅/❌ |
| Session pass rate | ≥ 90% | __% | ✅/❌ |
| Duplicate submits (total across 14 days) | 0 | __ | ✅/❌ |
| Auto-pause triggers correctly | Yes | Yes/No | ✅/❌ |
| All Telegram commands respond < 5 s | Yes | Yes/No | ✅/❌ |

#### Decision

- [ ] ✅ **GO** — All 5 gates passed. Begin production volume (5–10 applications/day).
- [ ] ❌ **NO-GO** — One or more gates failed. Address issues; extend test by 7 days.

#### Post-MVP Backlog

_List technical debt, known issues, and improvements identified during the test:_

1. 
2. 
3. 
