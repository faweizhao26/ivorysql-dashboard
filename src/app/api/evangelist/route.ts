import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAvailableEvangelistAvatar, normalizeEvangelistAvatarUrl } from '@/lib/evangelist-avatar';
import { saveEvangelistContribution } from '@/lib/evangelist-store';

export async function GET(request: Request) {
  const pool = getDb();
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
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : undefined }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const pool = getDb();
    const body = await request.json();

    // Handle participant creation
    if (body.name && !body.participant_id && !body.category) {
      let avatarUrl = normalizeEvangelistAvatarUrl(body.avatar_url);
      if (!avatarUrl) {
        const members = await pool.query('SELECT id, avatar_url FROM evangelist_participants ORDER BY id');
        avatarUrl = getAvailableEvangelistAvatar(members.rows);
      }
      const r = await pool.query(
        `INSERT INTO evangelist_participants (name, avatar_url, title, bio, joined_date) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [body.name, avatarUrl, body.title || null, body.bio || null, body.joined_date || null]
      );
      return NextResponse.json({ id: r.rows[0].id, success: true });
    }

    // Handle contribution creation
    if (body.participant_id && body.category && body.type) {
      const result = await saveEvangelistContribution({ ...body, id: undefined });
      return NextResponse.json({ ...result, success: true });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : undefined }, { status: error instanceof RangeError ? 400 : 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const pool = getDb();
    const body = await request.json();

    // Update participant
    if (body.id && body.name) {
      const avatarUrl = normalizeEvangelistAvatarUrl(body.avatar_url);
      await pool.query(
        `UPDATE evangelist_participants SET name=$2, avatar_url=CASE WHEN $7 THEN $3 ELSE avatar_url END, title=$4, bio=$5, joined_date=$6 WHERE id=$1`,
        [body.id, body.name, avatarUrl, body.title || null, body.bio || null, body.joined_date || null, Object.hasOwn(body, 'avatar_url')]
      );
      return NextResponse.json({ success: true });
    }

    // Update contribution
    if (body.id && body.category) {
      await saveEvangelistContribution(body);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : undefined }, { status: error instanceof RangeError ? 400 : 500 });
  }
}

export async function DELETE(request: Request) {
  const pool = getDb();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const type = searchParams.get('type');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  try {
    if (type === 'contribution') {
      await pool.query('DELETE FROM evangelist_contributions WHERE id=$1', [id]);
    } else {
      await pool.query('DELETE FROM evangelist_participants WHERE id=$1', [id]);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : undefined }, { status: 500 });
  }
}
