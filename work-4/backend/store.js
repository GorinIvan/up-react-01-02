import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { requireUser } from './accounts.js';
import { db, transaction } from './database.js';
import { deliveryDate, field, InputError, integer, requiredRow } from './validation.js';

const store = Router();
const effectivePrice = 'CAST(ROUND(products.price * (100 - products.discount) / 100.0) AS INTEGER)';

export const productList = `
  SELECT products.sku, products.name, products.brand, products.description, products.image,
         products.price, products.discount, products.delivery_days AS deliveryDays,
         ${effectivePrice} AS salePrice, categories.slug AS category, categories.name AS categoryName,
         COUNT(reviews.id) AS reviewCount, ROUND(AVG(reviews.rating), 1) AS averageRating
  FROM products JOIN categories ON categories.id = products.category_id
  LEFT JOIN reviews ON reviews.product_id = products.id
  GROUP BY products.id ORDER BY products.sku
`;

export function productBySku(sku) {
  return requiredRow(db.prepare('SELECT id FROM products WHERE sku = ?').get(field(sku, 'Артикул', 1, 40)), 'Товар не найден.');
}

store.get('/catalog', (req, res) => {
  res.json({
    products: db.prepare(productList).all(),
    categories: db.prepare('SELECT slug, name FROM categories ORDER BY name').all(),
  });
});

export const reviewList = `
  SELECT reviews.code, reviews.rating, reviews.comment, reviews.created_at AS createdAt,
         users.name AS author, products.sku, products.name AS product
  FROM reviews JOIN users ON users.id = reviews.user_id JOIN products ON products.id = reviews.product_id
`;

store.get('/products/:sku/reviews', (req, res) => {
  productBySku(req.params.sku);
  res.json(db.prepare(reviewList + ' WHERE products.sku = ? ORDER BY reviews.created_at DESC, reviews.id DESC')
    .all(req.params.sku));
});

export function addReview(userId, sku, body) {
  const { id: productId } = productBySku(sku);
  const code = randomUUID();
  db.prepare('INSERT INTO reviews (code, user_id, product_id, rating, comment) VALUES (?, ?, ?, ?, ?)')
    .run(code, userId, productId, integer(body.rating, 'Оценка', 1, 5), field(body.comment, 'Комментарий', 3, 1000));
  return code;
}

store.post('/products/:sku/reviews', requireUser, (req, res) => {
  addReview(req.user.id, req.params.sku, req.body);
  res.status(201).json({ message: 'Отзыв опубликован.' });
});

// JOIN возвращает готовые строки корзины с названием товара, категорией и ценой со скидкой.
export function getCart(user) {
  const items = db.prepare(`
    SELECT products.sku, products.name, products.image, categories.name AS category,
           cart.size, cart.quantity, products.price, ${effectivePrice} AS unitPrice
    FROM cart JOIN users ON users.id = cart.user_id JOIN products ON products.id = cart.product_id
    JOIN categories ON categories.id = products.category_id
    WHERE users.id = ? ORDER BY products.name, cart.size
  `).all(user.id);
  const subtotal = items.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const couponPercent = user.coupon_percent || 0;
  return { items, subtotal, total: Math.round(subtotal * (100 - couponPercent) / 100), coupon: user.coupon, couponPercent };
}

export function changeCart(user, sku, body, add = false) {
  const size = integer(body.size, 'Размер', 36, 46);
  const quantity = integer(body.quantity, 'Количество', add ? 1 : 0, 20);
  const product = productBySku(sku);
  if (quantity === 0) {
    db.prepare('DELETE FROM cart WHERE user_id = ? AND product_id = ? AND size = ?').run(user.id, product.id, size);
    return;
  }
  transaction(() => {
    const current = db.prepare('SELECT quantity FROM cart WHERE user_id = ? AND product_id = ? AND size = ?')
      .get(user.id, product.id, size);
    const next = add ? (current?.quantity || 0) + quantity : quantity;
    if (next > 20) throw new InputError('В одной строке корзины может быть не больше 20 пар.');
    db.prepare(`
      INSERT INTO cart VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, product_id, size) DO UPDATE SET quantity = excluded.quantity
    `).run(user.id, product.id, size, next);
  });
}

store.get('/cart', requireUser, (req, res) => res.json(getCart(req.user)));
store.post('/cart', requireUser, (req, res) => {
  changeCart(req.user, req.body.sku, req.body, true);
  res.json(getCart(req.user));
});
store.put('/cart', requireUser, (req, res) => {
  changeCart(req.user, req.body.sku, req.body);
  res.json(getCart(req.user));
});

export const statuses = ['new', 'shipping', 'delivered', 'cancelled'];

export function getOrders(user) {
  const rows = db.prepare(`
    SELECT orders.number, orders.created_at AS createdAt, orders.delivery_date AS deliveryDate,
           orders.address, orders.status, orders.subtotal, orders.total, orders.coupon_code AS coupon,
           users.email, order_items.sku, order_items.name, order_items.size,
           order_items.quantity, order_items.unit_price AS unitPrice
    FROM orders JOIN users ON users.id = orders.user_id JOIN order_items ON order_items.order_id = orders.id
    WHERE (? IS NULL OR users.id = ?) ORDER BY orders.created_at DESC, orders.id DESC, order_items.id
  `).all(user?.id ?? null, user?.id ?? null);
  const orders = new Map();
  for (const { sku, name, size, quantity, unitPrice, ...header } of rows) {
    if (!orders.has(header.number)) orders.set(header.number, { ...header, items: [] });
    orders.get(header.number).items.push({ sku, name, size, quantity, unitPrice });
  }
  return [...orders.values()];
}

// Заказ, снимок цен и очистка корзины записываются одной транзакцией.
export function createOrder(user, body) {
  const date = deliveryDate(body.deliveryDate);
  const address = field(body.address, 'Адрес доставки', 5, 250);
  return transaction(() => {
    const cart = getCart(user);
    if (!cart.items.length) throw new InputError('Добавьте товары в корзину.');
    const number = 'SN-' + randomUUID().slice(0, 12).replace('-', '').toUpperCase();
    db.prepare(`
      INSERT INTO orders (user_id, number, delivery_date, address, subtotal, total, coupon_code)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(user.id, number, date, address, cart.subtotal, cart.total, cart.coupon || '');
    db.prepare(`
      INSERT INTO order_items (order_id, product_id, sku, name, size, quantity, unit_price)
      SELECT orders.id, products.id, products.sku, products.name, cart.size, cart.quantity, ${effectivePrice}
      FROM cart JOIN products ON products.id = cart.product_id
      JOIN orders ON orders.user_id = cart.user_id WHERE orders.number = ?
    `).run(number);
    db.prepare('DELETE FROM cart WHERE user_id = ?').run(user.id);
    return number;
  });
}

store.get('/orders', requireUser, (req, res) => res.json(getOrders(req.user)));
store.post('/orders', requireUser, (req, res) => res.status(201).json({ number: createOrder(req.user, req.body) }));

export default store;
