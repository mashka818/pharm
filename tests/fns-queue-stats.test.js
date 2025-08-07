const axios = require('axios');
const jwt = require('jsonwebtoken');

class FnsQueueStatsTest {
  constructor() {
    this.baseUrl = process.env.BACKEND_URL || 'http://localhost:4020';
    this.queueStatsEndpoint = `${this.baseUrl}/fns/queue/stats`;
    this.jwtSecret = process.env.JWT_SECRET || 'gpW7DtMraBcCf4rXXyMmLZ25cMsrjv6z';
  }

  // Generate JWT token for testing
  generateTestToken(userId = 1) {
    const payload = {
      id: userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
    };
    
    return jwt.sign(payload, this.jwtSecret);
  }

  async testGetQueueStatsSuccess() {
    console.log('✅ === Тест получения статистики очереди ===');
    console.log(`Endpoint: ${this.queueStatsEndpoint}`);
    
    try {
      const token = this.generateTestToken(1);
      
      console.log(`🔑 Токен: ${token.substring(0, 20)}...`);
      
      const response = await axios.get(this.queueStatsEndpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000,
      });

      console.log(`📊 Статус ответа: ${response.status}`);
      console.log(`📋 Тело ответа:`, JSON.stringify(response.data, null, 2));

      if (response.status === 200 && response.data) {
        // Проверяем структуру ответа согласно Swagger документации
        const expectedFields = ['pending', 'processing', 'success', 'failed', 'total'];
        const hasAllFields = expectedFields.every(field => 
          response.data.hasOwnProperty(field) && typeof response.data[field] === 'number'
        );
        
        if (hasAllFields) {
          console.log('✅ УСПЕХ: Статистика получена корректно');
          console.log('📊 Структура ответа валидна');
          
          // Проверяем логику данных
          const { pending, processing, success, failed, total } = response.data;
          const calculatedTotal = pending + processing + success + failed;
          const totalMatches = total === calculatedTotal;
          
          console.log(`📈 Проверка суммы: ${calculatedTotal} = ${total} (${totalMatches ? '✅' : '❌'})`);
          console.log(`📊 Pending: ${pending}`);
          console.log(`📊 Processing: ${processing}`);
          console.log(`📊 Success: ${success}`);
          console.log(`📊 Failed: ${failed}`);
          console.log(`📊 Total: ${total}`);
          
          return {
            success: true,
            data: response.data,
            hasAllFields,
            totalMatches,
            stats: { pending, processing, success, failed, total }
          };
        } else {
          console.log('❌ ОШИБКА: Неполная структура ответа');
          const missingFields = expectedFields.filter(field => 
            !response.data.hasOwnProperty(field) || typeof response.data[field] !== 'number'
          );
          console.log(`❌ Отсутствующие/невалидные поля: ${missingFields.join(', ')}`);
          
          return { 
            success: false, 
            error: 'Неполная структура ответа',
            missingFields
          };
        }
      } else {
        console.log('❌ ОШИБКА: Неожиданная структура ответа');
        return { success: false, error: 'Неожиданная структура ответа' };
      }
      
    } catch (error) {
      if (error.response) {
        console.log(`❌ HTTP Error ${error.response.status}: ${error.response.data?.message || error.response.statusText}`);
        console.log('📋 Ответ сервера:', JSON.stringify(error.response.data, null, 2));
        
        return { 
          success: false, 
          error: error.response.data?.message || error.message,
          status: error.response.status 
        };
      } else {
        console.log('❌ Ошибка сети:', error.message);
        return { success: false, error: error.message };
      }
    }
  }

  async testGetQueueStatsNoAuth() {
    console.log('\n🔐 === Тест без авторизации ===');
    
    try {
      const response = await axios.get(this.queueStatsEndpoint, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000,
      });

      console.log('❌ ОШИБКА: Запрос должен был завершиться с ошибкой авторизации');
      return { success: false, error: 'Авторизация не проверяется' };
      
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ УСПЕХ: Авторизация корректно проверяется');
        console.log(`📊 Статус: ${error.response.status}`);
        
        return { 
          success: true, 
          authError: true,
          status: error.response.status 
        };
      } else {
        console.log('❌ ОШИБКА: Неожиданный тип ошибки');
        return { success: false, error: error.message };
      }
    }
  }

  async testGetQueueStatsInvalidToken() {
    console.log('\n🔐 === Тест с невалидным токеном ===');
    
    try {
      const invalidToken = 'invalid.jwt.token';
      
      const response = await axios.get(this.queueStatsEndpoint, {
        headers: {
          'Authorization': `Bearer ${invalidToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000,
      });

      console.log('❌ ОШИБКА: Запрос должен был завершиться с ошибкой авторизации');
      return { success: false, error: 'Проверка токена не работает' };
      
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ УСПЕХ: Проверка токена корректно работает');
        console.log(`📊 Статус: ${error.response.status}`);
        
        return { 
          success: true, 
          tokenError: true,
          status: error.response.status 
        };
      } else {
        console.log('❌ ОШИБКА: Неожиданный тип ошибки');
        return { success: false, error: error.message };
      }
    }
  }

  async testGetQueueStatsMultipleRequests() {
    console.log('\n🔄 === Тест множественных запросов ===');
    
    const results = [];
    const requestCount = 5;
    
    console.log(`📊 Отправка ${requestCount} параллельных запросов...`);
    
    const promises = [];
    for (let i = 0; i < requestCount; i++) {
      const token = this.generateTestToken(i + 1);
      
      const promise = axios.get(this.queueStatsEndpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000,
      }).then(response => ({
        requestIndex: i,
        success: true,
        data: response.data,
        status: response.status
      })).catch(error => ({
        requestIndex: i,
        success: false,
        error: error.response?.data?.message || error.message,
        status: error.response?.status
      }));
      
      promises.push(promise);
    }
    
    const responses = await Promise.all(promises);
    
    const successCount = responses.filter(r => r.success).length;
    console.log(`📈 Успешных запросов: ${successCount}/${requestCount}`);
    
    // Проверяем консистентность данных
    const successfulResponses = responses.filter(r => r.success);
    if (successfulResponses.length > 1) {
      const firstStats = successfulResponses[0].data;
      const allSame = successfulResponses.every(r => 
        JSON.stringify(r.data) === JSON.stringify(firstStats)
      );
      
      console.log(`🔍 Консистентность данных: ${allSame ? '✅' : '❌'}`);
      
      if (!allSame) {
        console.log('⚠️ Различия в статистике между запросами:');
        successfulResponses.forEach((r, index) => {
          console.log(`  Запрос ${r.requestIndex}: ${JSON.stringify(r.data)}`);
        });
      }
    }
    
    return {
      success: successCount > 0,
      results: responses,
      successRate: successCount / requestCount,
      totalRequests: requestCount,
      successCount
    };
  }

  async testGetQueueStatsDataValidation() {
    console.log('\n🔍 === Тест валидации данных ===');
    
    try {
      const token = this.generateTestToken(1);
      
      const response = await axios.get(this.queueStatsEndpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000,
      });

      console.log(`📊 Статус ответа: ${response.status}`);
      
      const data = response.data;
      const validationResults = {
        allNumbers: true,
        allNonNegative: true,
        totalCorrect: true,
        hasExpectedFields: true
      };
      
      const expectedFields = ['pending', 'processing', 'success', 'failed', 'total'];
      
      // Проверяем наличие всех полей
      validationResults.hasExpectedFields = expectedFields.every(field => 
        data.hasOwnProperty(field)
      );
      
      // Проверяем, что все значения числа
      validationResults.allNumbers = expectedFields.every(field => 
        typeof data[field] === 'number'
      );
      
      // Проверяем, что все значения неотрицательные
      validationResults.allNonNegative = expectedFields.every(field => 
        data[field] >= 0
      );
      
      // Проверяем корректность суммы
      if (validationResults.allNumbers) {
        const calculatedTotal = data.pending + data.processing + data.success + data.failed;
        validationResults.totalCorrect = data.total === calculatedTotal;
        
        console.log(`📊 Pending: ${data.pending} (${typeof data.pending})`);
        console.log(`📊 Processing: ${data.processing} (${typeof data.processing})`);
        console.log(`📊 Success: ${data.success} (${typeof data.success})`);
        console.log(`📊 Failed: ${data.failed} (${typeof data.failed})`);
        console.log(`📊 Total: ${data.total} (расчетный: ${calculatedTotal})`);
      }
      
      // Выводим результаты валидации
      console.log('\n📋 Результаты валидации:');
      Object.entries(validationResults).forEach(([key, value]) => {
        console.log(`  ${value ? '✅' : '❌'} ${key}: ${value ? 'OK' : 'FAILED'}`);
      });
      
      const allValid = Object.values(validationResults).every(v => v);
      
      return {
        success: allValid,
        data,
        validationResults,
        allValid
      };
      
    } catch (error) {
      console.log(`❌ Ошибка: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async testGetQueueStatsDifferentUsers() {
    console.log('\n👥 === Тест доступа разных пользователей ===');
    
    const results = [];
    
    // Тестируем доступ от разных пользователей
    for (let userId = 1; userId <= 3; userId++) {
      console.log(`\n👤 Тестирование пользователя ${userId}`);
      
      try {
        const token = this.generateTestToken(userId);
        
        const response = await axios.get(this.queueStatsEndpoint, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000,
        });

        console.log(`📊 Статус ответа: ${response.status}`);
        console.log(`📋 Данные получены: ${response.data ? 'да' : 'нет'}`);

        results.push({
          userId,
          success: true,
          data: response.data
        });
        
      } catch (error) {
        if (error.response) {
          console.log(`❌ HTTP Error ${error.response.status}: ${error.response.data?.message || error.response.statusText}`);
          
          results.push({
            userId,
            success: false,
            error: error.response.data?.message || error.message,
            status: error.response.status
          });
        } else {
          console.log('❌ Ошибка сети:', error.message);
          results.push({
            userId,
            success: false,
            error: error.message
          });
        }
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`\n📈 Доступ разных пользователей: ${successCount}/${results.length} успешно`);
    
    // Проверяем, что все пользователи получают одинаковые данные
    const successfulResults = results.filter(r => r.success);
    if (successfulResults.length > 1) {
      const firstData = successfulResults[0].data;
      const allSameData = successfulResults.every(r => 
        JSON.stringify(r.data) === JSON.stringify(firstData)
      );
      
      console.log(`🔍 Консистентность данных для разных пользователей: ${allSameData ? '✅' : '❌'}`);
    }
    
    return {
      success: successCount > 0,
      results,
      successRate: successCount / results.length
    };
  }

  async runAllTests() {
    console.log('🚀 === Запуск всех тестов для FNS Queue Stats ===\n');
    
    const results = {
      queueStatsSuccess: await this.testGetQueueStatsSuccess(),
      noAuth: await this.testGetQueueStatsNoAuth(),
      invalidToken: await this.testGetQueueStatsInvalidToken(),
      multipleRequests: await this.testGetQueueStatsMultipleRequests(),
      dataValidation: await this.testGetQueueStatsDataValidation(),
      differentUsers: await this.testGetQueueStatsDifferentUsers()
    };

    console.log('\n📊 === Сводка результатов FNS Queue Stats тестов ===');
    
    let passedTests = 0;
    let totalTests = 0;
    
    Object.entries(results).forEach(([testName, result]) => {
      totalTests++;
      const status = result.success ? '✅ ПРОШЕЛ' : '❌ ПРОВАЛЕН';
      console.log(`${status} | ${testName}: ${result.error || result.message || 'OK'}`);
      if (result.success) passedTests++;
    });
    
    console.log(`\n📈 Общий результат: ${passedTests}/${totalTests} тестов прошли`);
    
    return {
      passed: passedTests,
      total: totalTests,
      results
    };
  }
}

module.exports = FnsQueueStatsTest;

// Запуск тестов если файл вызван напрямую
if (require.main === module) {
  const test = new FnsQueueStatsTest();
  test.runAllTests()
    .then(summary => {
      console.log('\n🏁 Тестирование завершено');
      process.exit(summary.passed === summary.total ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Критическая ошибка:', error);
      process.exit(1);
    });
}