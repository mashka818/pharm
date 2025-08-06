#!/usr/bin/env node

const FnsAuthTest = require('./fns-auth.test');
const FnsCheckTest = require('./fns-check.test');
const FnsErrorsTest = require('./fns-errors.test');
const FnsIntegrationTest = require('./fns-integration.test');

/**
 * Главный скрипт для запуска всех тестов ФНС
 * Обеспечивает последовательное выполнение тестов и подробную отчетность
 */

class FnsTestRunner {
  constructor() {
    this.startTime = Date.now();
    this.results = {};
    
    // Конфигурация тестов
    this.testSuites = {
      auth: {
        name: 'Тесты аутентификации',
        description: 'Проверка получения токенов доступа',
        class: FnsAuthTest,
        required: true
      },
      check: {
        name: 'Тесты проверки чеков',
        description: 'Отправка сообщений и получение результатов',
        class: FnsCheckTest,
        required: true
      },
      errors: {
        name: 'Тесты обработки ошибок',
        description: 'Проверка различных сценариев ошибок',
        class: FnsErrorsTest,
        required: false
      },
      integration: {
        name: 'Интеграционные тесты',
        description: 'Полный цикл работы с ФНС API',
        class: FnsIntegrationTest,
        required: false
      }
    };
  }

  async runAllTests(options = {}) {
    console.log('🚀 === ЗАПУСК ВСЕХ ТЕСТОВ ФНС API ===');
    console.log(`📅 Время запуска: ${new Date().toLocaleString('ru-RU')}`);
    console.log(`🌐 Сервер: ${process.env.FTX_API_URL || 'https://openapi.nalog.ru:8090'}`);
    console.log(`🔑 Токен: ${(process.env.FTX_TOKEN || 'по умолчанию').substring(0, 20)}...`);
    console.log('─'.repeat(80));

    const runOnlyRequired = options.onlyRequired || false;
    const skipOptional = options.skipOptional || false;

    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    let skippedTests = 0;

    for (const [suiteName, suiteConfig] of Object.entries(this.testSuites)) {
      // Пропускаем необязательные тесты если указано
      if (skipOptional && !suiteConfig.required) {
        console.log(`⏭️ Пропуск ${suiteConfig.name} (необязательный тест)\n`);
        skippedTests++;
        continue;
      }

      // Выполняем только обязательные тесты если указано
      if (runOnlyRequired && !suiteConfig.required) {
        console.log(`⏭️ Пропуск ${suiteConfig.name} (выполняются только обязательные)\n`);
        skippedTests++;
        continue;
      }

      console.log(`\n🧪 === ${suiteConfig.name.toUpperCase()} ===`);
      console.log(`📝 ${suiteConfig.description}`);
      console.log(`🔸 Обязательный: ${suiteConfig.required ? 'Да' : 'Нет'}`);
      console.log('─'.repeat(60));

      try {
        const testInstance = new suiteConfig.class();
        const suiteStartTime = Date.now();
        
        const result = await testInstance.runAllTests();
        
        const suiteDuration = Date.now() - suiteStartTime;
        const suiteSuccess = this.analyzeSuiteResults(result);
        
        this.results[suiteName] = {
          name: suiteConfig.name,
          required: suiteConfig.required,
          success: suiteSuccess.allPassed,
          duration: suiteDuration,
          details: result,
          passed: suiteSuccess.passed,
          failed: suiteSuccess.failed,
          total: suiteSuccess.total
        };

        totalTests += suiteSuccess.total;
        passedTests += suiteSuccess.passed;
        failedTests += suiteSuccess.failed;

        const statusIcon = suiteSuccess.allPassed ? '✅' : '❌';
        const statusText = suiteSuccess.allPassed ? 'ПРОЙДЕН' : 'ПРОВАЛЕН';
        
        console.log(`\n${statusIcon} ${suiteConfig.name}: ${statusText}`);
        console.log(`📊 Результат: ${suiteSuccess.passed}/${suiteSuccess.total} тестов пройдено`);
        console.log(`⏱️ Время выполнения: ${(suiteDuration / 1000).toFixed(2)}с`);

        // Если обязательный тест провален, можем прервать выполнение
        if (!suiteSuccess.allPassed && suiteConfig.required && options.stopOnFailure) {
          console.log(`\n❌ КРИТИЧЕСКАЯ ОШИБКА: Обязательный тест провален`);
          console.log(`🛑 Остановка выполнения тестов`);
          break;
        }

      } catch (error) {
        console.log(`\n❌ КРИТИЧЕСКАЯ ОШИБКА в ${suiteConfig.name}:`);
        console.log(`📄 Детали: ${error.message}`);
        
        this.results[suiteName] = {
          name: suiteConfig.name,
          required: suiteConfig.required,
          success: false,
          error: error.message,
          duration: 0,
          passed: 0,
          failed: 1,
          total: 1
        };

        totalTests++;
        failedTests++;

        if (suiteConfig.required && options.stopOnFailure) {
          console.log(`🛑 Остановка выполнения из-за критической ошибки`);
          break;
        }
      }
    }

    // Итоговый отчет
    this.generateFinalReport(totalTests, passedTests, failedTests, skippedTests);
    
    return {
      success: failedTests === 0,
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      skipped: skippedTests,
      results: this.results
    };
  }

