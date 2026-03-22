'use strict';

require('dotenv').config();
const { initDatabase, closeDatabase } = require('../src/db/database');
const logger = require('../src/utils/logger');

(async () => {
  try {
    logger.info('Initialising database...');
    const db = initDatabase();

    const tables   = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    const indexes  = db.prepare("SELECT name FROM sqlite_master WHERE type='index' ORDER BY name").all();
    const sessions = db.prepare('SELECT * FROM sessions').all();
    const jobCount = db.prepare('SELECT COUNT(*) as c FROM jobs').get().c;

    logger.info(`Tables  : ${tables.map(t => t.name).join(', ')}`);
    logger.info(`Indexes : ${indexes.map(i => i.name).join(', ')}`);
    logger.info(`Jobs    : ${jobCount}`);
    logger.info(`Sessions: ${JSON.stringify(sessions)}`);

    closeDatabase();
    logger.info('✅ Database initialisation complete');
    process.exit(0);
  } catch (err) {
    logger.error('❌ Database initialisation failed:', err.message);
    process.exit(1);
  }
})();
