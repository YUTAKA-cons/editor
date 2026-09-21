const fs = require('fs');
const path = require('path');
const os = require('os');
const db = require('./database');
const readline = require('readline');

const brainDir = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');

async function importPastLogs() {
  if (!fs.existsSync(brainDir)) {
    console.error("Brain directory not found:", brainDir);
    return;
  }

  const convDirs = fs.readdirSync(brainDir);
  let importedCount = 0;

  for (const conv of convDirs) {
    const transcriptPath = path.join(brainDir, conv, '.system_generated', 'logs', 'transcript.jsonl');
    
    if (fs.existsSync(transcriptPath)) {
      const fileStream = fs.createReadStream(transcriptPath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      for await (const line of rl) {
        try {
          const step = JSON.parse(line);
          if (step.tool_calls && Array.isArray(step.tool_calls)) {
            for (const call of step.tool_calls) {
              if (call.name === 'default_api:view_file' || call.name === 'view_file' || call.name === 'default_api:read_file' || call.name === 'read_file') {
                const args = typeof call.args === 'string' ? JSON.parse(call.args) : call.args;
                let absolutePath = args.AbsolutePath || args.FilePath || '';
                if (absolutePath.startsWith('"') && absolutePath.endsWith('"')) {
                  absolutePath = JSON.parse(absolutePath);
                }
                
                if (absolutePath.endsWith('SKILL.md')) {
                  const skillDir = path.dirname(absolutePath);
                  const skillName = path.basename(skillDir);
                  const timestamp = step.created_at;
                  
                  // Insert into database if it doesn't already exist to avoid duplicates
                  await new Promise((resolve) => {
                    db.get(
                      `SELECT id FROM telemetry WHERE conversation_id = ? AND skill_name = ? AND timestamp >= datetime(?, '-1 minute') AND timestamp <= datetime(?, '+1 minute')`, 
                      [conv, skillName, timestamp, timestamp], 
                      (err, row) => {
                        if (row) {
                          // Already exists
                          resolve();
                        } else {
                          db.run(
                            `INSERT INTO telemetry (trace_id, conversation_id, skill_name, skill_path, duration_ms, status, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                            ['past_import', conv, skillName, absolutePath, 1000, 'success', timestamp],
                            function(err) {
                              if (err) console.error("Error inserting:", err);
                              else importedCount++;
                              resolve();
                            }
                          );
                        }
                      }
                    );
                  });
                }
              }
            }
          }
        } catch (e) {
          // ignore parsing error for single lines
        }
      }
    }
  }

  console.log(`Finished importing past logs. Imported ${importedCount} records.`);
}

importPastLogs().then(() => {
  // Wait a moment to let sqlite finish
  setTimeout(() => process.exit(0), 1000);
});
