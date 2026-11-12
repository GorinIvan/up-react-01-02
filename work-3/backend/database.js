import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

export const db = new DatabaseSync(
  process.env.DB_FILE || fileURLToPath(new URL('./salon.sqlite', import.meta.url))
);

for (const filename of ['schema.sql', 'seed.sql']) {
  db.exec(readFileSync(new URL(filename, import.meta.url), 'utf8'));
}

function hashPassword(password, salt) {
  return scryptSync(password, salt, 64);
}

export function checkPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  return timingSafeEqual(hashPassword(password, salt), Buffer.from(hash, 'hex'));
}

const demoUsers = [
  ['admin@salon.test', 'admin123', 1, null],
  ['client@salon.test', 'client123', 2, 2],
  ['guest@salon.test', 'guest123', 2, 1],
];

for (const [email, password, role, coupon] of demoUsers) {
  if (!db.prepare('SELECT id FROM Users WHERE email = ?').get(email)) {
    const salt = randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt).toString('hex');
    db.prepare('INSERT INTO Users (email, password_hash, role_id, coupon_id) VALUES (?, ?, ?, ?)')
      .run(email, salt + ':' + hash, role, coupon);
  }
}
