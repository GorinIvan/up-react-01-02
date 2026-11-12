import { randomUUID } from 'node:crypto';
import express from 'express';
import { checkPassword, db } from './database.js';

const app = express();
const sessions = new Map();
const port = Number(process.env.PORT || 3001);

app.use(express.json({ limit: '16kb' }));

const userQuery = `
  SELECT u.id, u.email, r.name AS role, u.coupon_id AS couponId,
         c.name AS couponName, COALESCE(c.percent, 0) AS couponPercent
  FROM Users u
  JOIN Roles r ON r.id = u.role_id
  LEFT JOIN Coupons c ON c.id = u.coupon_id
`;

app.get('/api/catalog', (req, res) => {
  const categories = db.prepare('SELECT id, name FROM Categories ORDER BY id').all();
  const services = db.prepare(`
    SELECT id, name, description, duration, price, discount, category_id AS categoryId
    FROM Services ORDER BY id
  `).all();
  res.json({ categories, services });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      || typeof password !== 'string' || !password.trim()) {
    return res.status(400).json({ error: 'Укажите корректный email и пароль.' });
  }

  const account = db.prepare('SELECT id, password_hash FROM Users WHERE email = ?').get(email.trim());
  if (!account || !checkPassword(password, account.password_hash)) {
    return res.status(401).json({ error: 'Неверный email или пароль.' });
  }

  const token = randomUUID();
  sessions.set(token, account.id);
  const user = db.prepare(userQuery + ' WHERE u.id = ?').get(account.id);
  res.json({ token, user });
});

function getToken(req) {
  return req.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
}

app.post('/api/logout', (req, res) => {
  sessions.delete(getToken(req));
  res.json({ ok: true });
});

function requireAdmin(req, res, next) {
  const userId = sessions.get(getToken(req));
  if (!userId) return res.status(401).json({ error: 'Сначала войдите в аккаунт.' });

  const user = db.prepare(userQuery + ' WHERE u.id = ?').get(userId);
  if (user?.role !== 'admin') return res.status(403).json({ error: 'Нужна роль администратора.' });
  next();
}

app.use('/api/admin', requireAdmin);

app.get('/api/admin/options', (req, res) => {
  const users = db.prepare(userQuery + " WHERE r.name = 'client' ORDER BY u.id").all();
  const coupons = db.prepare('SELECT id, name, percent FROM Coupons ORDER BY id').all();
  res.json({ users, coupons });
});

app.post('/api/admin/categories', (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name || name.length > 50) {
    return res.status(400).json({ error: 'Название категории должно содержать от 1 до 50 символов.' });
  }

  const categories = db.prepare('SELECT name FROM Categories').all();
  if (categories.some((category) => category.name.toLowerCase() === name.toLowerCase())) {
    return res.status(409).json({ error: 'Такая категория уже есть.' });
  }

  const result = db.prepare('INSERT INTO Categories (name) VALUES (?)').run(name);
  res.status(201).json({ id: Number(result.lastInsertRowid), name });
});

app.patch('/api/admin/users/:id/coupon', (req, res) => {
  const couponId = req.body?.couponId;
  if (!Number.isInteger(couponId) || !db.prepare('SELECT id FROM Coupons WHERE id = ?').get(couponId)) {
    return res.status(400).json({ error: 'Выберите купон из списка.' });
  }

  const result = db.prepare(`
    UPDATE Users SET coupon_id = ?
    WHERE id = ? AND role_id = (SELECT id FROM Roles WHERE name = 'client')
  `).run(couponId, Number(req.params.id));

  if (!result.changes) return res.status(404).json({ error: 'Клиент не найден.' });
  res.json({ ok: true });
});

app.patch('/api/admin/services/:id/discount', (req, res) => {
  const percent = req.body?.percent;
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
    return res.status(400).json({ error: 'Скидка должна быть целым числом от 0 до 100.' });
  }

  const result = db.prepare('UPDATE Services SET discount = ? WHERE id = ?')
    .run(percent, Number(req.params.id));

  if (!result.changes) return res.status(404).json({ error: 'Услуга не найдена.' });
  res.json({ ok: true });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Запрос не найден.' }));

app.use((error, req, res, next) => {
  if (error.status === 400 || error.status === 413) {
    return res.status(error.status).json({ error: 'Проверьте данные запроса.' });
  }
  console.error(error);
  res.status(500).json({ error: 'Ошибка сервера. Попробуйте ещё раз.' });
});

app.listen(port, '127.0.0.1', () => {
  console.log('API салона: http://127.0.0.1:' + port + '/api/catalog');
});
