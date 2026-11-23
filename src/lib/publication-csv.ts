export const templateChannels = [
  ['wechat', '微信公众号'], ['csdn', 'CSDN'], ['oschina', 'OSC'], ['sf', '思否'],
  ['zhihu', '知乎'], ['modb', '墨天轮'], ['itpub', 'ITPUB'], ['ctoutiao', '51CTO'],
  ['toutiao', '今日头条'], ['cnblogs', '博客园'], ['ifclub', 'IFCLUB'], ['juejin', '掘金'],
  ['official', '官网'],
] as const;

export type PublicationSheet = 'plan' | 'actual';
export interface PublicationExportRow { date: string | null; title: string; channels: string[] }

function cell(value: string) {
  const literal = /^[\t\r\n]|^\s*[=+@-]/.test(value) ? "'" + value : value;
  return '"' + literal.replaceAll('"', '""') + '"';
}

export function publicationCsv(sheet: PublicationSheet, year: string | null, records: PublicationExportRow[]) {
  const period = year ? year + ' 年' : '历年';
  const title = sheet === 'plan' ? period + '内容发布排期' : 'IvorySQL 社区 ' + period + '内容实际发布情况';
  const header = ['时间', '发布内容', ...templateChannels.map(([, label]) => label)];
  // Keep any legacy platform that is not in the template visible instead of dropping its mark.
  const keys: string[] = templateChannels.map(([key]) => key);
  const extra = [...new Set(records.flatMap(r => r.channels))].filter(k => !keys.includes(k)).sort();
  keys.push(...extra); header.push(...extra);
  const rows = [[title, ...Array(header.length - 1).fill('')], header,
    ...records.map(r => [r.date ?? '', r.title, ...keys.map(k => r.channels.includes(k) ? '✅' : '')])];
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
