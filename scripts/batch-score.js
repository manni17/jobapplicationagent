'use strict';
require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');
const { scoreJob } = require('../src/services/llm');

(async () => {
  const db = new DatabaseSync('./data/jobs.db');
  const minScore = parseInt(process.env.MIN_FIT_SCORE_TO_APPLY || '70', 10);
  const jobs = db.prepare('SELECT id,title,company,description,requirements FROM jobs WHERE status = ? ORDER BY id').all('new');

  console.log(`\nScoring ${jobs.length} jobs as: ${process.env.CANDIDATE_NAME} (${process.env.CANDIDATE_TARGET_ROLE})\n`);
  let scored = 0, failed = 0;

  for (const job of jobs) {
    try {
      const result = await scoreJob(job);
      db.prepare('UPDATE jobs SET fit_score = ?, rationale = ?, missing_skills = ?, status = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run(result.fit_score, result.rationale || '', JSON.stringify(result.missing_skills || []), 'scored', job.id);
      db.prepare('INSERT INTO events (job_id, event_type, payload) VALUES (?, ?, ?)')
        .run(job.id, 'scored', JSON.stringify({ fit_score: result.fit_score, min_fit_score_to_apply: minScore }));
      scored++;
      const qualify = result.fit_score >= minScore ? ' ✅ QUALIFIES' : ' ❌ below threshold';
      console.log(`#${job.id} ${job.company} — ${result.fit_score}/100${qualify}`);
    } catch (e) {
      failed++;
      db.prepare('UPDATE jobs SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run('error', job.id);
      console.log(`#${job.id} ${job.company} — ERROR: ${e.message}`);
    }
  }

  console.log(`\n─── Results ───────────────────────────────────`);
  const top = db.prepare('SELECT id, title, company, fit_score, rationale, missing_skills FROM jobs ORDER BY fit_score DESC LIMIT 7').all();
  top.forEach(j => {
    const flag = (j.fit_score || 0) >= minScore ? '✅' : '❌';
    console.log(`${flag} #${j.id} | ${j.fit_score}/100 | ${j.company} | ${j.title}`);
  });

  const qualifying = top.filter(j => (j.fit_score || 0) >= minScore);
  console.log(`\nSummary: scored=${scored}, failed=${failed}, qualifying (>=${minScore}): ${qualifying.length}`);

  if (qualifying.length > 0) {
    console.log('\n─── Top qualifying job rationale ───────────────');
    const top1 = qualifying[0];
    console.log(`Job #${top1.id}: ${top1.title} @ ${top1.company}`);
    console.log(`Score: ${top1.fit_score}/100`);
    console.log(`Rationale: ${top1.rationale}`);
    console.log(`Missing: ${top1.missing_skills}`);
  }
})().catch(e => { console.error(e.stack); process.exit(1); });
