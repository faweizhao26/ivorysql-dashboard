import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || '',
  ssl: { rejectUnauthorized: false }
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const participantId = searchParams.get('participant_id');

  try {
    if (participantId) {
      const contResult = await pool.query(
        'SELECT * FROM evangelist_contributions WHERE participant_id=$1 ORDER BY date DESC, id DESC',
        [participantId]
      );
      const partResult = await pool.query('SELECT * FROM evangelist_participants WHERE id=$1', [participantId]);
      return NextResponse.json({ participant: partResult.rows[0] || null, contributions: contResult.rows });
    }

    // Get all participants with total points
    const result = await pool.query(`
      SELECT p.*, COALESCE(SUM(c.points), 0) as total_points
      FROM evangelist_participants p
      LEFT JOIN evangelist_contributions c ON c.participant_id = p.id
      GROUP BY p.id
      ORDER BY total_points DESC, p.name ASC
    `);
    return NextResponse.json(result.rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Handle participant creation
    if (body.name && !body.participant_id && !body.category) {
      const r = await pool.query(
        `INSERT INTO evangelist_participants (name, avatar_url, title, bio, joined_date) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [body.name, body.avatar_url || null, body.title || null, body.bio || null, body.joined_date || null]
      );
      return NextResponse.json({ id: r.rows[0].id, success: true });
    }

    // Handle contribution creation
    if (body.participant_id && body.category && body.type) {
      const r = await pool.query(
        `INSERT INTO evangelist_contributions (participant_id, category, type, title, url, points, date, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [body.participant_id, body.category, body.type, body.title || null, body.url || null, body.points || 0, body.date || null, body.notes || null]
      );
      return NextResponse.json({ id: r.rows[0].id, success: true });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    // Update participant
    if (body.id && body.name) {
      await pool.query(
        `UPDATE evangelist_participants SET name=$2, avatar_url=$3, title=$4, bio=$5, joined_date=$6 WHERE id=$1`,
        [body.id, body.name, body.avatar_url || null, body.title || null, body.bio || null, body.joined_date || null]
      );
      return NextResponse.json({ success: true });
    }

    // Update contribution
    if (body.id && body.category) {
      await pool.query(
        `UPDATE evangelist_contributions SET category=$2, type=$3, title=$4, url=$5, points=$6, date=$7, notes=$8 WHERE id=$1`,
        [body.id, body.category, body.type, body.title || null, body.url || null, body.points || 0, body.date || null, body.notes || null]
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const type = searchParams.get('type');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  try {
    if (type === 'contribution') {
      await pool.query('DELETE FROM evangelist_contributions WHERE id=$1', [id]);
    } else {
      await pool.query('DELETE FROM evangelist_contributions WHERE participant_id=$1', [id]);
      await pool.query('DELETE FROM evangelist_participants WHERE id=$1', [id]);
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
