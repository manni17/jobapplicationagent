# KPI Dashboard — Job Application Agent

Update this file daily during the 14-day MVP test.

---

## Daily Log

| Date | Jobs Scanned | New Jobs | Scored | High-Score (≥70) | Packages Generated | Approved | Submitted | ✅ Success | ❌ Failed | Session Status |
|------|-------------|----------|--------|------------------|--------------------|----------|-----------|-----------|----------|----------------|
| Day 1  | — | — | — | — | — | — | — | — | — | — |
| Day 2  | — | — | — | — | — | — | — | — | — | — |
| Day 3  | — | — | — | — | — | — | — | — | — | — |
| Day 4  | — | — | — | — | — | — | — | — | — | — |
| Day 5  | — | — | — | — | — | — | — | — | — | — |
| Day 6  | — | — | — | — | — | — | — | — | — | — |
| Day 7  | — | — | — | — | — | — | — | — | — | — |
| Day 8  | — | — | — | — | — | — | — | — | — | — |
| Day 9  | — | — | — | — | — | — | — | — | — | — |
| Day 10 | — | — | — | — | — | — | — | — | — | — |
| Day 11 | — | — | — | — | — | — | — | — | — | — |
| Day 12 | — | — | — | — | — | — | — | — | — | — |
| Day 13 | — | — | — | — | — | — | — | — | — | — |
| Day 14 | — | — | — | — | — | — | — | — | — | — |

---

## Weekly Summaries

### Week 1 (Days 1–7)

| Metric | Value |
|--------|-------|
| Total jobs scanned | — |
| Total new jobs (after dedup) | — |
| Scanned → Scored conversion | — % |
| Scored → High-fit (≥70) | — % |
| High-fit → Package generated | — % |
| Packages approved | — |
| Applications submitted | — |
| **Submit success rate** | — % *(target: ≥ 85%)* |
| **Session pass rate** | — % *(target: ≥ 90%)* |
| **Duplicate submits** | — *(target: 0)* |
| Auto-pause events | — |

### Week 2 (Days 8–14)

| Metric | Value |
|--------|-------|
| Total jobs scanned | — |
| Total new jobs (after dedup) | — |
| Scanned → Scored conversion | — % |
| Scored → High-fit (≥70) | — % |
| High-fit → Package generated | — % |
| Packages approved | — |
| Applications submitted | — |
| **Submit success rate** | — % *(target: ≥ 85%)* |
| **Session pass rate** | — % *(target: ≥ 90%)* |
| **Duplicate submits** | — *(target: 0)* |
| Auto-pause events | — |

---

## Quality Gates — Running Total

| Gate | Target | Current | Status |
|------|--------|---------|--------|
| Submit success rate | ≥ 85% | — | ⏳ |
| Session pass rate | ≥ 90% | — | ⏳ |
| Duplicate submits | 0 | — | ⏳ |
| Auto-pause triggers correctly on 3 failures | Yes | — | ⏳ |
| All Telegram commands respond in < 5 s | Yes | — | ⏳ |

---

## Top Employers Targeted

| Company | Jobs Found | High-fit | Applications Sent | Status |
|---------|-----------|----------|-------------------|--------|
| | | | | |

---

## Error Log

| Date | Error Type | Description | Count | Resolution |
|------|-----------|-------------|-------|------------|
| | | | | |

---

## Score Distribution

Plot the fit_score histogram after scoring ≥ 20 jobs.

```sql
-- Run in SQLite or via /api/events
SELECT
  CASE
    WHEN fit_score >= 90 THEN '90–100 (Excellent)'
    WHEN fit_score >= 80 THEN '80–89  (Strong)'
    WHEN fit_score >= 70 THEN '70–79  (Good)'
    WHEN fit_score >= 60 THEN '60–69  (Fair)'
    WHEN fit_score >= 50 THEN '50–59  (Weak)'
    ELSE                      '<50    (Poor)'
  END AS band,
  COUNT(*) AS jobs
FROM jobs
WHERE fit_score IS NOT NULL
GROUP BY band
ORDER BY band DESC;
```

| Band | Jobs |
|------|------|
| 90–100 (Excellent) | — |
| 80–89  (Strong) | — |
| 70–79  (Good) | — |
| 60–69  (Fair) | — |
| 50–59  (Weak) | — |
| <50    (Poor) | — |

---

## Notes / Observations

_Add daily notes, prompt tuning notes, and lessons learned here._
