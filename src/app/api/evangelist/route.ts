import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || '',
  ssl: { rejectUnauthorized: false }
});

export async function GET() {
  try {
    const result = await pool.query(
      'SELECT * FROM evangelist_participants ORDER BY points DESC, name ASC'
    );
    return NextResponse.json(result.rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, avatar_url, title, points, contribution_links, joined_date, bio } = body;
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const result = await pool.query(
      `INSERT INTO evangelist_participants (name, avatar_url, title, points, contribution_links, joined_date, bio)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [name, avatar_url || null, title || null, points || 0,
       JSON.stringify(contribution_links || []), joined_date || null, bio || null]
    );
    return NextResponse.json({ id: result.rows[0].id, success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, avatar_url, title, points, contribution_links, joined_date, bio } = body;
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await pool.query(
      `UPDATE evangelist_participants SET name=$2, avatar_url=$3, title=$4, points=$5, contribution_links=$6, joined_date=$7, bio=$8, updated_at=NOW()
       WHERE id=$1`,
      [id, name, avatar_url || null, title || null, points || 0,
       JSON.stringify(contribution_links || []), joined_date || null, bio || null]
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    await pool.query('DELETE FROM evangelist_participants WHERE id=$1', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
