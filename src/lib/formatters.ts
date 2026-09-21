export const formatPhoneNumber = (value: string, previousValue: string = ''): string => {
  let digits = value.replace(/\D/g, '');

  if (value.length < previousValue.length) {
    return value;
  }

  if (digits.startsWith('8') && digits.length === 11) {
    digits = '7' + digits.slice(1);
  }

  if (!digits.startsWith('7')) {
    return value;
  }

  let formatted = '+7';
  if (digits.length > 1) formatted += ' (' + digits.slice(1, 4);
  if (digits.length >= 5) formatted += ') ' + digits.slice(4, 7);
  if (digits.length >= 8) formatted += '-' + digits.slice(7, 9);
  if (digits.length >= 10) formatted += '-' + digits.slice(9, 11);

  return formatted;
};

export const isValidPhone = (phone: string): boolean => {
  return phone.replace(/\D/g, '').length === 11;
};

export const isValidEmail = (email: string): boolean => {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const sanitizeInn = (value: string): string => {
  return value.replace(/\D/g, '').slice(0, 12);
};

export const isValidInn = (inn: string): boolean => {
  return /^\d{10}$|^\d{12}$/.test(inn);
};

export const getInnHint = (inn: string): string => {
  if (inn.length === 0) return '10 цифр для юрлица, 12 для ИП';
  if (inn.length === 10 || inn.length === 12) return '';
  if (inn.length < 10) return `Юрлицо: ${inn.length}/10`;
  return `ИП: ${inn.length}/12`;
};