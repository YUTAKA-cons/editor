const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'analytics.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initDb();
  }
});

function initDb() {
  db.serialize(() => {
    // telemetry table
    db.run(`
      CREATE TABLE IF NOT EXISTS telemetry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trace_id TEXT,
        conversation_id TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        skill_name TEXT,
        skill_path TEXT,
        duration_ms INTEGER,
        status TEXT,
        error_message TEXT
      )
    `);

    // skills table (to manage archive status)
    db.run(`
      CREATE TABLE IF NOT EXISTS skills_meta (
        skill_name TEXT PRIMARY KEY,
        skill_path TEXT,
        archived INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // schedules table
    db.run(`
      CREATE TABLE IF NOT EXISTS schedules (
        task_id TEXT PRIMARY KEY,
        cron_expression TEXT,
        duration_seconds INTEGER,
        prompt TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });
}

module.exports = db;
