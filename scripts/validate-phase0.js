'use strict';

/**
 * Phase 0 Validation Script
 * Run with the API server already started: npm run validate
 * Or run standalone (skips live HTTP checks): node scripts/validate-phase0.js
 */

require('dotenv').config();
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT    = process.env.PORT || 3000;
const results = [];

function pass(label, detail = '') {
  const msg = detail ? `${label} — ${detail}` : label;
  console.log(`  ✅ PASS  ${msg}`);
  results.push({ label, status: 'PASS' });
}
function fail(label, detail = '') {
  const msg = detail ? `${label} — ${detail}` : label;
  console.log(`  ❌ FAIL  ${msg}`);
  results.push({ label, status: 'FAIL' });
}
function warn(label, detail = '') {
  const msg = detail ? `${label} — ${detail}` : label;
  console.log(`  ⚠️  WARN  ${msg}`);
  results.push({ label, status: 'WARN' });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 5000 }, res => {
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () => {
        try   { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, body }); }
      });
    });
    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function validate() {
  console.log('\n🔍  Phase 0 Validation\n' + '═'.repeat(52));

  // ── Environment ──────────────────────────────────────────
  console.log('\n📋  Environment');
  fs.existsSync('.env')
     ? pass('.env file exists')
     : warn('.env file missing', 'Copy .env.example → .env and fill secrets (optional for API-only testing)');

  fs.existsSync('.env.example')
    ? pass('.env.example exists')
    : fail('.env.example missing');

  const { OPENROUTER_API_KEY, TELEGRAM_BOT_TOKEN } = process.env;
  (OPENROUTER_API_KEY && !OPENROUTER_API_KEY.includes('your_'))
    ? pass('OPENROUTER_API_KEY set')
    : warn('OPENROUTER_API_KEY not configured', 'Required for Phase 2');

  (TELEGRAM_BOT_TOKEN && !TELEGRAM_BOT_TOKEN.includes('your_'))
    ? pass('TELEGRAM_BOT_TOKEN set')
    : warn('TELEGRAM_BOT_TOKEN not configured', 'Required for Telegram commands');

  // ── Dependencies ─────────────────────────────────────────
  console.log('\n📦  Dependencies');
  if (fs.existsSync('node_modules')) {
    pass('node_modules present');
     // better-sqlite3 replaced by built-in node:sqlite (no npm package)
     // node-telegram-bot-api replaced by direct axios HTTP polling (no third-party library)
     for (const dep of ['express', 'dotenv', 'winston', 'axios', 'playwright']) {
      fs.existsSync(path.join('node_modules', dep))
        ? pass(`${dep} installed`)
        : fail(`${dep} missing`, 'Run: npm install');
    }
  } else {
    fail('node_modules missing', 'Run: npm install');
  }

  // ── Database ─────────────────────────────────────────────
  console.log('\n🗄️   Database');
  try {
    const { initDatabase, closeDatabase } = require('../src/db/database');
    const db = initDatabase();

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
    for (const t of ['jobs', 'events', 'applications', 'sessions']) {
      tables.includes(t)
        ? pass(`Table '${t}' exists`)
        : fail(`Table '${t}' missing`);
    }

    const sessionRow = db.prepare("SELECT * FROM sessions WHERE platform = 'linkedin'").get();
    sessionRow ? pass('LinkedIn session row seeded') : fail('LinkedIn session row missing');

    closeDatabase();
    pass('DB opens and closes cleanly');
  } catch (err) {
    fail('DB initialisation failed', err.message);
  }

  // ── Live HTTP endpoints ───────────────────────────────────
  console.log('\n🌐  HTTP Endpoints (requires server running on port ' + PORT + ')');
  let serverRunning = false;
  try {
    const r = await httpGet(`http://localhost:${PORT}/health/ping`);
    if (r.status === 200 && r.body.pong) {
      pass('GET /health/ping → 200 pong');
      serverRunning = true;
    } else {
      fail('GET /health/ping unexpected response', JSON.stringify(r.body));
    }
  } catch {
    warn('GET /health/ping unreachable', 'Start server with: npm start, then re-run validate');
  }

  if (serverRunning) {
    try {
      const r = await httpGet(`http://localhost:${PORT}/health`);
      if (r.status === 200 && r.body.status === 'ok') {
        pass('GET /health → 200 ok');
        pass(`Stats: ${JSON.stringify(r.body.stats)}`);
        pass(`LinkedIn session: ${r.body.linkedin_session?.status}`);
      } else {
        fail('GET /health response unexpected', JSON.stringify(r.body));
      }
    } catch (err) {
      fail('GET /health failed', err.message);
    }
  }

  // ── n8n Workflow files ────────────────────────────────────
  console.log('\n🔄  n8n Workflows');
  const workflows = [
    'n8n-workflows/phase0-foundation.json',
    'n8n-workflows/phase1-discovery.json',
    'n8n-workflows/phase2-scoring.json',
    'n8n-workflows/phase3-package-gen.json',
    'n8n-workflows/phase4-assisted-apply.json',
  ];
  for (const wf of workflows) {
    if (!fs.existsSync(wf)) { fail(`${wf} missing`); continue; }
    try   { JSON.parse(fs.readFileSync(wf, 'utf8')); pass(`${wf} is valid JSON`); }
    catch { fail(`${wf} is invalid JSON`); }
  }

  // ── Directory structure ───────────────────────────────────
  console.log('\n📁  Directory Structure');
  const dirs = [
    'src', 'src/db', 'src/routes', 'src/services', 'src/utils',
    'n8n-workflows', 'scripts', 'playwright', 'artifacts', 'kpi', 'checklist',
  ];
  for (const d of dirs) {
    fs.existsSync(d) ? pass(`/${d}/`) : fail(`/${d}/ missing`);
  }

  // ── Summary ───────────────────────────────────────────────
  console.log('\n' + '═'.repeat(52));
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;
  console.log(`\n📊  ${passed} passed  ${failed} failed  ${warned} warnings\n`);

  if (failed === 0) {
    console.log('✅  Phase 0 PASSED — ready for Phase 1!\n');
  } else {
    console.log(`❌  Phase 0 FAILED — fix ${failed} issue(s) above before continuing.\n`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

validate().catch(err => { console.error('Validation error:', err); process.exit(1); });
