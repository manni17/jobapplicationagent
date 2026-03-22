'use strict';

/**
 * Telegram polling service — Phase 0
 *
 * Implemented using only the raw Telegram Bot API over HTTPS (via axios).
 * No third-party Telegram library is used, removing all vulnerable transitive
 * dependencies (request, form-data, tough-cookie, etc.).
 */

const axios  = require('axios');
const logger = require('../utils/logger');

// Lazy-loaded so startup never fails if optional services are unavailable
function getLLM()      { return require('./llm'); }
function getLinkedIn() { return require('./linkedin'); }
function getPlaywright() {
  try { return require('../../playwright/browser'); }
  catch { return null; }
}

const state = { polling: false, offset: 0 };

function baseUrl() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  return `https://api.telegram.org/bot${token}`;
}

/** Restrict commands to explicitly listed chat IDs when configured. */
function isAllowedChat(chatId) {
  const raw = (process.env.TELEGRAM_ALLOWED_CHAT_IDS || '').trim();
  if (!raw) return true;
  return raw.split(',').map(id => id.trim()).includes(String(chatId));
}

/** Send a text message to a chat. */
async function sendMessage(chatId, text, extra = {}) {
  try {
    await axios.post(`${baseUrl()}/sendMessage`, {
      chat_id:    chatId,
      text,
      parse_mode: extra.parse_mode || undefined,
      disable_web_page_preview: extra.disable_web_page_preview || undefined,
    }, { timeout: 10000 });
  } catch (err) {
    logger.error(`sendMessage to ${chatId} failed: ${err.message}`);
  }
}

/** Dispatch a single Telegram message to the right handler. */
async function handleMessage(msg) {
  const chatId   = msg.chat?.id;
  const username = msg.from?.username || msg.from?.first_name || String(chatId);
  // Normalise /command_42 → /command 42 (inline-button style)
  const text = (msg.text || '').trim().replace(/^(\/\w+)_(\d+)/, '$1 $2');

  if (!chatId || !isAllowedChat(chatId)) return;
  if (!text.startsWith('/')) return;

  const [cmd, arg1] = text.split(/\s+/);

  if      (cmd === '/ping')    await handlePing(chatId);
  else if (cmd === '/status')  await handleStatus(chatId);
  else if (cmd === '/help')    await handleHelp(chatId);
  else if (cmd === '/scan')    await handleScan(chatId);
  else if (cmd === '/topjobs') await handleTopJobs(chatId);
  else if (cmd === '/review')  await handleReview(chatId, arg1);
  else if (cmd === '/approve') await handleApprove(chatId, arg1, username);
  else if (cmd === '/reject')  await handleReject(chatId, arg1);
  else if (cmd === '/relogin') await handleRelogin(chatId);
  else if (cmd === '/apply')   await sendMessage(chatId, '⚙️ /apply automation is Phase 4. Approve a cover letter first with /approve <job_id>.');
  else                         await sendMessage(chatId, 'Unknown command. Send /help for the full list.');
}

async function handlePing(chatId) {
  const uptimeSec = Math.floor(process.uptime());
  await sendMessage(chatId, `🏓 Pong! Bot is alive.\nUptime: ${uptimeSec}s`);
}

async function handleStatus(chatId) {
  try {
    const port   = process.env.PORT || 3000;
    const { data } = await axios.get(`http://localhost:${port}/health`, { timeout: 5000 });
    await sendMessage(chatId, formatStatus(data), { parse_mode: 'HTML' });
  } catch (err) {
    await sendMessage(chatId, `❌ Health check failed: ${err.message}`);
  }
}

async function handleHelp(chatId) {
  await sendMessage(chatId, HELP_TEXT, { parse_mode: 'HTML' });
}

