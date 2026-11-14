import Database from 'better-sqlite3';
const db = new Database('syndicnet.db');
try {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'landing_page_config'").get() as any;
  console.log('VALUE:', row?.value);
} catch (e) {
  console.error('ERROR:', e);
}
