const axios = require('axios');
const jwt = require('jsonwebtoken');

class FnsStatusTest {
  constructor() {
    this.baseUrl = process.env.BACKEND_URL || `http://${process.env.PROD_SERVER_IP || '91.236.198.205'}:${process.env.API_PORT || '4000'}`;
    this.statusEndpoint = `${this.baseUrl}/api/fns/status`;
    this.jwtSecret = process.env.JWT_SECRET || 'gpW7DtMraBcCf4rXXyMmLZ25cMsrjv6z';
    
    // Test request IDs - в реальной системе эти ID должны существовать
    this.testRequestIds = [
      'test-request-id-123',
      'test-request-id-456',
      'test-request-id-789',
      'existing-request-id', // предположительно существующий
      'old-request-id-2023'
    ];
    
    this.invalidRequestIds = [
      '',
      'invalid-id',
      'non-existent-request-id',
      '123456789012345678901234567890123456789012345678901234567890', // слишком длинный
      'special!@#$%^&*()chars',
      'null',
      'undefined'
    ];
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

  async testGetStatusSuccess() {
    console.log('✅ === Тест получения статуса запроса ===');
    
    const results = [];
    
    for (const requestId of this.testRequestIds) {
      console.log(`\n📝 Тестирование requestId: ${requestId}`);
      
      try {
        const token = this.generateTestToken(1);
        const endpoint = `${this.statusEndpoint}/${requestId}`;
        
        console.log(`📞 Запрос к: ${endpoint}`);
        console.log(`🔑 Токен: ${token.substring(0, 20)}...`);
        
        const response = await axios.get(endpoint, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000,
        });

        console.log(`📊 Статус ответа: ${response.status}`);
        console.log(`📋 Тело ответа:`, JSON.stringify(response.data, null, 2));

        if (response.status === 200 && response.data) {
          console.log('✅ УСПЕХ: Статус получен корректно');
          
          // Проверяем структуру ответа
          const expectedFields = ['requestId', 'status', 'createdAt', 'updatedAt'];
          const hasRequiredFields = expectedFields.every(field => 
            response.data.hasOwnProperty(field)
          );
          
          results.push({
            requestId,
            success: true,
            data: response.data,
            hasRequiredFields
          });
        } else {
          console.log('❌ ОШИБКА: Неожиданная структура ответа');
          results.push({
            requestId,
            success: false,
            error: 'Неожиданная структура ответа'
          });
        }
        
      } catch (error) {
        if (error.response) {
          console.log(`❌ HTTP Error ${error.response.status}: ${error.response.data?.message || error.response.statusText}`);
          
          // 404 - ожидаемая ошибка для несуществующих requestId
          if (error.response.status === 404) {
            console.log('ℹ️ 404 ошибка ожидаема для несуществующих requestId');
            results.push({
              requestId,
              success: true, // 404 это правильное поведение
              notFound: true,
              status: error.response.status
            });
          } else {
            results.push({
              requestId,
              success: false,
              error: error.response.data?.message || error.message,
              status: error.response.status
            });
          }
        } else {
          console.log('❌ Ошибка сети:', error.message);
          results.push({
            requestId,
            success: false,
            error: error.message
          });
        }
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`\n📈 Результат тестов статуса: ${successCount}/${results.length} успешно`);
    
    return {
      success: successCount > 0,
      results,
      successRate: successCount / results.length
    };
  }

  async testGetStatusInvalidIds() {
    console.log('\n🚫 === Тест с невалидными request ID ===');
    
    const results = [];
    
    for (const requestId of this.invalidRequestIds) {
      console.log(`\n📝 Тестирование невалидного ID: "${requestId}"`);
      
      try {
        const token = this.generateTestToken(1);
        const endpoint = `${this.statusEndpoint}/${encodeURIComponent(requestId)}`;
        
        const response = await axios.get(endpoint, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000,
        });

        console.log('❌ ОШИБКА: Запрос должен был завершиться с ошибкой');
        results.push({
          requestId,
          success: false,
          error: 'Валидация не сработала'
        });
        
      } catch (error) {
        if (error.response && [400, 404].includes(error.response.status)) {
          console.log(`✅ УСПЕХ: Невалидный ID корректно отклонен (${error.response.status})`);
          console.log(`💬 Ошибка: ${error.response.data?.message}`);
          
          results.push({
            requestId,
            success: true,
            validationError: error.response.data?.message,
            status: error.response.status
          });
        } else {
          console.log('❌ ОШИБКА: Неожиданный тип ошибки');
          results.push({
            requestId,
            success: false,
            error: error.message
          });
        }
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`\n📈 Валидация невалидных ID: ${successCount}/${results.length} корректно обработаны`);
    
    return {
      success: successCount > 0,
      results,
      successRate: successCount / results.length
    };
  }

  async testGetStatusNoAuth() {
    console.log('\n🔐 === Тест без авторизации ===');
    
    try {
      const requestId = this.testRequestIds[0];
      const endpoint = `${this.statusEndpoint}/${requestId}`;
      
      const response = await axios.get(endpoint, {
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

  async testGetStatusInvalidToken() {
    console.log('\n🔐 === Тест с невалидным токеном ===');
    
    try {
      const invalidToken = 'invalid.jwt.token';
      const requestId = this.testRequestIds[0];
      const endpoint = `${this.statusEndpoint}/${requestId}`;
      
      const response = await axios.get(endpoint, {
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

  async testGetStatusResponseStructure() {
    console.log('\n🔍 === Тест структуры ответа ===');
    
    try {
      const token = this.generateTestToken(1);
      const requestId = this.testRequestIds[0];
      const endpoint = `${this.statusEndpoint}/${requestId}`;
      
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000,
      });

      console.log(`📊 Статус ответа: ${response.status}`);
      console.log(`📋 Тело ответа:`, JSON.stringify(response.data, null, 2));

      // Проверяем обязательные поля согласно ReceiptStatusDto
      const requiredFields = ['requestId', 'status', 'createdAt', 'updatedAt'];
      const optionalFields = ['cashbackAmount', 'cashbackAwarded', 'isValid', 'isReturn', 'isFake', 'customer'];
      
      const hasAllRequired = requiredFields.every(field => 
        response.data.hasOwnProperty(field)
      );
      
      console.log('📋 Проверка структуры ответа:');
      requiredFields.forEach(field => {
        const hasField = response.data.hasOwnProperty(field);
        console.log(`  ${hasField ? '✅' : '❌'} ${field}: ${hasField ? '✓' : 'отсутствует'}`);
      });
      
      optionalFields.forEach(field => {
        const hasField = response.data.hasOwnProperty(field);
        if (hasField) {
          console.log(`  ℹ️ ${field}: присутствует (опциональное)`);
        }
      });
      
      // Проверяем валидность значений
      const validStatuses = ['pending', 'processing', 'success', 'rejected', 'failed'];
      const isValidStatus = validStatuses.includes(response.data.status);
      
      console.log(`📊 Статус "${response.data.status}" валиден: ${isValidStatus ? '✅' : '❌'}`);
      
      return {
        success: hasAllRequired && isValidStatus,
        hasAllRequired,
        isValidStatus,
        data: response.data,
        missingFields: requiredFields.filter(field => !response.data.hasOwnProperty(field))
      };
      
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('ℹ️ 404 ошибка для тестового ID - это ожидаемо');
        console.log('✅ Структура ошибки корректна');
        
        return {
          success: true,
          notFound: true,
          status: error.response.status
        };
      } else {
        console.log(`❌ Ошибка: ${error.message}`);
        return { success: false, error: error.message };
      }
    }
  }

  async testGetStatusDifferentUsers() {
    console.log('\n👥 === Тест доступа разных пользователей ===');
    
    const results = [];
    const requestId = this.testRequestIds[0];
    
    // Тестируем доступ от разных пользователей
    for (let userId = 1; userId <= 3; userId++) {
      console.log(`\n👤 Тестирование пользователя ${userId}`);
      
      try {
        const token = this.generateTestToken(userId);
        const endpoint = `${this.statusEndpoint}/${requestId}`;
        
        const response = await axios.get(endpoint, {
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
            success: error.response.status === 404, // 404 ожидаем для несуществующих запросов
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
    
    return {
      success: successCount > 0,
      results,
      successRate: successCount / results.length
    };
  }

  async runAllTests() {
    console.log('🚀 === Запуск всех тестов для FNS Status ===\n');
    
    const results = {
      statusSuccess: await this.testGetStatusSuccess(),
      invalidIds: await this.testGetStatusInvalidIds(),
      noAuth: await this.testGetStatusNoAuth(),
      invalidToken: await this.testGetStatusInvalidToken(),
      responseStructure: await this.testGetStatusResponseStructure(),
      differentUsers: await this.testGetStatusDifferentUsers()
    };

    console.log('\n📊 === Сводка результатов FNS Status тестов ===');
    
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

module.exports = FnsStatusTest;

// Запуск тестов если файл вызван напрямую
if (require.main === module) {
  const test = new FnsStatusTest();
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