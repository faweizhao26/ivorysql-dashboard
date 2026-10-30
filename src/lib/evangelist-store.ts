import { withDbTransaction } from './db';
import { prepareEvangelistContribution, type EvangelistContributionDraft } from './evangelist-rules';

export async function saveEvangelistContribution(body: EvangelistContributionDraft, transaction = withDbTransaction) {
  return transaction(async client => {
    // The participant row serializes all contribution changes that share a budget.
    const member = await client.query('SELECT id FROM evangelist_participants WHERE id=$1 FOR UPDATE', [body.participant_id]);
    if (!member.rows.length) throw new RangeError('成员不存在');
    const history = await client.query('SELECT * FROM evangelist_contributions WHERE participant_id=$1 ORDER BY id', [body.participant_id]);
    const previous = body.id === undefined ? undefined : history.rows.find(row => row.id === body.id);
    if (body.id !== undefined && !previous) throw new RangeError('贡献记录不存在或不属于该成员');
    const record = prepareEvangelistContribution(body, history.rows, previous);
    const values = [record.participant_id, record.category, record.type, record.title || null, record.url || null, record.points, record.date, record.notes || null, record.rules_version, record.article_key];
    const result = previous
      ? await client.query(`UPDATE evangelist_contributions SET category=$2,type=$3,title=$4,url=$5,points=$6,date=$7,notes=$8,rules_version=$9,article_key=$10 WHERE participant_id=$1 AND id=$11 RETURNING id`, [...values, previous.id])
      : await client.query(`INSERT INTO evangelist_contributions(participant_id,category,type,title,url,points,date,notes,rules_version,article_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`, values);
    return { id: Number(result.rows[0].id), points: record.points };
  });
}
