const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(process.cwd(), 'data', 'stats.db');
const db = new Database(dbPath);

const jsonData = fs.readFileSync(path.join(process.cwd(), 'awesome.json'), 'utf-8');
const data = JSON.parse(jsonData);

let cumulativeStars = 0;
const dates = Object.keys(data).filter(k => k !== 'total').sort();

console.log(`Found ${dates.length} dates to import`);

const insertStmt = db.prepare(`
  INSERT OR REPLACE INTO github_stats (date, stars, forks, watchers, subscribers, open_issues, open_prs, contributors, releases_count)
  VALUES (?, ?, 0, 0, 0, 0, 0, 0, 0)
`);

for (const dateStr of dates) {
  const dayData = data[dateStr];
  if (dayData && typeof dayData.count === 'number') {
    cumulativeStars += dayData.count;
    const dateFormatted = dateStr.replace(/\//g, '-');
    insertStmt.run(dateFormatted, cumulativeStars);
    console.log(`${dateFormatted}: +${dayData.count} = ${cumulativeStars}`);
  }
}

console.log(`\nTotal stars imported: ${cumulativeStars}`);

db.close();
