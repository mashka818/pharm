# Быстрое исправление ошибки promotionId

## Ошибка
```
The column `fns_requests.promotionId` does not exist in the current database.
```

## Быстрое решение

### Вариант 1: Применить миграцию (рекомендуется)

1. **Остановите сервер**

2. **Примените миграцию**:
   ```bash
   npx prisma migrate deploy
   ```

3. **Если база недоступна, примените SQL вручную** в psql или pgAdmin:
   ```sql
   ALTER TABLE "fns_requests" ADD COLUMN "promotionId" TEXT NOT NULL DEFAULT 'default-promotion';
   ALTER TABLE "promotions" ADD COLUMN "domain" TEXT NOT NULL DEFAULT 'default.domain';
   ALTER TABLE "promotions" ADD COLUMN "inn" TEXT;
   ALTER TABLE "promotions" ADD COLUMN "ogrn" TEXT;
   ALTER TABLE "promotions" ADD COLUMN "appId" TEXT;
   ALTER TABLE "receipts" ADD COLUMN "customerId" INTEGER;
   ALTER TABLE "receipts" ADD COLUMN "promotionId" TEXT NOT NULL DEFAULT 'default-promotion';
   
   CREATE UNIQUE INDEX "promotions_domain_key" ON "promotions"("domain");
   CREATE UNIQUE INDEX "customers_email_promotionId_key" ON "customers"("email", "promotionId");
   
   INSERT INTO "promotions" ("promotionId", "name", "logo", "favicon", "color", "description", "domain")
   VALUES ('default-promotion', 'Default Network', '/logos/default.png', '/favicons/default.ico', '#007bff', 'Default promotion network', 'default.checkpoint.rf')
   ON CONFLICT ("promotionId") DO NOTHING;
   ```

4. **Обновите Prisma Client**:
   ```bash
   npx prisma generate
   ```

5. **Запустите сервер**:
   ```bash
   npm run start:dev
   ```

### Вариант 2: Временный обход (если миграция невозможна)

Код уже обновлен для работы без поля `promotionId`. Сервер будет работать в режиме обратной совместимости.

## Создание промоакции Р-Фарм

После применения миграции выполните в базе:

```sql
INSERT INTO "promotions" (
  "promotionId", "name", "logo", "favicon", "color", "description",
  "domain", "inn", "ogrn", "appId"
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

## Проверка

Сервер должен запуститься без ошибок и выводить:
```
[Nest] DEBUG [FnsService] Processing pending FNS requests
```

## API готов к использованию

После исправления можно использовать:

```bash
curl -X POST https://р-фарм.чекпоинт.рф/api/receipt/scan-qr \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fn": "9287440300090728",
    "fd": "77133",
    "fp": "1482926127",
    "sum": 240000,
    "date": "2019-04-09T16:38:00"
  }'
```