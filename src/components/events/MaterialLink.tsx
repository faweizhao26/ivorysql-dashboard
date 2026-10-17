import React from 'react';
import Image from 'next/image';
import { ExternalLink } from 'lucide-react';
import type { ActivityMaterial } from '@/lib/activity-materials';

export function safeExternalUrl(value?: string | null) {
  if (!value) return undefined;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.toString() : undefined; } catch { return undefined; }
}

export function MaterialLink({ material }: { material: ActivityMaterial }) {
  const url = safeExternalUrl(material.url);
  const thumbnail = safeExternalUrl(material.thumbnail_url);
  const source = safeExternalUrl(material.source_url);
  return <article className="min-w-0 rounded-lg border border-slate-700 p-4">
    {thumbnail && <a href={url || thumbnail} target="_blank" rel="noopener noreferrer" className="relative mb-3 block h-48"><Image src={thumbnail} alt={material.title} loading="lazy" fill unoptimized className="rounded object-contain" /></a>}
    <h3 className="break-words text-base font-medium text-slate-100">{url ? <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-2 hover:text-emerald-300">{material.title}<ExternalLink size={16} className="mt-1 shrink-0" /></a> : material.title}</h3>
    {material.access_note && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-300">{material.access_note}</p>}
    {source && <a href={source} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-xs text-slate-400 hover:text-emerald-300">资料来源</a>}
  </article>;
}
