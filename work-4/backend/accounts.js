import { Router } from 'express';
import { appendFile } from 'node:fs/promises';
import nodemailer from 'nodemailer';
import { db, correctPassword, hashPassword, makeToken, tokenHash, transaction } from './database.js';
import { emailAddress, InputError, passwordValue, profileValues } from './validation.js';

const accounts = Router();
const sessionAge = 7 * 24 * 60 * 60 * 1000;
const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', path: '/' };
const userSelect = `
  SELECT users.id, users.name, users.email, users.phone, users.address, users.password_hash,
         roles.name AS role, coupons.code AS coupon, coupons.percent AS coupon_percent
  FROM users JOIN roles ON roles.id = users.role_id
  LEFT JOIN coupons ON coupons.id = users.coupon_id
`;
const anonymousHash = hashPassword(makeToken());

export const findUser = (email) => db.prepare(userSelect + ' WHERE users.email = ?').get(email);
export const publicUser = ({ name, email, phone, address, role, coupon, coupon_percent }) =>
  ({ name, email, phone, address, role, coupon, couponPercent: coupon_percent });

export function loadAccount(req, res, next) {
  const cookie = /(?:^|;\s*)session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '');
  if (cookie) {
    req.token = tokenHash(cookie[1]);
    req.user = db.prepare(userSelect + `
      JOIN sessions ON sessions.user_id = users.id
      WHERE sessions.token = ? AND sessions.expires > ?
    `).get(req.token, Date.now());
  }
  next();
}

export function requireUser(req, res, next) {
  if (!req.user) throw new InputError('Сначала войдите в аккаунт.', 401);
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') throw new InputError('Доступ только для администратора.', 403);
  next();
}

function startSession(res, user, previous) {
  const token = makeToken();
  if (previous) db.prepare('DELETE FROM sessions WHERE token = ?').run(previous);
  db.prepare('DELETE FROM sessions WHERE expires <= ?').run(Date.now());
  db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(tokenHash(token), user.id, Date.now() + sessionAge);
  res.cookie('session', token, { ...cookieOptions, maxAge: sessionAge });
  return publicUser(user);
}

// Ограничиваем частоту входа и восстановления. Окна истекают автоматически.
function limitAttempts(maximum) {
  const attempts = new Map();
  const window = 15 * 60 * 1000;
  return (req, res, next) => {
    const now = Date.now();
    for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
    const key = req.ip;
    const entry = attempts.get(key) || { count: 0, until: now + window };
    if (entry.count >= maximum) throw new InputError('Слишком много попыток. Повторите через 15 минут.', 429);
    entry.count += 1;
    attempts.set(key, entry);
    next();
  };
}

accounts.get('/me', (req, res) => res.json(req.user ? publicUser(req.user) : null));

accounts.post('/register', limitAttempts(20), (req, res) => {
  const [name, email, phone] = profileValues(req.body);
  const password = hashPassword(passwordValue(req.body.password));
  db.prepare(`
    INSERT INTO users (role_id, name, email, phone, password_hash)
    SELECT roles.id, ?, ?, ?, ? FROM roles WHERE roles.name = 'user'
  `).run(name, email, phone, password);
  res.status(201).json(startSession(res, findUser(email), req.token));
});

accounts.post('/login', limitAttempts(35), (req, res) => {
  const email = emailAddress(req.body.email);
  const password = req.body.password;
  if (typeof password !== 'string' || !password.trim() || password.length > 128) {
    throw new InputError('Введите пароль.');
  }
  const user = findUser(email);
  if (!correctPassword(password, user?.password_hash || anonymousHash) || !user) {
    throw new InputError('Неверный email или пароль.', 401);
  }
  res.json(startSession(res, user, req.token));
});

accounts.post('/logout', (req, res) => {
  if (req.token) db.prepare('DELETE FROM sessions WHERE token = ?').run(req.token);
  res.clearCookie('session', cookieOptions).json({ message: 'Вы вышли из аккаунта.' });
});

accounts.put('/profile', requireUser, (req, res) => {
  const [name, email, phone, address] = profileValues(req.body);
  transaction(() => {
    db.prepare('UPDATE users SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?')
      .run(name, email, phone, address, req.user.id);
    if (email !== req.user.email) db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(req.user.id);
  });
  res.json(publicUser(findUser(email)));
});

accounts.put('/password', requireUser, limitAttempts(30), (req, res) => {
  const current = req.body.currentPassword;
  if (typeof current !== 'string' || current.length > 128 || !correctPassword(current, req.user.password_hash)) {
    throw new InputError('Текущий пароль введён неверно.');
  }
  const password = passwordValue(req.body.password);
  if (current === password) throw new InputError('Новый пароль должен отличаться от текущего.');
  transaction(() => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), req.user.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(req.user.id, req.token);
    db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(req.user.id);
  });
  res.json({ message: 'Пароль изменён.' });
});

const smtp = process.env.SMTP_URL && nodemailer.createTransport(process.env.SMTP_URL);

// В учебном запуске письмо записывается в локальный файл. С SMTP ссылка приходит по email.
accounts.post('/forgot', limitAttempts(15), (req, res) => {
  const email = emailAddress(req.body.email);
  const user = findUser(email);
  if (user) {
    const token = makeToken();
    db.prepare(`
      INSERT INTO password_resets VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET token = excluded.token, expires = excluded.expires
    `).run(tokenHash(token), user.id, Date.now() + 30 * 60 * 1000);
    const localPort = req.headers.host?.split(':').at(-1) === '5176' ? 5176 : process.env.PORT || 3002;
    const link = new URL('/', process.env.APP_URL || 'http://127.0.0.1:' + localPort);
    link.searchParams.set('reset', token);
    const text = `Ссылка действует 30 минут. Откройте её, чтобы сменить пароль: ${link}`;
    const send = smtp
      ? smtp.sendMail({ from: process.env.MAIL_FROM, to: email, subject: 'Sneaker Store — восстановление пароля', text })
      : process.env.NODE_ENV !== 'production'
        ? appendFile(process.env.MAIL_FILE || new URL('./mailbox.log', import.meta.url), `${email}\n${text}\n\n`, { mode: 0o600 })
        : Promise.reject(new Error('Настройка SMTP отсутствует.'));
    send.catch(() => console.error('Не удалось отправить письмо восстановления. Проверьте настройки почты.'));
  }
  res.json({ message: 'Если аккаунт существует, для него создана ссылка восстановления.' });
});

accounts.post('/reset', limitAttempts(30), (req, res) => {
  const { token } = req.body;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    throw new InputError('Ссылка недействительна. Запросите новую.');
  }
  const password = passwordValue(req.body.password);
  transaction(() => {
    const reset = db.prepare(`
      SELECT users.id FROM password_resets JOIN users ON users.id = password_resets.user_id
      WHERE password_resets.token = ? AND password_resets.expires > ?
    `).get(tokenHash(token), Date.now());
    if (!reset) throw new InputError('Ссылка недействительна. Запросите новую.');
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), reset.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(reset.id);
    db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(reset.id);
  });
  res.clearCookie('session', cookieOptions).json({ message: 'Пароль изменён. Теперь можно войти.' });
});

export default accounts;
