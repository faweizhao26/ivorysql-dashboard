import ExcelJS from 'exceljs';
import type { ActivityEventParsed } from './db';
import { readWorkspace } from './event-workspace';
import { EVENT_TYPES } from './events-ui';

export async function buildEventWorkbook(events: ActivityEventParsed[]): Promise<Buffer> {
  const book = new ExcelJS.Workbook(); book.creator = 'IvorySQL';
  const records = book.addWorksheet('参与和组织', { views: [{ state: 'frozen', ySplit: 3 }] });
  const plans = book.addWorksheet('活动计划', { views: [{ state: 'frozen', ySplit: 1 }] });
  records.columns = [58,16,18,15,18,16,48,16,48,16,16].map(width => ({ width }));
  records.mergeCells('A1:K1'); records.getCell('A1').value = 'IvorySQL 社区活动一览表';
  records.addRow(['活动名称','时间','活动类型','参与形式','地点','覆盖人数','活动预告','','活动总结','','留资数量']);
  records.addRow(['','','','','','','文章链接','浏览量','文章链接','浏览量','']);
  records.mergeCells('G2:H2'); records.mergeCells('I2:J2');
  for (const c of ['A','B','C','D','E','F','K']) records.mergeCells(`${c}2:${c}3`);
  const ordered = [...events].sort((a,b) => (a.event_date || readWorkspace(a).month || '9999').localeCompare(b.event_date || readWorkspace(b).month || '9999') || (a.id || 0)-(b.id || 0));
  for (const e of ordered.filter(e => e.event_date || ['recorded','completed'].includes(readWorkspace(e).status))) {
    const w = readWorkspace(e), pre = w.promotions.filter(p=>p.kind==='preview'), post = w.promotions.filter(p=>p.kind==='recap');
    const date = w.actual_date || e.event_date;
    const readings = (items: typeof pre) => items.length===1 ? items[0].views : items.map(p=>p.views==null?'未录入':String(p.views)).join('\n') || null;
    const row = records.addRow([e.event_name,date?new Date(`${date}T00:00:00Z`):null,e.event_type==='webinar'?'直播活动':w.format?`${w.format}活动`:EVENT_TYPES.find(t=>t.value===e.event_type)?.label||'其他',w.role||null,e.location||null,w.coverage||(e.participants>0?e.participants:null),pre.map(p=>p.url).join('\n')||null,readings(pre),post.map(p=>p.url).join('\n')||null,readings(post),w.leads]);
    row.getCell(2).numFmt='yyyy-mm-dd';
    if(pre.length===1)row.getCell(7).value={text:pre[0].url,hyperlink:pre[0].url};
    if(post.length===1)row.getCell(9).value={text:post[0].url,hyperlink:post[0].url};
  }
  plans.columns=[16,12,58,16,16,28,35].map(width=>({width}));
  plans.addRow(['季度','月份','活动主题','活动形式','主办/参与','参与方式','合作伙伴']);
  let group='',start=2;
  const mergeGroup=(end:number)=>{if(group&&end>start)plans.mergeCells(start,1,end,1);};
  for(const e of [...ordered].sort((a,b)=>(readWorkspace(a).month||a.event_date.slice(0,7)||'9999').localeCompare(readWorkspace(b).month||b.event_date.slice(0,7)||'9999'))){
    const w=readWorkspace(e),month=w.month||e.event_date.slice(0,7),q=month?`${month.slice(0,4)} Q${Math.ceil(Number(month.slice(5))/3)}`:'未排期';
    const row=plans.addRow([q,month?Number(month.slice(5)):null,e.event_name,w.format||null,w.role||null,w.participation||null,w.partners.join('、')||null]);
    if(q!==group){mergeGroup(row.number-1);group=q;start=row.number;}
  }
  mergeGroup(plans.rowCount);
  for(const sheet of [records,plans]){
    sheet.eachRow((row,index)=>{
      let lines=1;
      row.eachCell(cell=>{const value=cell.value;const content=value&&typeof value==='object'&&'text' in value?String(value.text):typeof value==='string'?value:'';const width=sheet.getColumn(cell.col).width||15;lines=Math.max(lines,...content.split('\n').map(line=>Math.ceil([...line].reduce((n,c)=>n+(c.charCodeAt(0)>255?2:1),0)/Math.max(5,width-2))));});
      row.height=sheet===records&&index===1?32:index<=(sheet===records?3:1)?25:Math.max(46,lines*17+12);
      row.eachCell({includeEmpty:true},cell=>{
        cell.alignment={vertical:'middle',wrapText:true};cell.font={name:'Microsoft YaHei',size:11};cell.border={bottom:{style:'thin',color:{argb:'FFE0E5EC'}}};
        if(index<=(sheet===records?3:1)){cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEAF1FB'}};cell.font={name:'Microsoft YaHei',size:11,bold:true};}
      });
    });
    sheet.pageSetup={orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0};
  }
  return Buffer.from(await book.xlsx.writeBuffer());
}
