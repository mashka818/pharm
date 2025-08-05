-- Добавление полей для сетей аптек
ALTER TABLE companies ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subdomain VARCHAR(255) UNIQUE;

-- Обновление enum CompanyRole
ALTER TYPE "CompanyRole" ADD VALUE IF NOT EXISTS 'PHARMACY_NETWORK';

-- Создание индекса для быстрого поиска по поддомену
CREATE INDEX IF NOT EXISTS idx_companies_subdomain ON companies(subdomain);

-- Создание индекса для поиска сетей аптек
CREATE INDEX IF NOT EXISTS idx_companies_role ON companies(role);