import type { BackupDataset } from '../services/backupService';

export interface ExportColumn<T> {
  key: string;
  label: string;
  value?: (row: T) => string | number;
}

export interface ExportColumnGroup {
  label: string;
  keys: string[];
}

function cellValue<T>(row: T, column: ExportColumn<T>): string | number {
  if (column.value) return column.value(row);
  const value = (row as Record<string, unknown>)[column.key];
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const candidate = value as { toDate?: () => Date; seconds?: number };
    if (typeof candidate.toDate === 'function') return candidate.toDate().toLocaleDateString('id-ID');
    if (typeof candidate.seconds === 'number') return new Date(candidate.seconds * 1000).toLocaleDateString('id-ID');
    return JSON.stringify(value);
  }
  return value as string | number;
}

function safeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

export async function exportToExcel<T>(
  filename: string,
  sheetName: string,
  rows: T[],
  columns: ExportColumn<T>[],
  groups: ExportColumnGroup[] = [],
): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31));
  sheet.columns = columns.map(column => ({ header: column.label, key: column.key, width: Math.max(14, column.label.length + 4) }));
  rows.forEach(row => {
    const values: Record<string, string | number> = {};
    columns.forEach(column => { values[column.key] = cellValue(row, column); });
    sheet.addRow(values);
  });

  const hasGroups = groups.length > 0;
  if (hasGroups) sheet.insertRow(1, []);

  const headerRow = sheet.getRow(hasGroups ? 2 : 1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };

  if (hasGroups) {
    const groupRow = sheet.getRow(1);
    groups.forEach(group => {
      const start = columns.findIndex(column => column.key === group.keys[0]) + 1;
      if (start === 0) return;
      const end = start + group.keys.length - 1;
      for (let index = start; index <= end; index += 1) {
        const cell = sheet.getCell(1, index);
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
      sheet.mergeCells(1, start, 1, end);
      groupRow.getCell(start).value = group.label;
    });
    groupRow.height = 20;
    headerRow.height = 20;
  }

  sheet.views = [{ state: 'frozen', ySplit: hasGroups ? 2 : 1 }];
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadBlob(`${safeFilename(filename)}.xlsx`, blob);
}

export async function exportToPdf<T>(filename: string, title: string, rows: T[], columns: ExportColumn<T>[]): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const document = new jsPDF({ orientation: columns.length > 5 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  document.setFontSize(14);
  document.text(title, 14, 16);
  document.setFontSize(9);
  document.text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, 14, 22);
  autoTable(document, {
    startY: 26,
    head: [columns.map(column => column.label)],
    body: rows.map(row => columns.map(column => String(cellValue(row, column)))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [4, 120, 87], textColor: 255 },
    alternateRowStyles: { fillColor: [246, 248, 247] },
    margin: { left: 14, right: 14 },
  });
  document.save(`${safeFilename(filename)}.pdf`);
}

