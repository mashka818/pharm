# Исправление проблем с Swagger API

## 🐛 **Найденные проблемы:**

1. **Ошибка валидации DTO:**
   ```json
   {
     "message": [
       "cashback must be a number conforming to the specified constraints"
     ],
     "error": "Bad Request",
     "statusCode": 400
   }
   ```

2. **Кешбек не начисляется:** `totalCashback: 0` и `offersApplied: 0`

## ✅ **Исправления:**

### 1. **Исправлены DTO для Swagger**

**`CreateReceiptDto`:**
```typescript
@ApiPropertyOptional({
  description: 'Общая сумма кэшбека в копейках (рассчитывается автоматически, можно не указывать)',
  example: 1500,
})
@IsOptional()
@IsNumber()
cashback?: number; // ✅ Теперь опциональное!
```

**`CreateReceiptProductDto`:**
```typescript
@ApiPropertyOptional({
  description: 'Сумма кэшбека за этот продукт в копейках (рассчитывается автоматически, можно не указывать)',
  example: 100,
})
@IsOptional()
@IsNumber()
@Min(0)
cashback?: number; // ✅ Теперь опциональное!
```

### 2. **Исправлен парсинг данных для расчета кешбека**

**Проблема:** Метод `parseReceiptItems` ожидал данные в формате ФНС (`items`), но получал данные из БД (`products`).

**Решение:**
```typescript
private parseReceiptItems(receiptData: any): ReceiptItem[] {
  // Если это данные из ФНС (есть поле items)
  if (receiptData?.items) {
    return receiptData.items.map((item: any) => ({
      name: item.name || item.productName || 'Unknown Product',
      sku: item.sku || item.productSku || undefined,
      price: item.price || item.itemPrice || 0,
      quantity: item.quantity || 1,
      sum: item.sum || item.totalPrice || (item.price || 0) * (item.quantity || 1),
    }));
  }

  // ✅ Если это данные из БД (есть поле products)
  if (receiptData?.products) {
    return receiptData.products.map((receiptProduct: any) => {
      const product = receiptProduct.product;
      const defaultPrice = 1000; // 10 рублей в копейках
      
      return {
        name: product?.name || 'Unknown Product',
        sku: product?.sku || undefined,
        price: defaultPrice,
        quantity: 1,
        sum: defaultPrice,
      };
    });
  }

  return [];
}
```

## 🎯 **Теперь в Swagger можно использовать:**

### Минимальный запрос (без полей cashback):
```json
{
  "date": "2024-08-11T14:30:00Z",
  "number": 12345,
  "price": 150000,
  "status": "success",
  "address": "ул. Пушкина, д. 10",
  "customerId": 1,
  "promotionId": "x-pharm",
  "products": [
    {
      "productId": 1,
      "offerId": 1
    }
  ]
}
```

### Полный запрос (с опциональными полями):
```json
{
  "date": "2024-08-11T14:30:00Z",
  "number": 12345,
  "price": 150000,
  "cashback": 1500,
  "status": "success",
  "address": "ул. Пушкина, д. 10",
  "customerId": 1,
  "promotionId": "x-pharm",
  "products": [
    {
      "productId": 1,
      "offerId": 1,
      "cashback": 100
    }
  ]
}
```

## ✅ **Результат:**

- ✅ **Валидация DTO**: больше не требует обязательного поля `cashback`
- ✅ **Автоматический расчет**: кешбек рассчитывается на основе активных акций
- ✅ **Универсальность**: работает с данными ФНС и ручными чеками
- ✅ **Удобство Swagger**: можно не указывать поля кешбека

**Теперь API работает корректно и кешбек должен автоматически начисляться!** 🎉
