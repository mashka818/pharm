#!/usr/bin/env node

// Обновленный раннер для всех FNS тестов (включая новые)

const FnsAuthTest = require('./fns-auth.test');
const FnsCheckTest = require('./fns-check.test');
const FnsErrorsTest = require('./fns-errors.test');
const FnsIntegrationTest = require('./fns-integration.test');
const FnsReceiptValidationTest = require('./fns-receipt-validation.test');
const FnsOperationsTest = require('./fns-operations.test');

class FnsTestRunner {
  constructor() {
    this.tests = [
      { name: 'auth', class: FnsAuthTest, title: 'Аутентификация FNS' },
      { name: 'check', class: FnsCheckTest, title: 'Проверка чеков' },
      { name: 'errors', class: FnsErrorsTest, title: 'Обработка ошибок' },
      { name: 'integration', class: FnsIntegrationTest, title: 'Интеграционные тесты' },
      { name: 'validation', class: FnsReceiptValidationTest, title: 'Валидация чеков' },
      { name: 'operations', class: FnsOperationsTest, title: 'Типы операций' }
    ];
  }

  showHelp() {
    console.log('📖 === ИСПОЛЬЗОВАНИЕ ТЕСТОВ FNS (ОБНОВЛЕННЫЙ) ===\n');
    
    console.log('🚀 Запуск всех тестов:');
    console.log('   node tests/run-all-fns-tests-updated.js\n');
    
    console.log('🎯 Запуск конкретного типа тестов:');
    this.tests.forEach(test => {
      console.log(`   node tests/run-all-fns-tests-updated.js ${test.name} # ${test.title}`);
    });
    console.log('');
    
    console.log('🔧 Переменные окружения:');
    console.log('   FTX_API_URL - URL FNS API (по умолчанию: https://openapi.nalog.ru:8090)');
    console.log('   FTX_TOKEN - Токен FNS API');
    console.log('   NODE_ENV - Окружение (development/production)\n');
    
    console.log('📋 Описание тестов:');
    console.log('   auth        - Тесты аутентификации с FNS API');
    console.log('   check       - Базовые тесты проверки чеков');
    console.log('   errors      - Тесты обработки различных ошибок');
    console.log('   integration - Комплексные интеграционные тесты');
    console.log('   validation  - Расширенная валидация разных типов чеков');
    console.log('   operations  - Тесты различных типов операций (продажа, возврат, etc.)\n');
  }

