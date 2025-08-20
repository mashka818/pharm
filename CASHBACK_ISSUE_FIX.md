# Исправление проблемы с начислением кешбека

## 🐛 **Найденная проблема:**

При сравнении тестового и обычного чека обнаружено:
- ✅ **Тестовый чек** - кешбек начисляется клиенту  
- ❌ **Обычный чек** - кешбек НЕ начисляется клиенту

## 🔍 **Причина:**

В методе `CashbackService.awardCashback()` параметр `fnsRequestId` был обязательным (`string`), и код всегда пытался обновить `FnsRequest`:

```typescript
// ❌ СТАРЫЙ КОД - ошибка
async awardCashback(
  customerId: number,
  fnsRequestId: string, // Обязательный параметр!
  receiptId: number | null,
  promotionId: string,
  calculationResult: CashbackCalculationResult
) {
  // ...
  // 3. Обновляем статус FnsRequest - ВСЕГДА!
  await tx.fnsRequest.update({
    where: { id: fnsRequestId }, // Ошибка для обычных чеков!
    data: {
      cashbackAmount: calculationResult.totalCashback,
      cashbackAwarded: true,
    },
  });
}
```

**Для обычных чеков** `fnsRequestId` равен `null`, но метод пытался обновить несуществующий `FnsRequest`.

## ✅ **Исправление:**

1. **Сделал `fnsRequestId` опциональным:**
```typescript
async awardCashback(
  customerId: number,
  fnsRequestId: string | null, // ✅ Теперь опциональный!
  receiptId: number | null,
  promotionId: string,
  calculationResult: CashbackCalculationResult
)
```

2. **Добавил условную проверку:**
```typescript
// 3. Обновляем статус FnsRequest (только если есть fnsRequestId)
if (fnsRequestId) {
  await tx.fnsRequest.update({
    where: { id: fnsRequestId },
    data: {
      cashbackAmount: calculationResult.totalCashback,
      cashbackAwarded: true,
    },
  });
}
```

3. **Исправил вызов в `ReceiptsService`:**
```typescript
const cashbackResult = await this.cashbackService.awardCashback(
  createReceiptDto.customerId,
  null, // ✅ Для обычных чеков передаем null
  receipt.id,
  createReceiptDto.promotionId,
  cashbackCalculation
);
```

## 🧪 **Теперь система работает:**

### Обычные чеки (`POST /receipts`):
- ✅ Создается чек
- ✅ Рассчитывается кешбек  
- ✅ **Начисляется кешбек клиенту** (обновляются бонусы)
- ✅ Создается запись в `Cashback` и `CashbackItem`
- ✅ `FnsRequest` не обновляется (так как его нет)

### ФНС чеки (`POST /fns/scan-qr`):
- ✅ Создается чек через ФНС
- ✅ Рассчитывается кешбек
- ✅ Начисляется кешбек клиенту  
- ✅ **Обновляется `FnsRequest`** (так как `fnsRequestId` есть)

### Тестовые чеки (`POST /receipts/test-cashback`):
- ✅ Работает как и раньше
- ✅ Создает прямой кешбек через собственную логику

## 🎯 **Результат:**

Теперь **ВСЕ** типы чеков корректно начисляют кешбек клиентам! 🎉
