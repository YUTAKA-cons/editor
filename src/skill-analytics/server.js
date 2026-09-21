const express = require('express');
const cors = require('cors');
const db = require('./database');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

function findSkills(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findSkills(filePath, fileList);
    } else if (file === 'SKILL.md') {
      const skillName = path.basename(path.dirname(filePath));
      if (skillName !== 'template' && skillName !== 'skills') {
        fileList.push({ name: skillName, path: filePath });
      }
    }
  }
  return fileList;
}

// 既知のスキルディレクトリをスキャンして DB (skills_meta) に初期登録する
function scanAndRegisterSkills() {
  const homeDir = os.homedir();
  const searchPaths = [
    path.join(homeDir, '.gemini', 'config', 'skills'),
    path.join(homeDir, '.gemini', 'antigravity', 'builtin', 'skills'),
    path.join(process.cwd(), 'skills'),
    path.join(process.cwd(), '.agents', 'skills')
  ];

  let allSkills = [];
  searchPaths.forEach(dir => {
    if (fs.existsSync(dir)) {
      allSkills = allSkills.concat(findSkills(dir));
    }
  });

  // DBに存在しない場合は初期登録
  allSkills.forEach(skill => {
    db.run(`INSERT OR IGNORE INTO skills_meta (skill_name, skill_path, archived) VALUES (?, ?, 0)`, [skill.name, skill.path]);
    db.run(`UPDATE skills_meta SET skill_path = ? WHERE skill_name = ? AND (skill_path IS NULL OR skill_path = '')`, [skill.path, skill.name]);
  });
}


// タスクログからスケジュールを抽出する関数
function scanSchedules() {
  const homeDir = os.homedir();
  const brainDir = path.join(homeDir, '.gemini', 'antigravity', 'brain');
  let activeSchedules = [];

  if (!fs.existsSync(brainDir)) return activeSchedules;

  try {
    const convDirs = fs.readdirSync(brainDir);
    for (const conv of convDirs) {
      const tasksDir = path.join(brainDir, conv, '.system_generated', 'tasks');
      if (fs.existsSync(tasksDir)) {
        const taskFiles = fs.readdirSync(tasksDir).filter(f => f.endsWith('.log'));
        for (const file of taskFiles) {
          const filePath = path.join(tasksDir, file);
          const logContent = fs.readFileSync(filePath, 'utf-8');
          
          if (logContent.includes('Successfully scheduled') && !logContent.toLowerCase().includes('cancelled') && !logContent.toLowerCase().includes('finished')) {
            const taskId = `${conv}/${file.replace('.log', '')}`;
            
            // パース
            const cronMatch = logContent.match(/Cron Expression: (.+)/);
            const promptMatch = logContent.match(/Prompt: (.+)/);
            const timerMatch = logContent.match(/Wait duration: (.+)/);
            
            const cron_expression = cronMatch ? cronMatch[1].trim() : null;
            const prompt = promptMatch ? promptMatch[1].trim() : '';
            const duration_seconds = timerMatch ? timerMatch[1].trim() : null;
            
            // 作成日時をファイルのmtimeから取得
            const stat = fs.statSync(filePath);
            
            activeSchedules.push({
              task_id: taskId,
              cron_expression,
              duration_seconds,
              prompt,
              created_at: stat.birthtime || stat.mtime
            });
          }
        }
      }
    }
  } catch(e) {
    console.error("Error scanning schedules:", e);
  }
  
  // ソート (新しい順)
  activeSchedules.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return activeSchedules;
}

