-- Инициализация тестовых данных для интеграции QR-кодов ФНС

-- 1. Создание тестовой акции (promotion)
INSERT INTO promotions (promotion_id, name, logo, favicon, color, description)
VALUES (
  'test-promotion-1',
  'Тестовая акция Р-Фарм',
  'https://example.com/logo.png',
  'https://example.com/favicon.ico',
  '#FF6B6B',
  'Тестовая акция для сети Р-Фарм'
) ON CONFLICT (promotion_id) DO NOTHING;

-- 2. Создание тестовой сети аптек Р-Фарм
INSERT INTO companies (username, password, name, subdomain, promotion_id, role)
VALUES (
  'r-pharm-test',
  '$2b$10$hashed_password_here', -- Замените на реальный хеш пароля
  'Р-Фарм',
  'р-фарм',
  'test-promotion-1',
  'PHARMACY_NETWORK'
) ON CONFLICT (username) DO NOTHING;

-- 3. Создание тестовой сети аптек Аптека 36.6
INSERT INTO companies (username, password, name, subdomain, promotion_id, role)
VALUES (
  'apteka-36-6-test',
  '$2b$10$hashed_password_here', -- Замените на реальный хеш пароля
  'Аптека 36.6',
  'apteka-36-6',
  'test-promotion-1',
  'PHARMACY_NETWORK'
) ON CONFLICT (username) DO NOTHING;

-- 4. Создание тестового бренда
INSERT INTO brands (promotion_id, description, name, logo)
VALUES (
  'test-promotion-1',
  'Тестовый бренд лекарств',
  'ТестБренд',
  'https://example.com/brand-logo.png'
);

-- 5. Создание тестовых продуктов
INSERT INTO products (name, sku, fix_cashback, cashback_type, brand_id, promotion_id)
VALUES 
  ('Парацетамол 500мг', 'PAR-500-001', 50, 'amount', 1, 'test-promotion-1'),
  ('Аспирин 100мг', 'ASP-100-001', 5, 'percent', 1, 'test-promotion-1'),
  ('Витамин C 1000мг', 'VIT-C-1000-001', 100, 'amount', 1, 'test-promotion-1');

-- 6. Создание тестового предложения
INSERT INTO offers (profit, profit_type, banner_image, banner_color, date_from, date_to, promotion_id)
VALUES (
  10,
  'PERCENT',
  'https://example.com/offer-banner.png',
  '#4ECDC4',
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE + INTERVAL '30 days',
  'test-promotion-1'
);

-- 7. Связывание продуктов с предложением
INSERT INTO product_offers (product_id, offer_id)
VALUES 
  (1, 1),
  (2, 1),
  (3, 1);

-- 8. Создание тестового пользователя
INSERT INTO customers (name, surname, email, promotion_id, password, address, role)
VALUES (
  'Тест',
  'Пользователь',
  'test@example.com',
  'test-promotion-1',
  '$2b$10$hashed_password_here', -- Замените на реальный хеш пароля
  'Тестовый адрес',
  'CUSTOMER'
) ON CONFLICT (email) DO NOTHING;

-- 9. Создание тестового токена ФНС
INSERT INTO fns_tokens (token, expires_at)
VALUES (
  'test-fns-token-12345',
  CURRENT_TIMESTAMP + INTERVAL '1 hour'
);

-- 10. Создание записи о дневном лимите
INSERT INTO fns_daily_limits (date, count)
VALUES (CURRENT_DATE, 0)
ON CONFLICT (date) DO NOTHING;

-- Проверка созданных данных
SELECT 'Промоции:' as info;
SELECT promotion_id, name FROM promotions WHERE promotion_id = 'test-promotion-1';

SELECT 'Сети аптек:' as info;
SELECT id, name, subdomain, role FROM companies WHERE role = 'PHARMACY_NETWORK';

SELECT 'Продукты:' as info;
SELECT id, name, sku, cashback_type FROM products WHERE promotion_id = 'test-promotion-1';

SELECT 'Предложения:' as info;
SELECT id, profit, profit_type FROM offers WHERE promotion_id = 'test-promotion-1';

SELECT 'Пользователи:' as info;
SELECT id, name, surname, email FROM customers WHERE promotion_id = 'test-promotion-1';