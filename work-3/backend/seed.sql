INSERT OR IGNORE INTO Roles (id, name) VALUES (1, 'admin'), (2, 'client');
INSERT OR IGNORE INTO Coupons (id, name, percent)
VALUES (1, 'Первая покупка', 5), (2, 'Постоянный клиент', 10), (3, 'VIP', 15);

INSERT OR IGNORE INTO Categories (id, name)
VALUES (1, 'Приключения'), (2, 'Стратегии'), (3, 'Симуляторы');

-- Цены в копейках, длительность в часах. Три игры имеют общую скидку.
INSERT INTO Services (id, name, description, duration, price, discount, category_id) VALUES
  (1, 'Grand Theft Auto V', 'Криминальная история в открытом мире.', 32, 150000, 10, 1),
  (2, 'Red Dead Redemption 2', 'Приключение на Диком Западе.', 50, 110000, 0, 1),
  (3, 'Cyberpunk 2077', 'Ролевая игра в городе будущего.', 25, 189000, 0, 1),
  (4, 'Elden Ring', 'Фэнтези и сражения с боссами.', 60, 229000, 0, 1),
  (5, 'Civilization VI', 'Развивай цивилизацию от древности до наших дней.', 8, 120000, 15, 2),
  (6, 'Hearts of Iron IV', 'Управляй страной во Второй мировой войне.', 12, 149000, 0, 2),
  (7, 'Total War: Warhammer III', 'Командуй армиями в мире фэнтези.', 25, 199000, 0, 2),
  (8, 'Stardew Valley', 'Выращивай урожай и обустраивай ферму.', 30, 60000, 20, 3),
  (9, 'Euro Truck Simulator 2', 'Развози грузы по городам Европы.', 10, 90000, 0, 3),
  (10, 'BeamNG.drive', 'Испытывай машины с реалистичной физикой.', 10, 169000, 0, 3)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  duration = excluded.duration,
  price = excluded.price,
  category_id = excluded.category_id
WHERE Services.name <> excluded.name;
