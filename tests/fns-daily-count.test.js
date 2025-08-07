const axios = require('axios');
const jwt = require('jsonwebtoken');

class FnsDailyCountTest {
  constructor() {
    this.baseUrl = process.env.BACKEND_URL || `http://${process.env.PROD_SERVER_IP || '91.236.198.205'}:${process.env.PORT || '4020'}`;
    this.dailyCountEndpoint = `${this.baseUrl}/fns/daily-count`;
    this.jwtSecret = process.env.JWT_SECRET || 'gpW7DtMraBcCf4rXXyMmLZ25cMsrjv6z';
    
    // Expected limit from controller
    this.expectedLimit = 1000;
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

  async testGetDailyCountSuccess() {
    console.log('✅ === Тест получения количества запросов за день ===');
    console.log(`Endpoint: ${this.dailyCountEndpoint}`);
    
    try {
      const token = this.generateTestToken(1);
      
      console.log(`🔑 Токен: ${token.substring(0, 20)}...`);
      
      const response = await axios.get(this.dailyCountEndpoint, {
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
        const expectedFields = ['count', 'limit'];
        const hasAllFields = expectedFields.every(field => 
          response.data.hasOwnProperty(field) && typeof response.data[field] === 'number'
        );
        
        if (hasAllFields) {
          console.log('✅ УСПЕХ: Данные получены корректно');
          console.log('📊 Структура ответа валидна');
          
          const { count, limit } = response.data;
          
          // Проверяем логику данных
          const countValid = count >= 0;
          const limitValid = limit > 0;
          const countWithinLimit = count <= limit;
          const limitMatches = limit === this.expectedLimit;
          
          console.log(`📊 Count: ${count} (валиден: ${countValid ? '✅' : '❌'})`);
          console.log(`📊 Limit: ${limit} (валиден: ${limitValid ? '✅' : '❌'})`);
          console.log(`📈 Count <= Limit: ${countWithinLimit ? '✅' : '❌'}`);
          console.log(`🔍 Ожидаемый лимит (${this.expectedLimit}): ${limitMatches ? '✅' : '❌'}`);
          
          return {
            success: true,
            data: response.data,
            hasAllFields,
            validations: {
              countValid,
              limitValid,
              countWithinLimit,
              limitMatches
            },
            stats: { count, limit }
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

  async testGetDailyCountNoAuth() {
    console.log('\n🔐 === Тест без авторизации ===');
    
    try {
      const response = await axios.get(this.dailyCountEndpoint, {
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

  async testGetDailyCountInvalidToken() {
    console.log('\n🔐 === Тест с невалидным токеном ===');
    
    try {
      const invalidToken = 'invalid.jwt.token';
      
      const response = await axios.get(this.dailyCountEndpoint, {
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

  async testGetDailyCountMultipleRequests() {
    console.log('\n🔄 === Тест множественных запросов ===');
    
    const results = [];
    const requestCount = 5;
    
    console.log(`📊 Отправка ${requestCount} последовательных запросов...`);
    
    // Отправляем запросы последовательно, чтобы проверить изменение счетчика
    for (let i = 0; i < requestCount; i++) {
      try {
        const token = this.generateTestToken(1); // тот же пользователь
        
        const response = await axios.get(this.dailyCountEndpoint, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000,
        });

        results.push({
          requestIndex: i,
          success: true,
          data: response.data,
          status: response.status
        });
        
        console.log(`📊 Запрос ${i + 1}: count=${response.data.count}, limit=${response.data.limit}`);
        
        // Небольшая задержка между запросами
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        results.push({
          requestIndex: i,
          success: false,
          error: error.response?.data?.message || error.message,
          status: error.response?.status
        });
        
        console.log(`❌ Запрос ${i + 1}: ошибка`);
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`📈 Успешных запросов: ${successCount}/${requestCount}`);
    
    // Анализируем изменение счетчика
    const successfulResults = results.filter(r => r.success);
    if (successfulResults.length > 1) {
      const counts = successfulResults.map(r => r.data.count);
      const isIncreasing = counts.every((count, index) => 
        index === 0 || count >= counts[index - 1]
      );
      
      console.log(`📈 Счетчик увеличивается/остается неизменным: ${isIncreasing ? '✅' : '❌'}`);
      console.log(`📊 Последовательность count: ${counts.join(' -> ')}`);
      
      // Проверяем консистентность лимита
      const limits = successfulResults.map(r => r.data.limit);
      const limitConsistent = limits.every(limit => limit === limits[0]);
      
      console.log(`🔍 Лимит остается постоянным: ${limitConsistent ? '✅' : '❌'}`);
    }
    
    return {
      success: successCount > 0,
      results,
      successRate: successCount / requestCount,
      totalRequests: requestCount,
      successCount
    };
  }

  async testGetDailyCountDataValidation() {
    console.log('\n🔍 === Тест валидации данных ===');
    
    try {
      const token = this.generateTestToken(1);
      
      const response = await axios.get(this.dailyCountEndpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000,
      });

      console.log(`📊 Статус ответа: ${response.status}`);
      
      const data = response.data;
      const validationResults = {
        hasCountField: data.hasOwnProperty('count'),
        hasLimitField: data.hasOwnProperty('limit'),
        countIsNumber: typeof data.count === 'number',
        limitIsNumber: typeof data.limit === 'number',
        countNonNegative: data.count >= 0,
        limitPositive: data.limit > 0,
        countWithinLimit: data.count <= data.limit,
        limitMatchesExpected: data.limit === this.expectedLimit
      };
      
      console.log('\n📋 Результаты валидации:');
      Object.entries(validationResults).forEach(([key, value]) => {
        console.log(`  ${value ? '✅' : '❌'} ${key}: ${value ? 'OK' : 'FAILED'}`);
      });
      
      console.log(`\n📊 Текущие данные:`);
      console.log(`  Count: ${data.count} (тип: ${typeof data.count})`);
      console.log(`  Limit: ${data.limit} (тип: ${typeof data.limit})`);
      console.log(`  Использование: ${((data.count / data.limit) * 100).toFixed(1)}%`);
      
      const allValid = Object.values(validationResults).every(v => v);
      
      return {
        success: allValid,
        data,
        validationResults,
        allValid,
        usagePercentage: (data.count / data.limit) * 100
      };
      
    } catch (error) {
      console.log(`❌ Ошибка: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async testGetDailyCountDifferentUsers() {
    console.log('\n👥 === Тест доступа разных пользователей ===');
    
    const results = [];
    
    // Тестируем доступ от разных пользователей
    for (let userId = 1; userId <= 3; userId++) {
      console.log(`\n👤 Тестирование пользователя ${userId}`);
      
      try {
        const token = this.generateTestToken(userId);
        
        const response = await axios.get(this.dailyCountEndpoint, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000,
        });

        console.log(`📊 Статус ответа: ${response.status}`);
        console.log(`📋 Данные: count=${response.data.count}, limit=${response.data.limit}`);

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
    
    // Проверяем, что лимит одинаковый для всех пользователей
    const successfulResults = results.filter(r => r.success);
    if (successfulResults.length > 1) {
      const limits = successfulResults.map(r => r.data.limit);
      const allSameLimit = limits.every(limit => limit === limits[0]);
      
      console.log(`🔍 Лимит одинаков для всех пользователей: ${allSameLimit ? '✅' : '❌'}`);
      
      // Анализируем счетчики - они могут отличаться, так как это общий счетчик
      const counts = successfulResults.map(r => r.data.count);
      console.log(`📊 Счетчики пользователей: ${counts.join(', ')}`);
    }
    
    return {
      success: successCount > 0,
      results,
      successRate: successCount / results.length
    };
  }

  async testGetDailyCountPerformance() {
    console.log('\n⚡ === Тест производительности ===');
    
    const requestCount = 10;
    const startTime = Date.now();
    
    console.log(`📊 Отправка ${requestCount} параллельных запросов...`);
    
    const promises = [];
    for (let i = 0; i < requestCount; i++) {
      const token = this.generateTestToken(i + 1);
      
      const promise = axios.get(this.dailyCountEndpoint, {
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
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    const successCount = responses.filter(r => r.success).length;
    const avgResponseTime = totalTime / requestCount;
    
    console.log(`📈 Успешных запросов: ${successCount}/${requestCount}`);
    console.log(`⏱️ Общее время: ${totalTime}ms`);
    console.log(`⚡ Среднее время ответа: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`🚀 Пропускная способность: ${(requestCount / (totalTime / 1000)).toFixed(2)} запросов/сек`);
    
    // Проверяем, что все успешные ответы имеют валидную структуру
    const successfulResponses = responses.filter(r => r.success);
    const allValidStructure = successfulResponses.every(r => 
      r.data && 
      typeof r.data.count === 'number' && 
      typeof r.data.limit === 'number'
    );
    
    console.log(`📊 Все ответы имеют валидную структуру: ${allValidStructure ? '✅' : '❌'}`);
    
    return {
      success: successCount > 0 && allValidStructure,
      results: responses,
      successRate: successCount / requestCount,
      totalTime,
      avgResponseTime,
      throughput: requestCount / (totalTime / 1000),
      allValidStructure
    };
  }

  async runAllTests() {
    console.log('🚀 === Запуск всех тестов для FNS Daily Count ===\n');
    
    const results = {
      dailyCountSuccess: await this.testGetDailyCountSuccess(),
      noAuth: await this.testGetDailyCountNoAuth(),
      invalidToken: await this.testGetDailyCountInvalidToken(),
      multipleRequests: await this.testGetDailyCountMultipleRequests(),
      dataValidation: await this.testGetDailyCountDataValidation(),
      differentUsers: await this.testGetDailyCountDifferentUsers(),
      performance: await this.testGetDailyCountPerformance()
    };

    console.log('\n📊 === Сводка результатов FNS Daily Count тестов ===');
    
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

module.exports = FnsDailyCountTest;

// Запуск тестов если файл вызван напрямую
if (require.main === module) {
  const test = new FnsDailyCountTest();
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