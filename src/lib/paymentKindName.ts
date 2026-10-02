export const shortPaymentKindName = (description?: string | null): string => {
  if (!description) return '';
  let text = description.replace(/^\s*плат[её]ж\s+через\s+/i, '');
  text = text.replace(/^сч[её]т\s+/i, '').trim();
  const whole = text.match(/^["«](.+)["»]$/);
  if (whole) text = whole[1];
  text = text.replace(/"([^"]*)"/g, '«$1»');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : description;
};

export default shortPaymentKindName;
