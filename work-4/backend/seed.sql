INSERT INTO coupons (code, percent) VALUES ('START10', 10), ('SPORT15', 15);
INSERT INTO categories (slug, name) VALUES ('street', 'Городские'), ('running', 'Беговые'), ('trail', 'Для трейла');

WITH source(sku, name, brand, description, image, price, discount, delivery_days, category) AS (
  SELECT 'SK-101', 'Metro Classic', 'Stride', 'Мягкая замша и широкая подошва для долгих прогулок.', '/shoes/metro.webp', 8490, 15, 2, 'street'
  UNION ALL SELECT 'SK-102', 'Aero Run', 'Pace', 'Лёгкий сетчатый верх и мягкая амортизация для пробежек.', '/shoes/aero.webp', 9990, 0, 2, 'running'
  UNION ALL SELECT 'SK-103', 'Court Low', 'Stride', 'Низкий силуэт из плотной кожи для повседневной носки.', '/shoes/court.webp', 7290, 0, 3, 'street'
  UNION ALL SELECT 'SK-104', 'District Gum', 'Northline', 'Зелёная замша и цепкая подошва из натуральной резины.', '/shoes/district.webp', 7890, 10, 3, 'street'
  UNION ALL SELECT 'SK-105', 'Trail Scout', 'Northline', 'Рельефный протектор для парковых троп и грунта.', '/shoes/trail.webp', 10990, 0, 4, 'trail'
  UNION ALL SELECT 'SK-106', 'Block High', 'Stride', 'Высокий мягкий воротник и прочный кожаный верх.', '/shoes/block.webp', 9590, 0, 3, 'street'
)
INSERT INTO products (sku, name, brand, description, image, price, discount, delivery_days, category_id)
SELECT sku, source.name, brand, description, image, price, discount, delivery_days, categories.id
FROM source JOIN categories ON categories.slug = source.category;