  analyzeSuiteResults(result) {
    if (typeof result === 'object' && result !== null) {
      const testResults = Object.values(result);
      const passed = testResults.filter(r => r && r.success === true).length;
      const total = testResults.length;
      const failed = total - passed;
      const allPassed = failed === 0;

      return { allPassed, passed, failed, total };
    }

    // Если результат не в ожидаемом формате
    return {
      allPassed: result === true || (result && result.success === true),
      passed: result === true || (result && result.success === true) ? 1 : 0,
      failed: result === true || (result && result.success === true) ? 0 : 1,
      total: 1
    };
  }

  generateFinalReport(totalTests, passedTests, failedTests, skippedTests) {
    const duration = Date.now() - this.startTime;
    const successRate = totalTests > 0 ? (passedTests / totalTests * 100).toFixed(1) : 0;

    console.log('\n' + '='.repeat(80));
    console.log('📊 === ИТОГОВЫЙ ОТЧЕТ ===');
    console.log('='.repeat(80));
    
    console.log(`📈 Общая статистика:`);
    console.log(`   Всего тестов: ${totalTests}`);
    console.log(`   ✅ Пройдено: ${passedTests}`);
    console.log(`   ❌ Провалено: ${failedTests}`);
    console.log(`   ⏭️ Пропущено: ${skippedTests}`);
    console.log(`   📊 Процент успеха: ${successRate}%`);
    console.log(`   ⏱️ Общее время: ${(duration / 1000).toFixed(2)}с`);

    console.log(`\n📋 Детализация по наборам тестов:`);
    
    Object.entries(this.results).forEach(([suiteName, result]) => {
      const statusIcon = result.success ? '✅' : '❌';
      const requiredText = result.required ? '🔸' : '🔹';
      
      console.log(`   ${statusIcon} ${requiredText} ${result.name}`);
      console.log(`      Результат: ${result.passed || 0}/${result.total || 0} тестов`);
      console.log(`      Время: ${((result.duration || 0) / 1000).toFixed(2)}с`);
      
      if (result.error) {
        console.log(`      Ошибка: ${result.error}`);
      }
    });

    // Рекомендации
    console.log(`\n💡 Рекомендации:`);
    
    if (failedTests === 0) {
      console.log(`   🎉 Все тесты пройдены успешно!`);
      console.log(`   ✨ ФНС API работает корректно`);
    } else {
      console.log(`   🔍 Проанализируйте провалившиеся тесты`);
      
      const failedRequired = Object.values(this.results)
        .filter(r => !r.success && r.required).length;
      
      if (failedRequired > 0) {
        console.log(`   ⚠️ Провалены ${failedRequired} обязательных теста(ов)`);
        console.log(`   🛠️ Требуется исправление для корректной работы с ФНС`);
      }
      
      const authFailed = this.results.auth && !this.results.auth.success;
      if (authFailed) {
        console.log(`   🔑 Проверьте настройки аутентификации (токен, IP)`);
      }
    }

    console.log('\n' + '='.repeat(80));
    
    const overallSuccess = failedTests === 0;
    const resultIcon = overallSuccess ? '🎯' : '💥';
    const resultText = overallSuccess ? 'УСПЕШНО ЗАВЕРШЕНО' : 'ЗАВЕРШЕНО С ОШИБКАМИ';
    
    console.log(`${resultIcon} ТЕСТИРОВАНИЕ ${resultText}`);
    console.log('='.repeat(80));
  }