  async runSpecificTest(testName) {
    const test = this.tests.find(t => t.name === testName);
    
    if (!test) {
      console.log(`❌ Тест "${testName}" не найден`);
      console.log('Доступные тесты:', this.tests.map(t => t.name).join(', '));
      return { success: false, error: 'Тест не найден' };
    }

    console.log(`🎯 === Запуск теста: ${test.title} ===\n`);
    
    try {
      const testInstance = new test.class();
      
      // Определяем метод запуска тестов
      let result;
      if (testInstance.runAllTests) {
        result = await testInstance.runAllTests();
      } else if (testInstance.testAuthentication && test.name === 'auth') {
        result = await testInstance.testAuthentication();
      } else if (testInstance.runTests) {
        result = await testInstance.runTests();
      } else {
        console.log('⚠️ Метод запуска тестов не найден, пробуем стандартные методы...');
        
        // Пробуем найти любой подходящий метод
        const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(testInstance))
          .filter(name => name.startsWith('test') && typeof testInstance[name] === 'function');
        
        if (methods.length > 0) {
          console.log(`📋 Найдены методы: ${methods.join(', ')}`);
          console.log(`🚀 Запуск метода: ${methods[0]}`);
          result = await testInstance[methods[0]]();
        } else {
          throw new Error('Не найдено методов для запуска тестов');
        }
      }
      
      return {
        testName: test.name,
        testTitle: test.title,
        ...result
      };
      
    } catch (error) {
      console.log(`💥 Ошибка выполнения теста "${test.title}": ${error.message}`);
      return {
        testName: test.name,
        testTitle: test.title,
        success: false,
        error: error.message
      };
    }
  }

  async runAllTests() {
    console.log('🚀 === ЗАПУСК ВСЕХ FNS ТЕСТОВ (ОБНОВЛЕННЫЙ) ===\n');
    console.log('📅 Дата запуска:', new Date().toLocaleString('ru-RU'));
    console.log('🖥️ Среда:', process.env.NODE_ENV || 'development');
    console.log('🌐 FNS API URL:', process.env.FTX_API_URL || 'https://openapi.nalog.ru:8090');
    console.log('🔑 FNS Token:', process.env.FTX_TOKEN ? 'Настроен' : 'Не настроен');
    console.log('\n');

    console.log('📋 Тестируемые модули:');
    this.tests.forEach(test => {
      console.log(`  • ${test.name.padEnd(12)} - ${test.title}`);
    });
    console.log('\n============================================================\n');

    const results = [];
    let totalPassed = 0;
    let totalTests = 0;

    for (const test of this.tests) {
      const startTime = Date.now();
      
      console.log(`🎯 Запуск тестов для: ${test.name.toUpperCase()}`);
      console.log('────────────────────────────────────────');
      
      const result = await this.runSpecificTest(test.name);
      
      const duration = (Date.now() - startTime) / 1000;
      console.log(`⏱️ Время выполнения: ${duration.toFixed(2)} секунд\n`);
      
      results.push({
        ...result,
        duration
      });
      
      if (result.success) {
        totalPassed += (result.passed || 1);
        totalTests += (result.total || 1);
        console.log(`✅ Тесты ${test.name} завершены: ${result.passed || 1}/${result.total || 1}\n`);
      } else {
        totalTests += 1;
        console.log(`❌ Тесты ${test.name} провалены: ${result.error}\n`);
      }
    }

    // Итоговая сводка
    this.printSummary(results, totalPassed, totalTests);
    
    return {
      success: totalPassed === totalTests,
      passed: totalPassed,
      total: totalTests,
      results
    };
  }

  printSummary(results, totalPassed, totalTests) {
    console.log('📊 === ОБЩАЯ СВОДКА ТЕСТИРОВАНИЯ FNS ===\n');

    console.log('📋 Результаты по модулям:');
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const percentage = result.total ? ((result.passed / result.total) * 100).toFixed(1) : 'N/A';
      const testInfo = result.total ? `${result.passed}/${result.total} (${percentage}%)` : 'N/A';
      const duration = result.duration ? `${result.duration.toFixed(2)}s` : 'N/A';
      
      console.log(`  ${status} ${result.testName.padEnd(12)} | ${testInfo.padEnd(15)} | ${duration.padStart(8)} | ${result.testTitle}`);
    });

    console.log('\n📊 Общая статистика:');
    console.log(`  🎯 Модулей протестировано: ${results.length}`);
    console.log(`  ✅ Модулей прошли все тесты: ${results.filter(r => r.success).length}`);
    console.log(`  📈 Общий процент успеха: ${totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0}%`);
    console.log(`  🧪 Всего тестов выполнено: ${totalPassed}/${totalTests}`);
    console.log(`  ⏱️ Общее время выполнения: ${results.reduce((sum, r) => sum + (r.duration || 0), 0).toFixed(2)} секунд`);

    if (totalPassed === totalTests) {
      console.log('\n🎉 ВСЕ ТЕСТЫ ПРОШЛИ УСПЕШНО!');
    } else {
      console.log('\n⚠️ Некоторые тесты требуют внимания');
      
      const failedTests = results.filter(r => !r.success);
      if (failedTests.length > 0) {
        console.log('\n📋 Проваленные тесты:');
        failedTests.forEach(test => {
          console.log(`  ❌ ${test.testName}: ${test.error || 'Неизвестная ошибка'}`);
        });
      }
    }

    console.log('\n📄 Для детального анализа смотрите логи выше');
    console.log('🔧 Для решения проблем проверьте:');
    console.log('  - Доступность FNS API (https://openapi.nalog.ru:8090)');
    console.log('  - Корректность FTX_TOKEN');
    console.log('  - Сетевое подключение и файрвол');
    console.log('  - Лимиты запросов к FNS API');
  }
}

// Основная функция запуска
async function main() {
  const runner = new FnsTestRunner();
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // Запуск всех тестов
    const summary = await runner.runAllTests();
    process.exit(summary.success ? 0 : 1);
  } else if (args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    // Показать справку
    runner.showHelp();
    process.exit(0);
  } else {
    // Запуск конкретного теста
    const testName = args[0].toLowerCase();
    const result = await runner.runSpecificTest(testName);
    
    console.log(`\n🏁 Тестирование ${testName} завершено`);
    process.exit(result.success ? 0 : 1);
  }
}

// Запуск программы
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Критическая ошибка:', error);
    process.exit(1);
  });
}

module.exports = FnsTestRunner;