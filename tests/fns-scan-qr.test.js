const axios = require('axios');
const jwt = require('jsonwebtoken');

class FnsScanQrTest {
  constructor() {
    this.baseUrl = process.env.BACKEND_URL || `http://${process.env.PROD_SERVER_IP || '91.236.198.205'}:${process.env.API_PORT || '4000'}`;
    this.scanQrEndpoint = `${this.baseUrl}/api/fns/scan-qr`;
    this.jwtSecret = process.env.JWT_SECRET || 'gpW7DtMraBcCf4rXXyMmLZ25cMsrjv6z';
    
    // Test data based on real FNS receipt format
    this.validQrData = {
      fn: '9287440300090728',
      fd: '77133',
      fp: '1482926127',
      sum: 240000, // 2400 рублей в копейках
      date: '2019-04-09T16:38:00',
      typeOperation: 1
    };
    
    this.invalidQrData = {
      fn: 'invalid',
      fd: '',
      fp: '',
      sum: -100,
      date: 'invalid-date'
    };

          // Test network domains (должны быть в латинице для HTTP заголовков)
      // Используем простые домены для тестирования
      this.testDomains = [
        'test.domain.com',
        'example.com',
        'pharmvision.test'
      ];
  }

  // Generate JWT token for testing
  generateTestToken(userId = 1, promotionId = 'test-promotion-id') {
    const payload = {
      id: userId,
      promotionId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
    };
    
    return jwt.sign(payload, this.jwtSecret);
  }

  async testScanQrSuccess() {
    console.log('✅ === Тест успешного сканирования QR кода ===');
    console.log(`Endpoint: ${this.scanQrEndpoint}`);
    console.log(`Данные QR: ${JSON.stringify(this.validQrData)}`);
    
    try {
      const token = this.generateTestToken(1, 'test-promotion-123');
      const host = this.testDomains[0];
      
      console.log(`🔑 Токен: ${token.substring(0, 20)}...`);
      console.log(`🌐 Host: ${host}`);
      
      const response = await axios.post(this.scanQrEndpoint, this.validQrData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'host': host
        },
        timeout: 30000,
      });

      console.log(`📊 Статус ответа: ${response.status}`);
      console.log(`📋 Тело ответа:`, JSON.stringify(response.data, null, 2));

      const result = response.data;
      
