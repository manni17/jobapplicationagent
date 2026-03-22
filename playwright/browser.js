'use strict';

/**
 * Playwright Browser Service — Phase 4
 * Manages a persistent Chromium context for LinkedIn session stability.
 *
 * Persistent context = cookies + localStorage survive across runs,
 * so the user stays logged in without re-authenticating each time.
 */

const path = require('path');
const fs   = require('fs');
const logger = require('../src/utils/logger');

const PROFILE_DIR = () => path.resolve(process.env.PLAYWRIGHT_PROFILE_DIR || './playwright/profiles/linkedin');

async function getBrowser() {
  const { chromium } = require('playwright');
  const profilePath  = PROFILE_DIR();

  if (!fs.existsSync(profilePath)) {
    fs.mkdirSync(profilePath, { recursive: true });
  }

  const isHeadless = process.env.PLAYWRIGHT_HEADLESS !== 'false';
  const launchOptions = {
    headless: isHeadless,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
    // Mimic a real Windows Chrome to reduce bot-detection triggers
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport:  { width: 1280, height: 800 },
    locale:    'en-US',
    timezoneId: 'America/New_York',
  };

  const usePersistent = (process.env.PLAYWRIGHT_USE_PERSISTENT || 'true').toLowerCase() !== 'false';
  if (usePersistent) {
    try {
      const context = await chromium.launchPersistentContext(profilePath, launchOptions);
      logger.info(`Playwright context opened (persistent, headless=${isHeadless}, profile=${profilePath})`);
      return context;
    } catch (err) {
      logger.warn(`Persistent context failed, falling back to non-persistent mode: ${err.message}`);
    }
  }

  const browser = await chromium.launch({
    headless: launchOptions.headless,
    args: launchOptions.args,
  });
  const context = await browser.newContext({
    userAgent: launchOptions.userAgent,
    viewport: launchOptions.viewport,
    locale: launchOptions.locale,
    timezoneId: launchOptions.timezoneId,
  });
  logger.info(`Playwright context opened (non-persistent, headless=${isHeadless})`);
  return context;
}

/**
 * Check whether the LinkedIn session is still valid.
 * Returns { healthy: boolean, url: string, error?: string }
 */
async function checkSessionHealth(page) {
  try {
    await page.goto('https://www.linkedin.com/feed/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    const url = page.url();
    if (url.includes('/login') || url.includes('/checkpoint') || url.includes('/challenge') || url.includes('/authwall')) {
      return { healthy: false, url };
    }

    const loginInput = await page.$('#session_key, input[name="session_key"]');
    if (loginInput) {
      return { healthy: false, url };
    }

    const signInButton = await page.$('.nav__button-secondary, a[href*="/login"], a[data-tracking-control-name*="guest_homepage"]');
    const healthy = !signInButton;
    return { healthy, url };
  } catch (err) {
    return { healthy: false, error: err.message };
  }
}

/**
 * Take a full-page screenshot and save it to the artifacts folder.
 */
async function captureScreenshot(page, label = 'screenshot') {
  const dir      = path.resolve('./artifacts/screenshots');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filename = `${label}-${Date.now()}.png`;
  const dest     = path.join(dir, filename);
  await page.screenshot({ path: dest, fullPage: true });
  logger.info(`Screenshot saved: ${dest}`);
  return dest;
}

module.exports = { getBrowser, checkSessionHealth, captureScreenshot };
