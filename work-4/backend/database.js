import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const db = new DatabaseSync(process.env.DB_FILE || fileURLToPath(new URL('./store.sqlite', import.meta.url)));
db.exec('PRAGMA busy_timeout = 5000');
db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));

export function transaction(action) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = action();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(password, salt, 64).toString('hex');
}

export function correctPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(hash, 'hex'));
}

export const tokenHash = (token) => createHash('sha256').update(token).digest('hex');
export const makeToken = () => randomBytes(32).toString('hex');

// Начальные товары добавляются только один раз. Удалённые записи не возвращаются при перезапуске.
transaction(() => {
  const { user_version: version } = db.prepare('PRAGMA user_version').get();
  if (version) return;
  db.exec(readFileSync(new URL('./seed.sql', import.meta.url), 'utf8'));
  const addUser = db.prepare(`
    INSERT INTO users (role_id, coupon_id, name, email, phone, address, password_hash)
    SELECT roles.id, coupons.id, ?, ?, ?, ?, ? FROM roles
    LEFT JOIN coupons ON coupons.code = ? WHERE roles.name = ?
  `);
  const email = process.env.ADMIN_EMAIL || 'admin@sneaker.test';
  if (process.env.NODE_ENV === 'production' && (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12)) {
    throw new Error('Задайте ADMIN_PASSWORD длиной от 12 символов перед первым запуском.');
  }
  addUser.run('Администратор магазина', email.toLowerCase(), '+79000000001', '',
    hashPassword(process.env.ADMIN_PASSWORD || 'Admin12345'), '', 'admin');
  if (process.env.NODE_ENV !== 'production') {
    addUser.run('Иван Петров', 'client@sneaker.test', '+79000000002', 'Москва, ул. Лесная, 10',
      hashPassword('Client12345'), 'START10', 'user');
    db.exec(`
      INSERT INTO reviews (code, user_id, product_id, rating, comment)
      SELECT 'sample-review', users.id, products.id, 5, 'Удобные на каждый день. Размер подошёл.'
      FROM users CROSS JOIN products WHERE users.email = 'client@sneaker.test' AND products.sku = 'SK-101'
    `);
  }
  db.exec('PRAGMA user_version = 1');
});
