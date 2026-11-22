import { Router } from 'express';
import { findUser, publicUser, requireAdmin } from './accounts.js';
import { db, hashPassword, transaction } from './database.js';
import { addReview, changeCart, createOrder, getOrders, productList, reviewList, statuses } from './store.js';
import { deliveryDate, emailAddress, field, InputError, integer, passwordValue, profileValues, requiredRow } from './validation.js';

const admin = Router();
admin.use(requireAdmin);

const userFor = (value) => requiredRow(findUser(emailAddress(value)), 'Пользователь не найден.');
const categoryFor = (value) => requiredRow(db.prepare('SELECT id FROM categories WHERE slug = ?')
  .get(field(value, 'Категория', 1, 50)), 'Категория не найдена.');
const couponFor = (value) => value ? requiredRow(db.prepare('SELECT id FROM coupons WHERE code = ?')
  .get(field(value, 'Купон', 1, 30)), 'Купон не найден.').id : null;

function publicKey(value, label, max) {
  const key = field(value, label, 2, max);
  if (!/^[a-z\d]+(?:-[a-z\d]+)*$/i.test(key)) throw new InputError(`${label} — используйте латинские буквы, цифры и дефис.`);
  return key;
}

function productFields(body) {
  const image = field(body.image ?? '', 'Изображение', 0, 400);
  if (image && !/^\/shoes\/[a-z\d-]+\.(?:webp|png|jpg)$/i.test(image) && !/^https:\/\/[^\s<>]+$/i.test(image)) {
    throw new InputError('Укажите HTTPS-ссылку на изображение или путь /shoes/имя.webp.');
  }
  return [
    publicKey(body.sku, 'Артикул', 40).toUpperCase(), field(body.name, 'Название', 2, 120),
    field(body.brand, 'Бренд', 2, 80), field(body.description, 'Описание', 5, 700), image,
    integer(body.price, 'Цена', 1, 1000000), integer(body.discount, 'Скидка', 0, 90),
    integer(body.deliveryDays, 'Доставка', 1, 60), categoryFor(body.category).id,
  ];
}

const categoryFields = (body) => [publicKey(body.slug, 'Код категории', 50).toLowerCase(), field(body.name, 'Название', 2, 80)];
const couponFields = (body) => [publicKey(body.code, 'Код купона', 30).toUpperCase(), integer(body.percent, 'Скидка', 1, 90)];

function cartKey(key) {
  let values;
  try {
    values = JSON.parse(key);
  } catch {
    throw new InputError('Некорректная строка корзины.');
  }
  if (!Array.isArray(values) || values.length !== 3) throw new InputError('Некорректная строка корзины.');
  const [email, sku, size] = values;
  return [userFor(email), sku, integer(size, 'Размер', 36, 46)];
}

