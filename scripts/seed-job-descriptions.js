'use strict';
require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync('./data/jobs.db');

const seeds = [
  {
    id: 3,
    description: [
      'Grafana Labs is looking for a Senior Backend Engineer to join the App Platform team.',
      'You will define and own APIs consumed by internal and external developers, manage API contracts,',
      'collaborate with engineering to build scalable microservices, write technical documentation and',
      'integration guides, lead API design reviews, track platform stability using observability tooling,',
      'and drive developer experience improvements.',
    ].join(' '),
    requirements: [
      '3+ years backend engineering or technical PM experience with API platforms.',
      'Experience with CI/CD pipelines, PostgreSQL or similar databases.',
      'Experience working in B2B SaaS.',
      'Strong written communication for developer-facing documentation.',
      'Understanding of microservices architecture and platform reliability.',
      'Nice to have: Redis, Docker, Go or .NET, AI-assisted development workflows.',
    ].join(' '),
  },
  {
    id: 5,
    description: [
      'TextNow is hiring a Senior Web Developer to work on its consumer web platform.',
      'Responsibilities include building and maintaining web features using React/TypeScript,',
      'owning API integration between frontend and backend services, writing technical specs',
      'and documentation, collaborating with PMs on roadmap decisions, participating in code reviews.',
    ].join(' '),
    requirements: [
      '4+ years web development experience.',
      'Strong TypeScript and React skills.',
      'REST API integration experience.',
      'CI/CD and cloud deployment experience.',
      'Nice to have: SaaS product experience, PostgreSQL.',
    ].join(' '),
  },
];

// Seed real descriptions
for (const seed of seeds) {
  db.prepare('UPDATE jobs SET description = ?, requirements = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(seed.description, seed.requirements, seed.id);
  console.log(`Seeded description for job #${seed.id}`);
}

// Reset all jobs to new so they get re-scored with real candidate profile
db.prepare('UPDATE jobs SET status = ?, fit_score = NULL, rationale = NULL, missing_skills = NULL, updated_at = datetime(\'now\')').run('new');
console.log('All 7 jobs reset to new — ready for re-score with real candidate profile.');

const jobs = db.prepare('SELECT id, company, status, length(description) as desc_len FROM jobs ORDER BY id').all();
jobs.forEach(j => console.log(`  #${j.id} ${j.company} | status=${j.status} | desc_len=${j.desc_len}`));
