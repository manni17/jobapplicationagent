'use strict';

const fs     = require('fs');
const path   = require('path');
const axios  = require('axios');
const logger = require('../utils/logger');

const API_BASE    = () => `http://localhost:${process.env.PORT || 3000}`;
const COOKIES_PATH = () => path.resolve(process.env.PLAYWRIGHT_PROFILE_DIR || './playwright/profiles/linkedin', 'cookies.json');

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--disable-blink-features=AutomationControlled',
];
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function canonicalUrl(rawUrl) {
  try {
    const u     = new URL(rawUrl);
    const match = u.pathname.match(/\/jobs\/view\/(\d+)/);
    if (match) return `https://www.linkedin.com/jobs/view/${match[1]}/`;
    return `${u.origin}${u.pathname}`;
  } catch {
    return rawUrl;
  }
}

async function persistJob(jobData) {
  const payload = { ...jobData, canonical_url: canonicalUrl(jobData.canonical_url) };
  const res = await axios.post(`${API_BASE()}/api/jobs`, payload, { timeout: 5000 });
  return res.data;
}

function buildSearchUrl() {
  const kw     = encodeURIComponent(process.env.LINKEDIN_SEARCH_KEYWORDS || 'software engineer');
  const loc    = encodeURIComponent(process.env.LINKEDIN_SEARCH_LOCATION || 'Remote');
  const remote = process.env.LINKEDIN_SEARCH_REMOTE === 'true' ? '&f_WT=2' : '';
  return `https://www.linkedin.com/jobs/search/?keywords=${kw}&location=${loc}${remote}&f_AL=true&sortBy=DD`;
}

/**
 * Open a fresh (non-persistent) Chromium context injected with saved LinkedIn cookies.
 * Returns { browser, context, page } â€” caller must close browser when done.
 */
async function openFreshSession() {
  const cookiesPath = COOKIES_PATH();
  if (!fs.existsSync(cookiesPath)) {
    throw new Error('No saved LinkedIn session. Run: npm run linkedin-login');
  }

  const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
  const { chromium } = require('playwright');
  const isHeadless = process.env.PLAYWRIGHT_HEADLESS !== 'false';

  const browser = await chromium.launch({ headless: isHeadless, args: LAUNCH_ARGS });
  const context = await browser.newContext({
    userAgent:  USER_AGENT,
    viewport:   { width: 1280, height: 800 },
    locale:     'en-US',
    timezoneId: 'America/New_York',
  });
  await context.addCookies(cookies);
  const page = await context.newPage();

  logger.info(`Fresh Playwright session opened (headless=${isHeadless}, cookies=${cookies.length})`);
  return { browser, context, page };
}

/**
 * Verify the injected session is still valid by checking /feed/.
 */
async function checkHealth(page) {
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  const url = page.url();
  const bad = ['/login', '/checkpoint', '/challenge', '/uas/', '/authwall'];
  if (bad.some(p => url.includes(p))) return { healthy: false, url };
  const loginInput = await page.$('#session_key, input[name="session_key"]').catch(() => null);
  return { healthy: !loginInput, url };
}

const CARD_SELECTOR = 'li[data-occludable-job-id], .jobs-search-results__list-item';

function extractCards(items) {
  return items.map(item => {
    const link       = item.querySelector('a[href*="/jobs/view/"]');
    const titleEl    = item.querySelector('.job-card-list__title--link, .job-card-list__title');
    const companyEl  = item.querySelector('.job-card-container__primary-description, .artdeco-entity-lockup__subtitle');
    const locationEl = item.querySelector('.job-card-container__metadata-item, .artdeco-entity-lockup__caption');
    const remoteEl   = item.querySelector('.job-card-container__metadata-item--workplace-type');
    return {
      canonical_url: link?.href || null,
      title:         (titleEl?.innerText    || '').trim(),
      company:       (companyEl?.innerText  || '').trim(),
      location:      (locationEl?.innerText || '').trim(),
      remote:        (remoteEl?.innerText   || '').toLowerCase().includes('remote'),
    };
  }).filter(j => j.canonical_url && j.title);
}