// 1. Telemetry 受信エンドポイント
app.post('/api/telemetry', (req, res) => {
  const { trace_id = '', conversation_id = '', skill_name, skill_path, duration_ms = 0, status = 'success', error_message = '' } = req.body;
  if (!skill_name || !skill_path) return res.status(400).json({ error: 'skill_name and skill_path are required' });

  const query = `INSERT INTO telemetry (trace_id, conversation_id, skill_name, skill_path, duration_ms, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  db.run(query, [trace_id, conversation_id, skill_name, skill_path, duration_ms, status, error_message], function(err) {
    if (err) { console.error(err); return res.status(500).json({ error: err.message }); }
    db.run(`INSERT OR IGNORE INTO skills_meta (skill_name, skill_path, archived) VALUES (?, ?, 0)`, [skill_name, skill_path]);
    res.status(201).json({ id: this.lastID });
  });
});

// 2. ダッシュボード用統計データ取得
app.get('/api/skills/stats', (req, res) => {
  scanAndRegisterSkills();
  const stats = {};

  const summaryQuery = `
    SELECT m.skill_name, m.skill_path, COUNT(t.id) as usage_count, AVG(t.duration_ms) as avg_latency,
           SUM(CASE WHEN t.status = 'error' THEN 1 ELSE 0 END) as error_count,
           MAX(t.timestamp) as last_used, COALESCE(m.archived, 0) as archived
    FROM skills_meta m
    LEFT JOIN telemetry t ON m.skill_name = t.skill_name
    GROUP BY m.skill_name
  `;

  db.all(summaryQuery, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    stats.skills = rows;

    const trendQuery = `SELECT DATE(timestamp) as date, COUNT(id) as count FROM telemetry WHERE timestamp >= date('now', '-30 days') GROUP BY date ORDER BY date ASC`;
    db.all(trendQuery, [], (err, trendRows) => {
      if (err) return res.status(500).json({ error: err.message });
      stats.trend = trendRows;

      stats.schedules = scanSchedules();
      res.json(stats);
    });
  });
});

// 3. スキルに対するアクション（削除 / アーカイブ）
app.post('/api/skills/:name/action', (req, res) => {
  const skillName = req.params.name;
  const { action, skill_path } = req.body; 
  if (action === 'archive') {
    db.run(`UPDATE skills_meta SET archived = 1 WHERE skill_name = ?`, [skillName], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Archived successfully' });
    });
  } else if (action === 'delete') {
    try {
      if (skill_path && fs.existsSync(skill_path)) {
        const skillDir = path.dirname(skill_path);
        fs.renameSync(skillDir, skillDir + '.deleted.bak');
      }
      db.run(`DELETE FROM telemetry WHERE skill_name = ?`, [skillName]);
      db.run(`DELETE FROM skills_meta WHERE skill_name = ?`, [skillName]);
      res.json({ message: 'Deleted successfully' });
    } catch (e) { res.status(500).json({ error: e.message }); }
  } else {
    res.status(400).json({ error: 'Invalid action' });
  }
});

// 4. スケジュールの登録と削除 (Hooks から呼ばれる)
app.post('/api/schedules', (req, res) => {
  const { task_id, cron_expression = null, duration_seconds = null, prompt = '' } = req.body;
  if (!task_id) return res.status(400).json({ error: 'task_id is required' });

  db.run(`INSERT OR REPLACE INTO schedules (task_id, cron_expression, duration_seconds, prompt) VALUES (?, ?, ?, ?)`, 
    [task_id, cron_expression, duration_seconds, prompt], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Schedule saved' });
  });
});

app.delete('/api/schedules/:taskId', (req, res) => {
  // スラッシュが含まれるTaskId対策のためエンコード済みのものを受け取るか、bodyで受け取るか。
  // 今回は params だと厄介な場合があるので、単純にURLパラメータから。
  // express は /api/schedules/conv-id/task-id となりうる。
  const taskId = decodeURIComponent(req.params.taskId);
  db.run(`DELETE FROM schedules WHERE task_id = ?`, [taskId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Schedule deleted' });
  });
});

app.delete('/api/schedules', (req, res) => {
  const { task_id } = req.body;
  if (!task_id) return res.status(400).json({ error: 'task_id is required in body' });
  
  // ログファイル直読み方式のため、ログファイルに cancel マーカーを追記して無効化する
  try {
    const parts = task_id.split('/');
    if (parts.length === 2) {
      const conv = parts[0];
      const taskId = parts[1];
      const logPath = path.join(os.homedir(), '.gemini', 'antigravity', 'brain', conv, '.system_generated', 'tasks', `${taskId}.log`);
      if (fs.existsSync(logPath)) {
        fs.appendFileSync(logPath, '\n[Dashboard] Cancelled by user\n');
      }
    }
  } catch(e) {
    console.error("Failed to append cancel marker to log", e);
  }

  db.run(`DELETE FROM schedules WHERE task_id = ?`, [task_id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Schedule hidden successfully' });
  });
});


app.listen(PORT, () => { console.log(`Backend Server running on port ${PORT}`); });
