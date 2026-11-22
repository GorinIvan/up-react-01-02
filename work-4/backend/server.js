import express from 'express';
import { fileURLToPath } from 'node:url';
import accounts, { loadAccount } from './accounts.js';
import admin from './admin.js';
import store from './store.js';
import { InputError } from './validation.js';

const app = express();
app.disable('x-powered-by');
app.use('/api', express.json({ limit: '32kb' }));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (['POST', 'PUT'].includes(req.method) && !req.is('application/json')) {
    throw new InputError('Отправьте данные в формате JSON.', 415);
  }
  req.body ??= {};
  next();
});
app.use('/api', loadAccount);
app.use('/api/auth', accounts);
app.use('/api/admin', admin);
app.use('/api', store);
app.use('/api', (req, res) => res.status(404).json({ message: 'Запрос не найден.' }));
app.use(express.static(fileURLToPath(new URL('../dist/', import.meta.url))));

app.use((error, req, res, next) => {
  const message = error.message || '';
  if (error instanceof InputError) return res.status(error.status).json({ message });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'Проверьте формат данных.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ message: 'Данные слишком большие.' });
  if (message.includes('UNIQUE constraint failed: users.email')) {
    return res.status(409).json({ message: 'Этот email уже занят.' });
  }
  if (message.includes('UNIQUE constraint failed: reviews.user_id')) {
    return res.status(409).json({ message: 'Этот пользователь уже оставил отзыв на товар.' });
  }
  if (message.includes('UNIQUE constraint failed')) return res.status(409).json({ message: 'Запись с таким названием или кодом уже есть.' });
  if (message.includes('FOREIGN KEY constraint failed')) {
    return res.status(409).json({ message: 'Запись используется. Сначала измените связанные записи.' });
  }
  console.error(error);
  res.status(500).json({ message: 'Ошибка сервера. Повторите запрос позже.' });
});

const port = Number(process.env.PORT || 3002);
app.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Sneaker Store: http://127.0.0.1:${port}`));
