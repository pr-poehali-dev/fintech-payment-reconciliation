import { format } from 'date-fns';
import { Transaction } from '@/components/transactions/transactionsTypes';
import { DateFilter } from '@/components/filters/DateRangeFilter';
import { typeConfig, getStatusDisplay } from '@/components/transactions/table/tableHelpers';
import { groupTransactions } from '@/lib/transactionGrouping';
import { formatDateTime } from '@/lib/formatDate';

const GROUP_STATUS_LABELS: Record<string, string> = {
  reconciled: 'Сверено',
  matched: 'Связано',
  manual: 'Связано вручную',
  unmatched: 'Нет пары'
};

interface ExportOptions {
  transactions: Transaction[];
  timezone: string;
  companyName?: string;
  dateFilter: DateFilter | null;
}

const toNumber = (v: number | null | undefined) => (v === null || v === undefined ? null : Number(v));

export const exportTransactionsToExcel = async ({ transactions, timezone, companyName, dateFilter }: ExportOptions) => {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Транзакции', { views: [{ state: 'frozen', ySplit: 1 }] });

  sheet.columns = [
    { header: 'Группа', key: 'group', width: 9 },
    { header: 'Связь', key: 'link', width: 18 },
    { header: 'Тип', key: 'type', width: 14 },
    { header: 'Дата и время', key: 'date', width: 19 },
    { header: 'За продажи', key: 'settlement', width: 13 },
    { header: 'Описание', key: 'title', width: 32 },
    { header: 'Детали', key: 'subtitle', width: 50 },
    { header: 'Интеграция', key: 'integration', width: 18 },
    { header: 'Статус', key: 'status', width: 16 },
    { header: 'Сумма документа, ₽', key: 'amount', width: 18 },
    { header: 'Сумма в сверке, ₽', key: 'signed', width: 18 }
  ];

  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: 'middle', wrapText: true };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5C8' } };

  groupTransactions(transactions).forEach((group, index) => {
    group.items.forEach((tx) => {
      sheet.addRow({
        group: index + 1,
        link: GROUP_STATUS_LABELS[group.status] || '',
        type: typeConfig[tx.type]?.label || tx.type,
        date: formatDateTime(tx.occurred_at, timezone),
        settlement: tx.type === 'money' && tx.settlement_date ? tx.settlement_date.split('-').reverse().join('.') : '',
        title: tx.title,
        subtitle: tx.subtitle || '',
        integration: tx.integration_name || '',
        status: getStatusDisplay(tx).label || tx.status || '',
        amount: toNumber(tx.amount),
        signed: toNumber(tx.signed_amount ?? tx.amount)
      });
    });
  });

  ['amount', 'signed'].forEach((key) => {
    sheet.getColumn(key).numFmt = '#,##0.00';
  });
  sheet.autoFilter = { from: 'A1', to: 'K1' };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  const period = dateFilter
    ? dateFilter.from.toDateString() === dateFilter.to.toDateString()
      ? format(dateFilter.from, 'dd.MM.yyyy')
      : `${format(dateFilter.from, 'dd.MM.yyyy')}-${format(dateFilter.to, 'dd.MM.yyyy')}`
    : `все_на_${format(new Date(), 'dd.MM.yyyy')}`;
  const company = (companyName || '').replace(/[\\/:*?"<>|]/g, '').trim();
  const fileName = `Транзакции_${company ? `${company}_` : ''}${period}.xlsx`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
