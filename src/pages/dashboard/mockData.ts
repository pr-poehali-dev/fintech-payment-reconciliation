export const revenueData = [
  { month: 'Янв', amount: 4200 },
  { month: 'Фев', amount: 5100 },
  { month: 'Мар', amount: 4800 },
  { month: 'Апр', amount: 6200 },
  { month: 'Май', amount: 7500 },
  { month: 'Июн', amount: 8200 }
];

export const reconciliationData = [
  { name: 'Сверено', value: 85, color: 'hsl(var(--primary))' },
  { name: 'Расхождения', value: 12, color: 'hsl(var(--accent))' },
  { name: 'Ожидают', value: 3, color: 'hsl(var(--muted))' }
];

export const paymentsData = [
  { day: 'Пн', count: 45 },
  { day: 'Вт', count: 52 },
  { day: 'Ср', count: 48 },
  { day: 'Чт', count: 61 },
  { day: 'Пт', count: 55 },
  { day: 'Сб', count: 28 },
  { day: 'Вс', count: 15 }
];

export const recentTransactions = [
  { id: 1, description: 'Оплата от ООО "Ромашка"', amount: 125000, status: 'success', time: '10:24' },
  { id: 2, description: 'Платеж ИП Иванов', amount: 45000, status: 'pending', time: '09:45' },
  { id: 3, description: 'Возврат товара', amount: -12000, status: 'warning', time: '09:12' },
  { id: 4, description: 'Оплата услуг', amount: 78500, status: 'success', time: '08:56' }
];
