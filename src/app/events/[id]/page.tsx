import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { getActivityEventById } from '@/lib/db';
import { listActivityMaterials } from '@/lib/activity-materials';
import { EVENT_TYPES } from '@/lib/events-ui';
import { MaterialSection } from '@/components/events/MaterialSection';
import { safeExternalUrl } from '@/components/events/MaterialLink';

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) notFound();
  const event = await getActivityEventById(Number(id));
  if (!event) notFound();
  const materials = await listActivityMaterials(Number(id));
  const source = safeExternalUrl(event.url);
  return <div className="space-y-8">
    <Link href="/events" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-100"><ArrowLeft size={16} />社区活动</Link>
    <header className="space-y-4"><p className="text-sm text-emerald-300">{event.event_date.slice(0, 10)} · {EVENT_TYPES.find(t => t.value === event.event_type)?.label || '其他'}</p><h1 className="break-words text-2xl font-bold text-slate-100 sm:text-3xl">{event.event_name}</h1><p className="text-sm text-slate-400">{[event.location, event.venue].filter(Boolean).join(' · ')}</p>
      {event.description && <p className="max-w-4xl whitespace-pre-wrap break-words text-sm leading-7 text-slate-300">{event.description}</p>}
      {source && <a href={source} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-emerald-300">官网原文<ExternalLink size={16} /></a>}
    </header>
    <dl className="grid grid-cols-3 gap-4 border-y border-slate-700 py-5">{[['参与人数', event.participants], ['报名人数', event.registrations], ['线上观看', event.online_viewers]].map(([label, value]) => <div key={label}><dt className="text-sm text-slate-400">{label}</dt><dd className="mt-2 text-xl font-semibold tabular-nums text-slate-100">{Number(value).toLocaleString()}</dd></div>)}</dl>
    <MaterialSection materials={materials} />
  </div>;
}