function columnLetter(index: number): string {
  let remaining = index;
  let result = '';
  while (remaining > 0) {
    const remainder = (remaining - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return result;
}

function backupSheetName(value: string, used: Set<string>): string {
  const base = value.replace(/[\\/?*[\]:]/g, '-').slice(0, 31) || 'Sheet';
  let name = base;
  let suffix = 2;
  while (used.has(name)) {
    const tail = `-${suffix}`;
    name = `${base.slice(0, 31 - tail.length)}${tail}`;
    suffix += 1;
  }
  used.add(name);
  return name;
}

export async function exportBackupToExcel(filename: string, datasets: BackupDataset[]): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SILOG';
  workbook.created = new Date();

  const summary = workbook.addWorksheet('Ringkasan');
  summary.columns = [
    { header: 'Koleksi', key: 'label', width: 28 },
    { header: 'Nama Firestore', key: 'name', width: 28 },
    { header: 'Jumlah Dokumen', key: 'count', width: 18 },
    { header: 'Status', key: 'status', width: 32 },
  ];
  datasets.forEach((dataset) => {
    summary.addRow({
      label: dataset.label,
      name: dataset.name,
      count: dataset.rows.length,
      status: dataset.error ? `Gagal: ${dataset.error}` : 'Berhasil',
    });
  });
  summary.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  summary.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
  summary.views = [{ state: 'frozen', ySplit: 1 }];
  if (datasets.length > 0) {
    summary.autoFilter = { from: 'A1', to: `D${datasets.length + 1}` };
  }

  const usedNames = new Set(['Ringkasan']);
  datasets.forEach((dataset) => {
    if (dataset.error) return;
    const sheet = workbook.addWorksheet(backupSheetName(dataset.label, usedNames));
    const columns = [
      { header: 'ID Dokumen', key: '__id', width: 30 },
      ...dataset.fields.map((field) => ({
        header: field,
        key: field,
        width: Math.min(48, Math.max(14, field.length + 4)),
      })),
    ];
    sheet.columns = columns;
    dataset.rows.forEach((row) => {
      const values: Record<string, string | number> = { __id: row.id };
      dataset.fields.forEach((field) => { values[field] = row.values[field] ?? ''; });
      sheet.addRow(values);
    });
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    if (dataset.rows.length > 0) {
      sheet.autoFilter = {
        from: 'A1',
        to: `${columnLetter(columns.length)}${dataset.rows.length + 1}`,
      };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadBlob(`${safeFilename(filename)}.xlsx`, blob);
}

export async function exportBackupToPdf(filename: string, title: string, datasets: BackupDataset[]): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const document = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const totalRows = datasets.reduce((total, dataset) => total + dataset.rows.length, 0);

  document.setFontSize(14);
  document.text(title, 14, 16);
  document.setFontSize(9);
  document.text(`Dicetak: ${new Date().toLocaleString('id-ID')} | Total dokumen: ${totalRows}`, 14, 22);

  autoTable(document, {
    startY: 27,
    head: [['Koleksi', 'Nama Firestore', 'Jumlah Dokumen', 'Status']],
    body: datasets.map(dataset => [
      dataset.label,
      dataset.name,
      String(dataset.rows.length),
      dataset.error ? 'Gagal' : 'Berhasil',
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [4, 120, 87], textColor: 255 },
    margin: { left: 14, right: 14 },
  });

  const preferredFields = [
    'name', 'displayName', 'userName', 'status', 'createdAt', 'updatedAt',
    'requestNumber', 'transactionNumber', 'shipmentNumber', 'distributionNumber',
  ];
  let cursor = (document as any).lastAutoTable?.finalY + 10 || 40;

  datasets.forEach((dataset) => {
    if (dataset.error) return;
    if (cursor > 170) {
      document.addPage();
      cursor = 20;
    }
    document.setFontSize(11);
    document.text(`${dataset.label} (${dataset.rows.length} dokumen)`, 14, cursor);
    cursor += 3;
    const fields = [
      ...preferredFields.filter((field) => dataset.fields.includes(field)),
      ...dataset.fields.filter((field) => !preferredFields.includes(field)),
    ].slice(0, 8);
    autoTable(document, {
      startY: cursor,
      head: [['ID Dokumen', ...fields]],
      body: dataset.rows.map(row => [
        row.id,
        ...fields.map((field) => String(row.values[field] ?? '').slice(0, 160)),
      ]),
      styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fillColor: [4, 120, 87], textColor: 255 },
      alternateRowStyles: { fillColor: [246, 248, 247] },
      margin: { left: 14, right: 14 },
    });
    cursor = (document as any).lastAutoTable?.finalY + 9 || cursor + 30;
  });

  document.save(`${safeFilename(filename)}.pdf`);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[character] || character);
}

export function printReport<T>(title: string, rows: T[], columns: ExportColumn<T>[]): void {
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('Pop-up diblokir browser. Izinkan pop-up untuk mencetak laporan.');
  const head = columns.map(column => `<th>${escapeHtml(column.label)}</th>`).join('');
  const body = rows.map(row => `<tr>${columns.map(column => `<td>${escapeHtml(String(cellValue(row, column)))}</td>`).join('')}</tr>`).join('');
  popup.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#1e293b}h1{font-size:20px;color:#047857}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #cbd5e1;padding:6px;text-align:left}th{background:#ecfdf5}@media print{button{display:none}}</style></head><body><h1>${escapeHtml(title)}</h1><p>Dicetak: ${escapeHtml(new Date().toLocaleString('id-ID'))}</p><button onclick="window.print()">Cetak</button><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`);
  popup.document.close();
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
