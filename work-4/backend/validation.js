export class InputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function field(value, label, min, max) {
  const clean = typeof value === 'string' ? value.trim() : '';
  if (typeof value !== 'string' || clean.length < min || clean.length > max) {
    throw new InputError(min ? `${label} — от ${min} до ${max} символов.` : `${label} — до ${max} символов.`);
  }
  return clean;
}

export function integer(value, label, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new InputError(`${label} — целое число от ${min} до ${max}.`);
  }
  return value;
}

export function emailAddress(value) {
  const email = field(value, 'Email', 5, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new InputError('Введите корректный email.');
  return email;
}

export function passwordValue(value) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 128 || !value.trim()) {
    throw new InputError('Пароль должен содержать от 8 до 128 символов.');
  }
  return value;
}

export function profileValues(body) {
  const phone = field(body.phone, 'Телефон', 7, 25);
  if (!/^\+?[\d ().-]+$/.test(phone) || !/^\d{7,15}$/.test(phone.replace(/\D/g, ''))) {
    throw new InputError('Введите корректный телефон.');
  }
  const name = field(body.name, 'ФИО', 3, 120);
  if (!/^[\p{L}\p{M} .’'-]+$/u.test(name) || !/\p{L}/u.test(name)) {
    throw new InputError('Укажите ФИО буквами.');
  }
  return [name, emailAddress(body.email), phone, field(body.address ?? '', 'Адрес', 0, 250)];
}

export const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(new Date());

export function deliveryDate(value, allowPast = false) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new InputError('Укажите дату доставки.');
  }
  const parsed = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new InputError('Укажите существующую дату доставки.');
  }
  if (!allowPast && value < today()) throw new InputError('Дата доставки не может быть в прошлом.');
  return value;
}

export function requiredRow(row, message) {
  if (!row) throw new InputError(message, 404);
  return row;
}
