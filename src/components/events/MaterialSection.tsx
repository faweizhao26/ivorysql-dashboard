import React from 'react';
import type { ActivityMaterial } from '@/lib/activity-materials';
import { MATERIAL_LABELS } from '@/lib/events-ui';
import { MaterialLink } from './MaterialLink';

export function MaterialSection({ materials }: { materials: ActivityMaterial[] }) {
  if (!materials.length) return <section className="border-t border-slate-700 py-8"><h2 className="text-lg font-semibold text-slate-100">活动资料</h2><p className="mt-3 text-sm text-slate-400">暂未添加资料</p></section>;
  return <div className="space-y-8">{Object.entries(MATERIAL_LABELS).map(([type, label]) => {
    const items = materials.filter(material => material.material_type === type);
    return items.length ? <section key={type} className="border-t border-slate-700 pt-6"><h2 className="mb-4 text-lg font-semibold text-slate-100">{label}<span className="ml-2 text-sm font-normal text-slate-400">{items.length}</span></h2><div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map(material => <MaterialLink key={material.id} material={material} />)}</div></section> : null;
  })}</div>;
}