/** Long-poll loop — runs until state.polling is set to false. */
async function poll() {
  while (state.polling) {
    try {
      const res = await axios.get(`${baseUrl()}/getUpdates`, {
        params: {
          offset:           state.offset,
          timeout:          25,
          allowed_updates:  ['message'],
        },
        timeout: 30000,
      });

      const updates = res.data?.result || [];
      for (const update of updates) {
        state.offset = update.update_id + 1;
        if (update.message) {
          handleMessage(update.message).catch(err =>
            logger.error('Message handler error:', err.message)
          );
        }
      }
    } catch (err) {
      if (state.polling) {
        logger.error('Telegram poll error:', err.message);
        // Back-off on error to avoid hammering the API
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }
}

function startTelegramBot() {
  if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  state.polling = true;
  state.offset  = 0;
  poll(); // fire-and-forget loop
  logger.info('Telegram bot started (raw-polling mode, no third-party library)');
}

function stopTelegramBot() {
  state.polling = false;
}

// ── Formatters ────────────────────────────────────────────────

function formatStatus(h) {
  const s    = h.stats || {};
  const sess = h.linkedin_session || {};
  const up   = h.uptime_seconds || 0;
  const sesEmoji = { healthy: '✅', degraded: '⚠️', logged_out: '🔒', error: '❌', unknown: '❓' }[sess.status] || '❓';

  return [
    '<b>Job Application Agent — Status</b>',
    '',
    `Status: ${h.status === 'ok' ? '✅ Healthy' : '❌ Degraded'}`,
    `Uptime: ${Math.floor(up / 60)}m ${up % 60}s   Phase: ${h.phase || 0}`,
    '',
    '<b>📊 Pipeline:</b>',
    `• Total jobs: <b>${s.total_jobs || 0}</b>`,
    `• New (unscored): ${s.new_jobs || 0}`,
    `• Scored: ${s.scored_jobs || 0}`,
    `• Applied: ${s.applied_jobs || 0}`,
    `• Pending approval: ${s.pending_approval || 0}`,
    '',
    '<b>🔗 LinkedIn Session:</b>',
    `${sesEmoji} ${sess.status || 'unknown'}`,
    `Last check: ${sess.last_check || 'Never'}`,
    `Consecutive failures: ${sess.consecutive_failures || 0}`,
  ].join('\n');
}

const HELP_TEXT = [
  '<b>Job Application Agent — Commands</b>',
  '',
  '<b>Discovery:</b>',
  '/scan — Scrape LinkedIn for new jobs',
  '/topjobs — Show top 10 scored jobs',
  '',
  '<b>Review &amp; Approve:</b>',
  '/review &lt;job_id&gt; — View job score and rationale',
  '/approve &lt;job_id&gt; — Generate cover letter and approve',
  '/reject &lt;job_id&gt; — Skip this job',
  '',
  '<b>Health:</b>',
  '/ping — Liveness check',
  '/status — Pipeline stats and session health',
  '/relogin — Re-authenticate LinkedIn session',
  '/help — This message',
].join('\n');

// ── Phase 1: Discovery ─────────────────────────────────────────
async function handleScan(chatId) {
  await sendMessage(chatId, '🔍 LinkedIn scan started… This may take 1–2 minutes.');
  try {
    const { scanLinkedIn } = getLinkedIn();
    const stats = await scanLinkedIn();
    if (stats.error) {
      await sendMessage(chatId, `❌ Scan failed: ${stats.error}`);
      return;
    }
    const msg = [
      '✅ Scan complete!',
      '',
      `• Scanned:   ${stats.scanned}`,
      `• New jobs:  ${stats.new_jobs}`,
      `• Duplicates: ${stats.duplicates}`,
      `• Errors:    ${stats.errors}`,
      '',
      stats.new_jobs > 0 ? 'Send /topjobs to see top scored jobs.' : 'No new jobs this run.',
    ].join('\n');
    await sendMessage(chatId, msg);
  } catch (err) {
    logger.error(`handleScan: ${err.message}`);
    await sendMessage(chatId, `❌ Scan error: ${err.message}`);
  }
}

async function handleTopJobs(chatId) {
  try {
    const port = process.env.PORT || 3000;
    const { data } = await axios.get(
      `http://localhost:${port}/api/jobs?limit=10&offset=0`,
      { timeout: 5000 }
    );
    const jobs = (data.jobs || []).sort((a, b) => (b.fit_score || 0) - (a.fit_score || 0)).slice(0, 10);

    if (!jobs.length) {
      await sendMessage(chatId, '💭 No jobs found. Run /scan first.');
      return;
    }

    const lines = ['<b>🏆 Top Jobs by Fit Score</b>', ''];
    jobs.forEach((j, i) => {
      const score  = j.fit_score != null ? `${j.fit_score}/100` : 'unscored';
      const remote = j.remote ? ' 🌐' : '';
      lines.push(`${i + 1}. <b>${j.title}</b>`);
      lines.push(`   🏗 ${j.company}${remote}`);
      lines.push(`   Score: <b>${score}</b>  |  #${j.id}`);
      if (j.rationale) lines.push(`   💬 ${j.rationale.slice(0, 90)}…`);
      lines.push(`   → /review_${j.id}   /approve_${j.id}`);
      lines.push('');
    });
    await sendMessage(chatId, lines.join('\n'), { parse_mode: 'HTML' });
  } catch (err) {
    logger.error(`handleTopJobs: ${err.message}`);
    await sendMessage(chatId, `❌ Error: ${err.message}`);
  }
}

// ── Phase 2: Review ─────────────────────────────────────────
async function handleReview(chatId, jobId) {
  if (!jobId) {
    await sendMessage(chatId, '❌ Usage: /review <job_id>');
    return;
  }
  try {
    const port = process.env.PORT || 3000;
    const { data: job } = await axios.get(`http://localhost:${port}/api/jobs/${jobId}`, { timeout: 5000 });
    const score   = job.fit_score != null ? `${job.fit_score}/100` : 'Not scored yet';
    const missing = (() => {
      try { return (JSON.parse(job.missing_skills || '[]')).join(', ') || 'None'; }
      catch { return job.missing_skills || 'None'; }
    })();
    const threshold = parseInt(process.env.MIN_FIT_SCORE_TO_APPLY || '70', 10);
    const qualifies = job.fit_score != null && job.fit_score >= threshold;

    const lines = [
      `<b>📋 Job #${job.id}</b>`,
      '',
      `<b>${job.title}</b>`,
      `Company:  ${job.company}`,
      `Location: ${job.location || 'Not specified'}${job.remote ? ' (Remote)' : ''}`,
      `Status:   ${job.status}`,
      '',
      `<b>Fit Score:</b> ${score}`,
      `<b>Rationale:</b> ${job.rationale || 'Not scored yet'}`,
      `<b>Missing:</b>   ${missing}`,
      '',
      qualifies
        ? `✅ Qualifies (≥70) — /approve_${job.id} to generate cover letter`
        : `⚠️ Below threshold (${threshold}) — /reject_${job.id} to skip`,
    ];
    await sendMessage(chatId, lines.join('\n'), { parse_mode: 'HTML' });
  } catch (err) {
    const msg = err.response?.status === 404 ? `❌ Job #${jobId} not found.` : `❌ Error: ${err.message}`;
    await sendMessage(chatId, msg);
  }
}

// ── Phase 3: Approve / Reject ──────────────────────────────
async function handleApprove(chatId, jobId, username) {
  if (!jobId) {
    await sendMessage(chatId, '❌ Usage: /approve <job_id>');
    return;
  }
  await sendMessage(chatId, `⏳ Generating cover letter for job #${jobId}…`);
  try {
    const port = process.env.PORT || 3000;

    // Fetch job
    const { data: job } = await axios.get(`http://localhost:${port}/api/jobs/${jobId}`, { timeout: 5000 });

    // Create application (409 = already exists, grab existing id)
    let appId;
    try {
      const { data: newApp } = await axios.post(
        `http://localhost:${port}/api/applications`,
        { job_id: job.id },
        { timeout: 5000 }
      );
      appId = newApp.id;
    } catch (createErr) {
      if (createErr.response?.status === 409) {
        appId = createErr.response.data.id;
      } else {
        throw createErr;
      }
    }

    // Generate cover letter via LLM
    const { generateCoverLetter } = getLLM();
    const { text, filePath } = await generateCoverLetter({
      jobId:        job.id,
      title:        job.title,
      company:      job.company,
      description:  job.description,
      requirements: job.requirements,
      rationale:    job.rationale,
    });

    // Mark approved
    await axios.patch(
      `http://localhost:${port}/api/applications/${appId}`,
      { status: 'approved', approved_by: username, cover_letter_path: filePath },
      { timeout: 5000 }
    );

    const preview = text.length > 800 ? text.slice(0, 800) + '\n…[truncated]' : text;
    await sendMessage(chatId, [
      `✅ Application #${appId} approved for job #${jobId}!`,
      '',
      '<b>Cover Letter:</b>',
      '──────────────',
      preview,
      '──────────────',
      `Saved: <code>${filePath}</code>`,
    ].join('\n'), { parse_mode: 'HTML' });
  } catch (err) {
    logger.error(`handleApprove: ${err.message}`);
    await sendMessage(chatId, `❌ Error: ${err.message}`);
  }
}

async function handleReject(chatId, jobId) {
  if (!jobId) {
    await sendMessage(chatId, '❌ Usage: /reject <job_id>');
    return;
  }
  try {
    const port = process.env.PORT || 3000;
    await axios.patch(`http://localhost:${port}/api/jobs/${jobId}`, { status: 'skipped' }, { timeout: 5000 });
    await sendMessage(chatId, `🚫 Job #${jobId} rejected and marked as skipped.`);
  } catch (err) {
    const msg = err.response?.status === 404 ? `❌ Job #${jobId} not found.` : `❌ Error: ${err.message}`;
    await sendMessage(chatId, msg);
  }
}

// ── Phase 4: Relogin ─────────────────────────────────────────
async function handleRelogin(chatId) {
  const pw = getPlaywright();
  if (!pw) {
    await sendMessage(chatId, '❌ Playwright not installed. Run: npm run install:playwright');
    return;
  }
  await sendMessage(chatId, [
    '🔐 Opening LinkedIn login page…',
    'Log in manually in the browser. Session check in 60s.',
  ].join('\n'));
  try {
    process.env.PLAYWRIGHT_HEADLESS = 'false';
    const context = await pw.getBrowser();
    const page    = await context.newPage();
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(60000);
    const health = await pw.checkSessionHealth(page);
    await page.close();

    const port = process.env.PORT || 3000;
    if (health.healthy) {
      await axios.patch(
        `http://localhost:${port}/api/sessions/linkedin`,
        { status: 'healthy', consecutive_failures: 0 },
        { timeout: 5000 }
      );
      await sendMessage(chatId, '✅ LinkedIn session healthy! Automation resumed.');
    } else {
      await sendMessage(chatId, '❌ Session still not healthy. Try /relogin again.');
    }
  } catch (err) {
    logger.error(`handleRelogin: ${err.message}`);
    await sendMessage(chatId, `❌ Relogin error: ${err.message}`);
  }
}

module.exports = { startTelegramBot, stopTelegramBot, sendMessage };
