import { AlignmentType, Document, ExternalHyperlink, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import { reportGeneratedAt, type ReportDocument, type ReportLine, type ReportTable } from './operations-report';

function wordTable(table: ReportTable) {
  const widths = table.columns.map((_,i) => i === 0 ? 3000 : Math.floor(6000 / (table.columns.length - 1)));
  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    columnWidths: widths,
    margins: { top:100, bottom:100, left:120, right:120 },
    rows: [table.columns,...table.rows].map((row,i) => new TableRow({
      tableHeader: i === 0, cantSplit: true,
      children: row.map((text, j) => new TableCell({
        width: { size:widths[j],type:WidthType.DXA },
        ...(i === 0 ? { shading:{fill:'EAF3F0'} } : {}),
        children: [new Paragraph({
          spacing:{after:0}, alignment: j === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
          children:[new TextRun({ text, bold:i === 0, size:20 })],
        })],
      })),
    })),
  });
}

export function reportWord(report: ReportDocument) {
  const heading = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_1 });
  const paragraph = (row: ReportLine) => new Paragraph({ children: [
    new TextRun(row.text),
    ...(row.links ?? []).map(link => new ExternalHyperlink({
      link: link.url, children: [new TextRun({ text: '  ' + link.label, style: 'Hyperlink' })],
    })),
  ] });
  return Packer.toBlob(new Document({
    title: `IvorySQL 社区运营报告 · ${report.period.label}`,
    styles: { default: { document: { run: { font: { ascii: 'Arial', eastAsia: 'Microsoft YaHei' }, size: 22 }, paragraph: { spacing: { after: 100 } } } } },
    sections: [{ children: [
      new Paragraph({ text: 'IvorySQL 社区运营报告', heading: HeadingLevel.TITLE }),
      new Paragraph({ text: `${report.period.label} · ${report.period.start} 至 ${report.period.end}${report.period.closed ? '' : '（周期尚未结束）'}` }),
      new Paragraph({ text: '生成于：' + reportGeneratedAt(report.generatedAt) }),
      heading('运营摘要'),
      ...report.summary.map(text => new Paragraph({ text })),
      ...report.sections.flatMap(section => [
        heading(section.title),
        ...section.lines.map(paragraph),
        ...(section.table ? [wordTable(section.table)] : []),
        ...(section.appendix?.length ? [
          new Paragraph({ text: '明细（' + section.appendix.length + ' 条）', heading: HeadingLevel.HEADING_2 }),
          ...section.appendix.map(paragraph),
        ] : []),
      ]),
    ] }],
  }));
}
