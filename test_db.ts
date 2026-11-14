import Database from 'better-sqlite3';
try {
  const db = new Database('syndicnet.db');
  const row = db.prepare("SELECT value FROM settings WHERE key = 'landing_page_config'").get();
  console.log('Landing page config:', row);
} catch (error) {
  console.error('Database error:', error);
}