// Набор ресурсов задан сервером. Имена таблиц и SQL не передаются из браузера.
const resources = {
  products: {
    list: () => db.prepare(productList).all(),
    add: (body) => db.prepare(`
      INSERT INTO products (sku, name, brand, description, image, price, discount, delivery_days, category_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(...productFields(body)),
    edit: (key, body) => db.prepare(`
      UPDATE products SET sku = ?, name = ?, brand = ?, description = ?, image = ?, price = ?, discount = ?,
        delivery_days = ?, category_id = ? WHERE sku = ?
    `).run(...productFields(body), key),
    remove: (key) => db.prepare('DELETE FROM products WHERE sku = ?').run(key),
  },
  categories: {
    list: () => db.prepare('SELECT slug, name FROM categories ORDER BY name').all(),
    add: (body) => db.prepare('INSERT INTO categories (slug, name) VALUES (?, ?)').run(...categoryFields(body)),
    edit: (key, body) => db.prepare('UPDATE categories SET slug = ?, name = ? WHERE slug = ?').run(...categoryFields(body), key),
    remove: (key) => db.prepare('DELETE FROM categories WHERE slug = ?').run(key),
  },
  coupons: {
    list: () => db.prepare('SELECT code, percent FROM coupons ORDER BY code').all(),
    add: (body) => db.prepare('INSERT INTO coupons (code, percent) VALUES (?, ?)').run(...couponFields(body)),
    edit: (key, body) => db.prepare('UPDATE coupons SET code = ?, percent = ? WHERE code = ?').run(...couponFields(body), key),
    remove: (key) => db.prepare('DELETE FROM coupons WHERE code = ?').run(key),
  },
  users: {
    list: () => db.prepare(`
      SELECT users.name, users.email, users.phone, users.address, roles.name AS role, coupons.code AS coupon
      FROM users JOIN roles ON roles.id = users.role_id LEFT JOIN coupons ON coupons.id = users.coupon_id
      ORDER BY users.email
    `).all().map(publicUser),
    add: (body) => db.prepare(`
      INSERT INTO users (role_id, name, email, phone, address, coupon_id, password_hash)
      SELECT roles.id, ?, ?, ?, ?, ?, ? FROM roles WHERE roles.name = 'user'
    `).run(...profileValues(body), couponFor(body.coupon), hashPassword(passwordValue(body.password))),
    edit: (key, body, actor) => {
      const user = userFor(key);
      if (user.role === 'admin' && user.id !== actor.id) throw new InputError('Изменяйте только свой аккаунт администратора.', 403);
      const profile = profileValues(body);
      const password = body.password ? hashPassword(passwordValue(body.password)) : user.password_hash;
      return transaction(() => {
        const result = db.prepare(`
          UPDATE users SET name = ?, email = ?, phone = ?, address = ?, coupon_id = ?, password_hash = ? WHERE id = ?
        `).run(...profile, couponFor(body.coupon), password, user.id);
        if (body.password) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
        if (body.password || profile[1] !== user.email) db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(user.id);
        return result;
      });
    },
    remove: (key) => {
      const user = userFor(key);
      if (user.role === 'admin') throw new InputError('Аккаунт администратора защищён от удаления.', 403);
      return db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    },
  },
  reviews: {
    list: () => db.prepare(reviewList + ' ORDER BY reviews.created_at DESC').all(),
    add: (body) => addReview(userFor(body.email).id, body.sku, body),
    edit: (key, body) => db.prepare('UPDATE reviews SET rating = ?, comment = ? WHERE code = ?')
      .run(integer(body.rating, 'Оценка', 1, 5), field(body.comment, 'Комментарий', 3, 1000), key),
    remove: (key) => db.prepare('DELETE FROM reviews WHERE code = ?').run(key),
  },
  carts: {
    list: () => db.prepare(`
      SELECT users.email, products.sku, products.name, cart.size, cart.quantity
      FROM cart JOIN users ON users.id = cart.user_id JOIN products ON products.id = cart.product_id
      ORDER BY users.email, products.sku, cart.size
    `).all(),
    add: (body) => changeCart(userFor(body.email), body.sku, body, true),
    edit: (key, body) => {
      const [user, sku, size] = cartKey(key);
      changeCart(user, sku, { size, quantity: integer(body.quantity, 'Количество', 1, 20) });
    },
    remove: (key) => {
      const [user, sku, size] = cartKey(key);
      changeCart(user, sku, { size, quantity: 0 });
    },
  },
  orders: {
    list: () => getOrders(),
    add: (body) => createOrder(userFor(body.email), body),
    edit: (key, body) => {
      const previous = requiredRow(db.prepare('SELECT delivery_date FROM orders WHERE number = ?').get(key), 'Заказ не найден.');
      if (!statuses.includes(body.status)) throw new InputError('Выберите статус заказа.');
      return db.prepare('UPDATE orders SET status = ?, delivery_date = ?, address = ? WHERE number = ?')
        .run(body.status, deliveryDate(body.deliveryDate, body.deliveryDate === previous.delivery_date),
          field(body.address, 'Адрес доставки', 5, 250), key);
    },
    remove: (key) => db.prepare('DELETE FROM orders WHERE number = ?').run(key),
  },
};

function resource(req) {
  return requiredRow(Object.hasOwn(resources, req.params.resource) && resources[req.params.resource], 'Раздел не найден.');
}

admin.get('/:resource', (req, res) => res.json(resource(req).list()));
admin.post('/:resource', (req, res) => {
  resource(req).add(req.body);
  res.status(201).json({ message: 'Запись добавлена.' });
});
admin.put('/:resource/:key', (req, res) => {
  const result = resource(req).edit(req.params.key, req.body, req.user);
  if (result?.changes === 0) throw new InputError('Запись не найдена.', 404);
  res.json({ message: 'Изменения сохранены.' });
});
admin.delete('/:resource/:key', (req, res) => {
  const result = resource(req).remove(req.params.key);
  if (result?.changes === 0) throw new InputError('Запись не найдена.', 404);
  res.json({ message: 'Запись удалена.' });
});

export default admin;
