const axios = require('axios');

// Данные вашего чека
const TEST_RECEIPT = {
  fn: "7380440801438274",
  fd: "156960", 
  fp: "881863638",
  sum: 120,
  date: "2025-06-01T20:29:00",
  typeOperation: 1,
  additionalData: {}
};

// Исправленные варианты для тестирования
const CORRECTED_RECEIPTS = [
  {
    ...TEST_RECEIPT,
    date: "2024-06-01T20:29:00", // Исправляем год
    name: "Fixed year (2024)"
  },
  {
    ...TEST_RECEIPT,
    sum: 12000, // Исправляем сумму (120 рублей = 12000 копеек)
    date: "2024-06-01T20:29:00",
    name: "Fixed year and sum (12000 kopecks)"
  },
  {
    ...TEST_RECEIPT,
    date: "2023-06-01T20:29:00", // Пробуем 2023 год
    name: "Try year 2023"
  }
];

async function testReceipt(receipt, name = "Original") {
  console.log(`\n🧪 Тестирование: ${name}`);
  console.log(`📋 Данные: ${JSON.stringify(receipt)}`);
  
  try {
    const response = await axios.post('http://localhost:3000/fns/debug-receipt', receipt, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ Ответ получен:`);
    console.log(`   Статус: ${response.data.finalResult?.status}`);
    console.log(`   Сообщение: ${response.data.finalResult?.message}`);
    
    if (response.data.errors && response.data.errors.length > 0) {
      console.log(`❌ Ошибки:`);
      response.data.errors.forEach(error => console.log(`   - ${error}`));
    }
    
    if (response.data.warnings && response.data.warnings.length > 0) {
      console.log(`⚠️ Предупреждения:`);
      response.data.warnings.forEach(warning => console.log(`   - ${warning}`));
    }

    if (response.data.finalResult?.suggestedSum && response.data.finalResult.suggestedSum !== receipt.sum) {
      console.log(`💡 Предлагаемая сумма: ${response.data.finalResult.suggestedSum} копеек вместо ${receipt.sum}`);
    }

    if (response.data.finalResult?.dateAnalysis) {
      const dateAnalysis = response.data.finalResult.dateAnalysis;
      console.log(`📅 Анализ даты:`);
      console.log(`   Оригинал: ${dateAnalysis.original}`);
      console.log(`   Год: ${dateAnalysis.year}`);
      console.log(`   В будущем: ${dateAnalysis.isInFuture}`);
      console.log(`   Корректный год: ${dateAnalysis.isReasonableYear}`);
    }

  } catch (error) {
    console.log(`❌ Ошибка при тестировании: ${error.message}`);
    if (error.response?.data) {
      console.log(`   Детали: ${JSON.stringify(error.response.data)}`);
    }
  }
}

async function runAllTests() {
  console.log('🔍 Отладка чека с проблемами\n');
  console.log('=' * 50);
  
  // Тестируем оригинальный чек
  await testReceipt(TEST_RECEIPT, "Оригинальный чек");
  
  // Тестируем исправленные варианты
  for (const receipt of CORRECTED_RECEIPTS) {
    await testReceipt(receipt, receipt.name);
  }
  
  console.log('\n🏁 Анализ завершен!');
  console.log('\n💡 Рекомендации:');
  console.log('1. Проверьте дату чека - она не должна быть в будущем');
  console.log('2. Убедитесь что сумма указана в копейках (120 рублей = 12000 копеек)');
  console.log('3. Проверьте корректность фискальных данных (fn, fd, fp)');
}

// Запуск тестирования
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { testReceipt, TEST_RECEIPT, CORRECTED_RECEIPTS };