  async runQuickTest() {
    console.log('⚡ === БЫСТРЫЙ ТЕСТ ДОСТУПНОСТИ ФНС ===\n');
    
    try {
      const authTest = new FnsAuthTest();
      const result = await authTest.testAuthentication();
      
      if (result.success) {
        console.log('✅ Быстрый тест: ФНС API доступен');
        console.log(`🔑 Токен получен: ${result.token.substring(0, 32)}...`);
        console.log(`⏰ Время истечения: ${result.expiryInfo}`);
        return { success: true, token: result.token };
      } else {
        console.log('❌ Быстрый тест: Проблемы с доступом к ФНС API');
        console.log(`📄 Ошибка: ${result.error}`);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.log('❌ Быстрый тест: Критическая ошибка');
      console.log(`📄 Детали: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  printUsage() {
    console.log(`
🧪 ФНС API Test Runner - Инструмент тестирования интеграции с ФНС

Использование:
  node run-all-fns-tests.js [опции]

Опции:
  --quick              Быстрый тест доступности (только аутентификация)
  --required-only      Запуск только обязательных тестов
  --skip-optional      Пропуск необязательных тестов
  --stop-on-failure    Остановка при первой критической ошибке
  --help              Показать эту справку

Переменные окружения:
  FTX_TOKEN           Мастер-токен ФНС (обязательно для продакшена)
  FTX_API_URL         URL API ФНС (по умолчанию: https://openapi.nalog.ru:8090)

Примеры:
  node run-all-fns-tests.js                    # Полный набор тестов
  node run-all-fns-tests.js --quick            # Быстрая проверка
  node run-all-fns-tests.js --required-only    # Только критичные тесты
  node run-all-fns-tests.js --stop-on-failure  # Остановка при ошибке

Наборы тестов:
  🔸 Аутентификация    - Получение токенов доступа (обязательный)
  🔸 Проверка чеков    - Отправка и получение сообщений (обязательный)
  🔹 Обработка ошибок  - Различные сценарии ошибок (опциональный)
  🔹 Интеграционные    - Полный цикл работы с API (опциональный)
    `);
  }
}

// Обработка аргументов командной строки
async function main() {
  const args = process.argv.slice(2);
  const runner = new FnsTestRunner();

  // Справка
  if (args.includes('--help') || args.includes('-h')) {
    runner.printUsage();
    process.exit(0);
  }

  // Быстрый тест
  if (args.includes('--quick')) {
    const result = await runner.runQuickTest();
    process.exit(result.success ? 0 : 1);
  }

  // Настройки запуска
  const options = {
    onlyRequired: args.includes('--required-only'),
    skipOptional: args.includes('--skip-optional'),
    stopOnFailure: args.includes('--stop-on-failure')
  };

  try {
    const result = await runner.runAllTests(options);
    
    // Возвращаем соответствующий код выхода
    process.exit(result.success ? 0 : 1);
    
  } catch (error) {
    console.error('\n💥 Критическая ошибка в Test Runner:', error.message);
    console.error('📄 Stack trace:', error.stack);
    process.exit(2);
  }
}

// Запуск если файл запущен напрямую
if (require.main === module) {
  main().catch(error => {
    console.error('Необработанная ошибка:', error);
    process.exit(2);
  });
}

module.exports = FnsTestRunner;