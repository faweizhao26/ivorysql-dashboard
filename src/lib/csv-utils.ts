export function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows || rows.length === 0) return;

  const headers = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const BOM = '\uFEFF';

  function escapeCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    return /[,"\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  }

  const csvContent = [
    BOM + headers.map(escapeCell).join(','),
    ...rows.map(row =>
      headers.map(h => escapeCell(row[h])).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