      if (result.status && ['pending', 'rejected'].includes(result.status)) {
        console.log('✅ УСПЕХ: QR код обработан корректно');
        console.log(`📝 Статус: ${result.status}`);
        console.log(`💬 Сообщение: ${result.message}`);
        
        return {
          success: true,
          status: result.status,
          requestId: result.requestId,
          network: result.network,
          message: result.message
        };
      } else {
        console.log('❌ ОШИБКА: Неожиданная структура ответа');
        return { success: false, error: 'Неожиданная структура ответа' };
      }
      
    } catch (error) {
      if (error.response) {
        console.log(`❌ HTTP Error ${error.response.status}: ${error.response.data?.message || error.response.statusText}`);
        console.log('📋 Ответ сервера:', JSON.stringify(error.response.data, null, 2));
        
        // Проверяем ожидаемые ошибки
        if (error.response.status === 400) {
          console.log('ℹ️ Ошибка 400 может быть ожидаемой (проблемы с данными или лимитами)');
        }
        
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

  async testScanQrInvalidData() {
    console.log('\n🚫 === Тест с невалидными данными QR кода ===');
    console.log(`Невалидные данные: ${JSON.stringify(this.invalidQrData)}`);
    
    try {
      const token = this.generateTestToken(1, 'test-promotion-123');
      const host = this.testDomains[0];
      
      const response = await axios.post(this.scanQrEndpoint, this.invalidQrData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'host': host
        },
        timeout: 30000,
      });

      console.log('❌ ОШИБКА: Запрос должен был завершиться с ошибкой');
      return { success: false, error: 'Валидация не сработала' };
      
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ УСПЕХ: Валидация корректно отклонила невалидные данные');
        console.log(`📊 Статус: ${error.response.status}`);
        console.log(`💬 Ошибка: ${error.response.data?.message}`);
        
        return { 
          success: true, 
          validationError: error.response.data?.message,
          status: error.response.status 
        };
      } else {
        console.log('❌ ОШИБКА: Неожиданный тип ошибки');
        return { success: false, error: error.message };
      }
    }
  }

  async testScanQrNoAuth() {
    console.log('\n🔐 === Тест без авторизации ===');
    
    try {
      const host = this.testDomains[0];
      
      const response = await axios.post(this.scanQrEndpoint, this.validQrData, {
        headers: {
          'Content-Type': 'application/json',
          'host': host
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

  async testScanQrInvalidHost() {
    console.log('\n🌐 === Тест с неправильным хостом ===');
    
    try {
      const token = this.generateTestToken(1, 'test-promotion-123');
      const invalidHost = 'invalid-domain.com';
      
      console.log(`❌ Неправильный host: ${invalidHost}`);
      
      const response = await axios.post(this.scanQrEndpoint, this.validQrData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'host': invalidHost
        },
        timeout: 30000,
      });

      console.log('❌ ОШИБКА: Запрос должен был завершиться с ошибкой валидации домена');
      return { success: false, error: 'Валидация домена не работает' };
      
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ УСПЕХ: Валидация домена корректно работает');
        console.log(`📊 Статус: ${error.response.status}`);
        console.log(`💬 Ошибка: ${error.response.data?.message}`);
        
        return { 
          success: true, 
          domainError: error.response.data?.message,
          status: error.response.status 
        };
      } else {
        console.log('❌ ОШИБКА: Неожиданный тип ошибки');
        return { success: false, error: error.message };
      }
    }
  }

  async testScanQrMissingHost() {
    console.log('\n🚫 === Тест без Host заголовка ===');
    
    try {
      const token = this.generateTestToken(1, 'test-promotion-123');
      
      const response = await axios.post(this.scanQrEndpoint, this.validQrData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
          // Намеренно не передаем host
        },
        timeout: 30000,
      });

      console.log('❌ ОШИБКА: Запрос должен был завершиться с ошибкой отсутствия host');
      return { success: false, error: 'Проверка host заголовка не работает' };
      
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ УСПЕХ: Проверка host заголовка корректно работает');
        console.log(`📊 Статус: ${error.response.status}`);
        console.log(`💬 Ошибка: ${error.response.data?.message}`);
        
        return { 
          success: true, 
          hostError: error.response.data?.message,
          status: error.response.status 
        };
      } else {
        console.log('❌ ОШИБКА: Неожиданный тип ошибки');
        return { success: false, error: error.message };
      }
    }
  }

  async testScanQrLargeSum() {
    console.log('\n💰 === Тест с большой суммой чека ===');
    
    const largeQrData = {
      ...this.validQrData,
      sum: 50000000 // 500,000 рублей в копейках
    };
    
    console.log(`Большая сумма: ${largeQrData.sum} копеек (${largeQrData.sum / 100} рублей)`);
    
    try {
      const token = this.generateTestToken(1, 'test-promotion-123');
      const host = this.testDomains[0];
      
      const response = await axios.post(this.scanQrEndpoint, largeQrData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'host': host
        },
        timeout: 30000,
      });

      console.log(`📊 Статус ответа: ${response.status}`);
      console.log(`📋 Тело ответа:`, JSON.stringify(response.data, null, 2));

      const result = response.data;
      
      console.log('✅ УСПЕХ: Большая сумма обработана');
      console.log(`📝 Статус: ${result.status}`);
      console.log(`💬 Сообщение: ${result.message}`);
      
      return {
        success: true,
        status: result.status,
        requestId: result.requestId,
        message: result.message
      };
      
    } catch (error) {
      if (error.response) {
        console.log(`❌ HTTP Error ${error.response.status}: ${error.response.data?.message || error.response.statusText}`);
        
        // Это может быть ожидаемой ошибкой из-за лимитов
        if (error.response.status === 400 && error.response.data?.message?.includes('лимит')) {
          console.log('ℹ️ Ошибка лимита для большой суммы - ожидаемое поведение');
        }
        
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

  async runAllTests() {
    console.log('🚀 === Запуск всех тестов для FNS Scan QR ===\n');
    
    const results = {
      scanSuccess: await this.testScanQrSuccess(),
      invalidData: await this.testScanQrInvalidData(),
      noAuth: await this.testScanQrNoAuth(),
      invalidHost: await this.testScanQrInvalidHost(),
      missingHost: await this.testScanQrMissingHost(),
      largeSum: await this.testScanQrLargeSum()
    };

    console.log('\n📊 === Сводка результатов FNS Scan QR тестов ===');
    
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

module.exports = FnsScanQrTest;

// Запуск тестов если файл вызван напрямую
if (require.main === module) {
  const test = new FnsScanQrTest();
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