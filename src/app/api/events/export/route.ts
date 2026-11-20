import { eventAccess } from '@/lib/event-access';
import { listWorkspaceEvents } from '@/lib/event-workspace-store';
import { eventMatches, type WorkspaceFilters } from '@/lib/event-workspace';
import { buildEventWorkbook } from '@/lib/event-workbook';
export const runtime='nodejs';
export async function GET(request:Request){
  if(await eventAccess()!=='admin')return Response.json({error:'仅管理员可导出活动记录和内部计划'},{status:403});
  try{
    const p=new URL(request.url).searchParams;
    const filters:WorkspaceFilters=Object.fromEntries(['year','month','type','role','format','status','series','search'].map(key=>[key,p.get(key)||undefined]));
    if(filters.year&&!/^\d{4}$/.test(filters.year)||filters.month&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(filters.month))return Response.json({error:'导出日期范围无效'},{status:400});
    const items=(await listWorkspaceEvents()).filter(e=>eventMatches(e,{...filters,unscheduled:p.get('unscheduled')==='true'}));
    const buffer=await buildEventWorkbook(items);
    return new Response(new Uint8Array(buffer),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="ivorysql-events.xlsx"; filename*=UTF-8''${encodeURIComponent('IvorySQL 社区活动统计.xlsx')}`,'Cache-Control':'private, no-store'}});
  }catch(error){console.error('Event export failed:',error);return Response.json({error:'活动导出失败，请重试'},{status:500});}
}
