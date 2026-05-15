import { NextResponse } from 'next/server';

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || 'NOT SET';
  const masked = dbUrl.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');

  try {
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });

    const result = await pool.query('SELECT COUNT(*) as total FROM social_stats');
    await pool.end();

    return NextResponse.json({
      ok: true,
      dbUrl: masked,
      socialStatsCount: result.rows[0].total,
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      dbUrl: masked,
      error: error.message,
    }, { status: 500 });
  }
}