async function scanLinkedIn() {
  const stats = { scanned: 0, new_jobs: 0, duplicates: 0, errors: 0 };

  let browser, pg;
  try {
    const session = await openFreshSession();
    browser = session.browser;
    pg      = session.page;
  } catch (err) {
    logger.error(`scanLinkedIn: cannot open session â€” ${err.message}`);
    return { ...stats, error: err.message };
  }

  try {
    // Verify session health
    const health = await checkHealth(pg);
    if (!health.healthy) {
      logger.warn(`Session check failed (url=${health.url}). Re-run: npm run linkedin-login`);
      return { ...stats, error: `Session expired. Re-run: npm run linkedin-login` };
    }
    logger.info('Session healthy â€” starting LinkedIn scan');

    const maxJobs = parseInt(process.env.LINKEDIN_MAX_JOBS_PER_SCAN || '50', 10);
    logger.info(`Starting LinkedIn scan (max ${maxJobs} jobs)`);

    await pg.goto(buildSearchUrl(), { waitUntil: 'domcontentloaded', timeout: 30000 });
    await pg.evaluate(() => window.scrollBy(0, 500));

    const collectedJobs = [];
    let pageNum = 1;

    while (collectedJobs.length < maxJobs && pageNum <= 3) {
      await pg.waitForSelector(
        'li[data-occludable-job-id], .jobs-search-results__list-item',
        { timeout: 15000 }
      ).catch(() => null);

      const cards = await pg.$$eval(
        'li[data-occludable-job-id], .jobs-search-results__list-item',
        (items) => items.map(item => {
          const link       = item.querySelector('a[href*="/jobs/view/"]');
          const titleEl    = item.querySelector('.job-card-list__title--link, .job-card-list__title');
          const companyEl  = item.querySelector('.job-card-container__primary-description, .artdeco-entity-lockup__subtitle');
          const locationEl = item.querySelector('.job-card-container__metadata-item, .artdeco-entity-lockup__caption');
          const remoteEl   = item.querySelector('.job-card-container__metadata-item--workplace-type');
          return {
            canonical_url: link?.href || null,
            title:         (titleEl?.innerText    || '').trim(),
            company:       (companyEl?.innerText  || '').trim(),
            location:      (locationEl?.innerText || '').trim(),
            remote:        (remoteEl?.innerText   || '').toLowerCase().includes('remote'),
          };
        }).filter(j => j.canonical_url && j.title)
      ).catch(() => []);

      logger.info(`Page ${pageNum}: ${cards.length} cards found`);

      for (const card of cards) {
        if (collectedJobs.length >= maxJobs) break;
        card.canonical_url = canonicalUrl(card.canonical_url);
        collectedJobs.push(card);
      }

      const nextBtn = await pg.$('button[aria-label="View next page"]').catch(() => null);
      if (!nextBtn || collectedJobs.length >= maxJobs) break;
      await nextBtn.click();
      pageNum++;
      // Anti-bot: random inter-page delay
      await new Promise(r => setTimeout(r, 3000 + Math.random() * 4000));
      await pg.evaluate(() => window.scrollBy(0, 400));
    }

    logger.info(`Fetching details for ${collectedJobs.length} jobs...`);

    for (const job of collectedJobs) {
      stats.scanned++;
      try {
        await pg.goto(job.canonical_url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await new Promise(r => setTimeout(r, 1500 + Math.random() * 1500));

        const details = await pg.evaluate(() => {
          const descEl    = document.querySelector('.jobs-description__content, #job-details, .jobs-description-content__text');
          const titleEl   = document.querySelector('h1.job-details-jobs-unified-top-card__job-title, h1.t-24, h1');
          const companyEl = document.querySelector('.job-details-jobs-unified-top-card__company-name a, .job-details-jobs-unified-top-card__company-name');
          return {
            description: (descEl?.innerText    || '').trim().slice(0, 4000),
            title:       (titleEl?.innerText   || '').trim(),
            company:     (companyEl?.innerText || '').trim(),
          };
        }).catch(() => ({}));

        if (details.title)   job.title   = details.title;
        if (details.company) job.company = details.company;
        job.description  = details.description || '';
        job.requirements = '';

        const result = await persistJob({ ...job, source: 'linkedin' });
        if (result.created) {
          stats.new_jobs++;
          logger.info(`New job: "${job.title}" @ ${job.company}`);
        } else {
          stats.duplicates++;
        }
      } catch (err) {
        stats.errors++;
        logger.error(`Job fetch error (${job.canonical_url}): ${err.message}`);
      }
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
    }
  } catch (err) {
    logger.error(`scanLinkedIn fatal: ${err.message}`);
    stats.error = err.message;
  } finally {
    try { await br.close(); } catch {}
  }

  logger.info(`Scan complete: ${JSON.stringify(stats)}`);
  return stats;
}

module.exports = { scanLinkedIn, persistJob, canonicalUrl };
