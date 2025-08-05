# Инструкции по применению миграции мультитенантности

## Проблема

При запуске сервера возникает ошибка:
```
The column `fns_requests.promotionId` does not exist in the current database.
```

Это происходит потому, что схема Prisma была обновлена, но миграция не была применена к базе данных.

## Решение

### 1. Остановите сервер

Если сервер запущен, остановите его.

### 2. Примените миграцию

Выполните одну из команд в зависимости от ситуации:

#### Если база данных запущена локально:
```bash
npx prisma migrate deploy
```

#### Если нужно применить миграцию на продакшн:
```bash
npx prisma migrate deploy --schema prisma/schema.prisma
```

#### Если база данных пустая или нужно пересоздать:
```bash
npx prisma migrate reset
npx prisma db push
```

### 3. Альтернативный способ - применить SQL вручную

Если Prisma команды не работают, подключитесь к базе данных напрямую и выполните SQL из файла:
`prisma/migrations/20250805132750_add_multitenancy_support/migration.sql`

```sql
-- AlterTable
ALTER TABLE "promotions" ADD COLUMN     "appId" TEXT,
ADD COLUMN     "domain" TEXT NOT NULL DEFAULT 'default.domain',
ADD COLUMN     "inn" TEXT,
ADD COLUMN     "ogrn" TEXT;

-- AlterTable
ALTER TABLE "fns_requests" ADD COLUMN     "promotionId" TEXT NOT NULL DEFAULT 'default-promotion';

-- AlterTable
ALTER TABLE "receipts" ADD COLUMN     "customerId" INTEGER,
ADD COLUMN     "promotionId" TEXT NOT NULL DEFAULT 'default-promotion';

-- CreateIndex
CREATE UNIQUE INDEX "promotions_domain_key" ON "promotions"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_promotionId_key" ON "customers"("email", "promotionId");

-- AddForeignKey
ALTER TABLE "fns_requests" ADD CONSTRAINT "fns_requests_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("promotionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("promotionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Update existing promotions to have unique domains
UPDATE "promotions" SET "domain" = "promotionId" || '.checkpoint.rf' WHERE "domain" = 'default.domain';

-- Update existing data to use the default promotion if it doesn't exist
INSERT INTO "promotions" ("promotionId", "name", "logo", "favicon", "color", "description", "domain")
VALUES ('default-promotion', 'Default Network', '/logos/default.png', '/favicons/default.ico', '#007bff', 'Default promotion network', 'default.checkpoint.rf')
ON CONFLICT ("promotionId") DO NOTHING;
```

### 4. Создайте промоакцию для Р-Фарм

После применения миграции создайте промоакцию для сети Р-Фарм:

```sql
INSERT INTO "promotions" (
  "promotionId", 
  "name", 
  "logo", 
  "favicon", 
  "color", 
  "description",
  "domain",
  "inn",
  "ogrn",
  "appId"
) VALUES (
  'r-farm-network',
  'Р-Фарм',
  '/logos/r-farm.png',
  '/favicons/r-farm.ico', 
  '#007bff',
  'Сеть аптек Р-Фарм',
  'р-фарм.чекпоинт.рф',
  '5032364514',
  '1234567890123',
  '2dbfa911-1931-48e7-802f-640dc64429b0'
);
```

### 5. Обновите Prisma Client

```bash
npx prisma generate
```

### 6. Запустите сервер

```bash
npm run start:dev
```

## Проверка

После применения миграции сервер должен запуститься без ошибок. Вы увидите сообщения:

```
[Nest] DEBUG [FnsService] Processing pending FNS requests
```

Без ошибок о несуществующих колонках.

## Устранение проблем

### Если миграция не применяется:

1. Проверьте подключение к базе данных
2. Убедитесь, что пользователь БД имеет права на изменение схемы
3. Проверьте, что переменная `DATABASE_URL` корректна

### Если есть конфликты данных:

1. Сделайте резервную копию БД
2. Очистите таблицы `fns_requests` и `receipts`
3. Примените миграцию
4. Восстановите данные

### Если нужно откатить изменения:

```bash
npx prisma migrate reset
```

Затем восстановите БД из резервной копии.