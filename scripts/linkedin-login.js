'use strict';

/**
 * Manual LinkedIn login helper for Playwright profile.
 * Opens a visible Chromium window → you log in → session is saved to the profile.
 * Run: node --no-warnings scripts/linkedin-login.js
 */

require('dotenv').config();
const { chromium } = require('playwright');
const path   = require('path');
const fs     = require('fs');

const PROFILE_DIR = path.resolve(process.env.PLAYWRIGHT_PROFILE_DIR || './playwright/profiles/linkedin');
const POLL_MS     = 5000;
const MAX_WAIT_MS = 5 * 60 * 1000; // 5 minutes

(async () => {
  if (!fs.existsSync(PROFILE_DIR)) fs.mkdirSync(PROFILE_DIR, { recursive: true });

  console.log('\n🌐  Opening LinkedIn login in Playwright Chromium...');
  console.log('   Profile:', PROFILE_DIR);
  console.log('   ▶ Log in manually. Window will auto-close once session is detected.\n');

  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
  });

  const page = await ctx.newPage();
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });

  const deadline = Date.now() + MAX_WAIT_MS;
  let healthy = false;

  while (Date.now() < deadline) {
    await page.waitForTimeout(POLL_MS);

    const url = page.url();
    if (
      !url.includes('/login') &&
      !url.includes('/checkpoint') &&
      !url.includes('/challenge') &&
      !url.includes('/uas/') &&
      !url.includes('/authwall')
    ) {
      // Double check: look for feed indicator
      const feed = await page.$('div[data-control-name="feed"], .feed-identity-module, .scaffold-layout').catch(() => null);
      if (feed || url.includes('/feed') || url.includes('/in/')) {
        healthy = true;
        break;
      }
    }

    const remaining = Math.round((deadline - Date.now()) / 1000);
    process.stdout.write(`\r   Waiting for login... ${remaining}s remaining   `);
  }

  if (healthy) {
    console.log('\n\n✅  LinkedIn session detected! Saving session...');
    // Export cookies to JSON for use in scan sessions
    const cookies = await ctx.cookies();
    const cookiesPath = path.join(PROFILE_DIR, 'cookies.json');
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
    console.log(`✅  Cookies saved: ${cookies.length} cookies → ${cookiesPath}`);
    await ctx.close();
    console.log('✅  Profile saved to:', PROFILE_DIR);
    console.log('▶  You can now run: npm start → /scan  or  node scripts/validate-scan.js\n');
    process.exit(0);
  } else {
    console.log('\n\n❌  Login not completed within 5 minutes. Try again.\n');
    await ctx.close();
    process.exit(1);
  }
})().catch(e => {
  console.error('\n❌  Error:', e.message);
  process.exit(1);
});
