const FnsScanQrTest = require('./fns-scan-qr.test');
const FnsVerifyTest = require('./fns-verify.test');
const FnsStatusTest = require('./fns-status.test');
const FnsQueueStatsTest = require('./fns-queue-stats.test');
const FnsDailyCountTest = require('./fns-daily-count.test');

class FnsEndpointsTestRunner {
  constructor() {
    this.tests = {
      scanQr: new FnsScanQrTest(),
      verify: new FnsVerifyTest(),
      status: new FnsStatusTest(),
      queueStats: new FnsQueueStatsTest(),
      dailyCount: new FnsDailyCountTest()
    };
    
    this.results = {};
  }

  async runAllEndpointTests() {
    console.log('🚀 === Запуск всех тестов FNS эндпоинтов ===\n');
    console.log('📋 Тестируемые эндпоинты:');
    console.log('  • POST /fns/scan-qr - Сканирование QR кода');
    console.log('  • POST /fns/verify - Проверка чека (legacy)');
    console.log('  • GET /fns/status/:requestId - Статус запроса');
    console.log('  • GET /fns/queue/stats - Статистика очереди');
    console.log('  • GET /fns/daily-count - Количество запросов за день');
    console.log('\n' + '='.repeat(60) + '\n');

    const startTime = Date.now();

    // Выполняем тесты последовательно для каждого эндпоинта
    for (const [testName, testInstance] of Object.entries(this.tests)) {
      console.log(`🎯 Запуск тестов для: ${testName.toUpperCase()}`);
      console.log('─'.repeat(40));
      
      try {
        const result = await testInstance.runAllTests();
        this.results[testName] = {
          ...result,
          testName,
          status: 'completed'
        };
        
        console.log(`✅ Тесты ${testName} завершены: ${result.passed}/${result.total}`);
        
      } catch (error) {
        console.error(`❌ Ошибка при выполнении тестов ${testName}:`, error.message);
        this.results[testName] = {
          testName,
          status: 'failed',
          error: error.message,
          passed: 0,
          total: 0
        };
      }
      
      console.log('\n');
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    this.printSummary(totalTime);
    return this.results;
  }

  printSummary(totalTime) {
    console.log('📊 === ОБЩАЯ СВОДКА ТЕСТИРОВАНИЯ FNS ЭНДПОИНТОВ ===\n');
    
    let totalPassed = 0;
    let totalTests = 0;
    let successfulEndpoints = 0;
    
    console.log('📋 Результаты по эндпоинтам:');
    Object.entries(this.results).forEach(([testName, result]) => {
      const status = result.status === 'completed' ? 
        (result.passed === result.total ? '✅' : '⚠️') : 
        '❌';
      
      const passRate = result.total > 0 ? 
        `${result.passed}/${result.total} (${((result.passed / result.total) * 100).toFixed(1)}%)` : 
        '0/0';
        
      console.log(`  ${status} ${testName.padEnd(12)} | ${passRate.padEnd(20)} | ${result.status}`);
      
      totalPassed += result.passed || 0;
      totalTests += result.total || 0;
      
      if (result.status === 'completed' && result.passed === result.total) {
        successfulEndpoints++;
      }
    });
    
    console.log('\n📊 Общая статистика:');
    console.log(`  🎯 Эндпоинтов протестировано: ${Object.keys(this.results).length}`);
    console.log(`  ✅ Эндпоинтов прошли все тесты: ${successfulEndpoints}`);
    console.log(`  📈 Общий процент успеха: ${totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0}%`);
    console.log(`  🧪 Всего тестов выполнено: ${totalPassed}/${totalTests}`);
    console.log(`  ⏱️ Общее время выполнения: ${(totalTime / 1000).toFixed(2)} секунд`);
    
    console.log('\n📋 Рекомендации:');
    
    Object.entries(this.results).forEach(([testName, result]) => {
      if (result.status === 'failed') {
        console.log(`  ❌ ${testName}: Проверьте конфигурацию и доступность сервиса`);
      } else if (result.passed < result.total) {
        console.log(`  ⚠️ ${testName}: ${result.total - result.passed} тестов провалены - проверьте логи`);
      }
    });
    
    if (successfulEndpoints === Object.keys(this.results).length) {
      console.log('\n🎉 ВСЕ ЭНДПОИНТЫ ПРОШЛИ ТЕСТИРОВАНИЕ УСПЕШНО!');
    } else {
      console.log('\n⚠️ Некоторые эндпоинты требуют внимания');
    }
    
    console.log('\n📄 Детальные логи доступны выше для каждого эндпоинта');
    console.log('🔧 Для решения проблем проверьте:');
    console.log('  - Доступность бэкенд сервера (BACKEND_URL)');
    console.log('  - Корректность JWT_SECRET');
    console.log('  - Настройки авторизации и базы данных');
    console.log('  - Конфигурацию FNS API (FTX_API_URL, FTX_TOKEN)');
  }

  async runSpecificEndpoint(endpointName) {
    if (!this.tests[endpointName]) {
      console.error(`❌ Тест для эндпоинта "${endpointName}" не найден`);
      console.log('📋 Доступные эндпоинты:', Object.keys(this.tests).join(', '));
      return null;
    }
    
    console.log(`🎯 Запуск тестов только для эндпоинта: ${endpointName.toUpperCase()}\n`);
    
    const startTime = Date.now();
    
    try {
      const result = await this.tests[endpointName].runAllTests();
      const endTime = Date.now();
      
      console.log(`\n⏱️ Время выполнения: ${((endTime - startTime) / 1000).toFixed(2)} секунд`);
      
      return result;
    } catch (error) {
      console.error(`❌ Ошибка при выполнении тестов ${endpointName}:`, error.message);
      return { passed: 0, total: 0, error: error.message };
    }
  }

  printUsage() {
    console.log('📖 === ИСПОЛЬЗОВАНИЕ ТЕСТОВ FNS ЭНДПОИНТОВ ===\n');
    console.log('🚀 Запуск всех тестов:');
    console.log('   node tests/run-all-new-fns-tests.js\n');
    console.log('🎯 Запуск конкретного эндпоинта:');
    console.log('   node tests/run-all-new-fns-tests.js scanQr');
    console.log('   node tests/run-all-new-fns-tests.js verify');
    console.log('   node tests/run-all-new-fns-tests.js status');
    console.log('   node tests/run-all-new-fns-tests.js queueStats');
    console.log('   node tests/run-all-new-fns-tests.js dailyCount\n');
    console.log('🔧 Переменные окружения:');
    console.log('   BACKEND_URL - URL бэкенд сервера (по умолчанию: http://localhost:4020)');
    console.log('   JWT_SECRET - Секрет для JWT токенов');
    console.log('   FTX_API_URL - URL FNS API');
    console.log('   FTX_TOKEN - Токен FNS API\n');
  }
}

// Функция для запуска тестов
async function runTests() {
  const runner = new FnsEndpointsTestRunner();
  
  // Получаем аргумент командной строки
  const specificEndpoint = process.argv[2];
  
  if (specificEndpoint === 'help' || specificEndpoint === '--help' || specificEndpoint === '-h') {
    runner.printUsage();
    return;
  }
  
  try {
    let results;
    
    if (specificEndpoint) {
      // Запуск конкретного эндпоинта
      results = await runner.runSpecificEndpoint(specificEndpoint);
      if (results) {
        const success = results.passed === results.total;
        process.exit(success ? 0 : 1);
      } else {
        process.exit(1);
      }
    } else {
      // Запуск всех тестов
      results = await runner.runAllEndpointTests();
      
      // Определяем код выхода
      const allPassed = Object.values(results).every(result => 
        result.status === 'completed' && result.passed === result.total
      );
      
      process.exit(allPassed ? 0 : 1);
    }
    
  } catch (error) {
    console.error('💥 Критическая ошибка при запуске тестов:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Проверяем, вызван ли файл напрямую
if (require.main === module) {
  console.log('🧪 === FNS ENDPOINTS AUTOMATED TESTING SUITE ===\n');
  console.log('📅 Дата запуска:', new Date().toLocaleString('ru-RU'));
  console.log('🖥️ Среда:', process.env.NODE_ENV || 'development');
  console.log('🌐 Backend URL:', process.env.BACKEND_URL || 'http://localhost:4020');
  console.log('\n');
  
  runTests();
}

module.exports = FnsEndpointsTestRunner;