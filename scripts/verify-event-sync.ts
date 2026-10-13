import assert from 'node:assert/strict';
import { withDbTransaction } from '../src/lib/db';
import { persistOfficialEvent } from '../src/lib/ivorysql-events-sync';

process.loadEnvFile('.env.local');

async function verify() {
  await withDbTransaction(async client => {
    // Temporary tables shadow production names for this connection and disappear at commit.
    await client.query(`
      CREATE TEMP TABLE activity_events (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        event_name TEXT,event_date TEXT,event_type TEXT,location TEXT,description TEXT,
        url TEXT,source_url TEXT UNIQUE,participants INTEGER,registrations INTEGER,
        online_viewers INTEGER,collected_data TEXT
      ) ON COMMIT DROP;
      CREATE TEMP TABLE activity_materials (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,event_id INTEGER REFERENCES activity_events(id) ON DELETE CASCADE,
        material_type TEXT,title TEXT,url TEXT,thumbnail_url TEXT,access_note TEXT,source_url TEXT,sort_order INTEGER
      ) ON COMMIT DROP;
      CREATE UNIQUE INDEX ON activity_materials(event_id,url) WHERE url IS NOT NULL AND url <> '';
      INSERT INTO activity_events (event_name,event_date,event_type,url,participants,registrations,online_viewers,description)
      VALUES ('旧名称','2026-07-25','meetup','https://www.ivorysql.org/zh-cn/events/event-202611',42,52,123,'手工描述');
      INSERT INTO activity_materials (event_id,material_type,title,url,access_note)
      VALUES (1,'ppt','手工资料','https://pan.example.com/a','提取码：1234');
    `);
    const event = { event_name: '新名称', event_date: '2026-07-25', event_type: 'meetup', location: '南京', description: '官网描述', source_url: 'https://ivorysql.org/zh/community/events/event-202611' };
    const materials = [{ material_type: 'ppt' as const, title: '官网标题', url: 'https://pan.example.com/a' }, { material_type: 'ppt' as const, title: '领取说明', access_note: '公众号回复 PPT 获取' }];
    const transaction: typeof withDbTransaction = operation => operation(client);
    assert.ok(await persistOfficialEvent(event, materials, transaction) > 0);
    assert.equal(await persistOfficialEvent(event, materials, transaction), 0);
    const saved = (await client.query('SELECT * FROM activity_events')).rows;
    assert.equal(saved.length, 1);
    assert.deepEqual([saved[0].participants,saved[0].registrations,saved[0].online_viewers,saved[0].description], [42,52,123,'手工描述']);
    const links = (await client.query('SELECT * FROM activity_materials ORDER BY id')).rows;
    assert.equal(links.length, 2);
    assert.equal(links[0].title, '手工资料');
    assert.equal(links[0].access_note, '提取码：1234');
    await client.query('DELETE FROM activity_materials WHERE id = $1', [links[0].id]);
    assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM activity_events')).rows[0].n, 1);
    await client.query('DELETE FROM activity_events');
    assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM activity_materials')).rows[0].n, 0);
  });
  console.log('PASS: stable upsert, rerun idempotency, attendance/manual material preservation, delete and cascade (temporary tables only)');
}
verify().catch(error => { console.error(error); process.exitCode = 1; });
