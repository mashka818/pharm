const axios = require('axios');
const jwt = require('jsonwebtoken');

class FnsVerifyTest {
  constructor() {
    this.baseUrl = process.env.BACKEND_URL || `http://${process.env.PROD_SERVER_IP || '91.236.198.205'}:${process.env.API_PORT || '4000'}`;
    this.verifyEndpoint = `${this.baseUrl}/api/fns/verify`;
    this.jwtSecret = process.env.JWT_SECRET || 'gpW7DtMraBcCf4rXXyMmLZ25cMsrjv6z';
    
    // Test data based on real FNS receipt format (legacy method uses string format)
    this.validReceiptData = {
      fn: '9287440300090728',
      fd: '77133',
      fp: '1482926127',
      sum: '2400', // строка для legacy метода
      date: '2019-04-09T16:38:00',
      typeOperation: '1'
    };
    
    this.invalidReceiptData = {
      fn: '',
      fd: '',
      fp: '',
      sum: '',
      date: 'invalid-date'
    };

    // Receipt with different parameters for edge case testing
    this.edgeCaseReceipts = [
      {
        fn: '9287440300090728',
        fd: '77134',
        fp: '1482926128',
        sum: '15000', // 150 рублей
        date: '2019-04-09T17:00:00',
        typeOperation: '1'
      },
      {
        fn: '9287440300090729',
        fd: '77135',
        fp: '1482926129',
        sum: '500000', // 5000 рублей
        date: '2019-04-10T10:30:00',
        typeOperation: '2' // возврат
      }
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

  async testVerifyReceiptSuccess() {
    console.log('✅ === Тест успешной проверки чека (Legacy метод) ===');
    console.log(`Endpoint: ${this.verifyEndpoint}`);
    console.log(`Данные чека: ${JSON.stringify(this.validReceiptData)}`);
    
    try {
      const token = this.generateTestToken(1);
      
      console.log(`🔑 Токен: ${token.substring(0, 20)}...`);
      
      const response = await axios.post(this.verifyEndpoint, this.validReceiptData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000,
      });

      console.log(`📊 Статус ответа: ${response.status}`);
      console.log(`📋 Тело ответа:`, JSON.stringify(response.data, null, 2));

      if (response.status === 200 && response.data) {
        console.log('✅ УСПЕХ: Чек отправлен на проверку корректно');
        
        return {
          success: true,
          data: response.data
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
          console.log('ℹ️ Ошибка 400 может быть ожидаемой (проблемы с данными)');
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

  async testVerifyReceiptInvalidData() {
    console.log('\n🚫 === Тест с невалидными данными чека ===');
    console.log(`Невалидные данные: ${JSON.stringify(this.invalidReceiptData)}`);
    
    try {
      const token = this.generateTestToken(1);
      
      const response = await axios.post(this.verifyEndpoint, this.invalidReceiptData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
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

  async testVerifyReceiptNoAuth() {
    console.log('\n🔐 === Тест без авторизации ===');
    
    try {
      const response = await axios.post(this.verifyEndpoint, this.validReceiptData, {
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

  async testVerifyReceiptInvalidToken() {
    console.log('\n🔐 === Тест с невалидным токеном ===');
    
    try {
      const invalidToken = 'invalid.jwt.token';
      
      const response = await axios.post(this.verifyEndpoint, this.validReceiptData, {
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

  async testVerifyReceiptEdgeCases() {
    console.log('\n🔍 === Тест граничных случаев ===');
    
    const results = [];
    
    for (let i = 0; i < this.edgeCaseReceipts.length; i++) {
      const receiptData = this.edgeCaseReceipts[i];
      console.log(`\n📝 Тест случая ${i + 1}: ${JSON.stringify(receiptData)}`);
      
      try {
        const token = this.generateTestToken(i + 2); // разные пользователи
        
        const response = await axios.post(this.verifyEndpoint, receiptData, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000,
        });

        console.log(`📊 Статус ответа: ${response.status}`);
        console.log(`📋 Тело ответа:`, JSON.stringify(response.data, null, 2));

        results.push({
          case: i + 1,
          success: true,
          data: response.data,
          receiptData
        });
        
      } catch (error) {
        if (error.response) {
          console.log(`❌ HTTP Error ${error.response.status}: ${error.response.data?.message || error.response.statusText}`);
          
          results.push({
            case: i + 1,
            success: false,
            error: error.response.data?.message || error.message,
            status: error.response.status,
            receiptData
          });
        } else {
          console.log('❌ Ошибка сети:', error.message);
          results.push({
            case: i + 1,
            success: false,
            error: error.message,
            receiptData
          });
        }
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`\n📈 Граничные случаи: ${successCount}/${results.length} успешно обработаны`);
    
    return {
      success: true,
      results,
      successRate: successCount / results.length
    };
  }

  async testVerifyReceiptLargeAmount() {
    console.log('\n💰 === Тест с большой суммой чека ===');
    
    const largeAmountReceipt = {
      ...this.validReceiptData,
      sum: '1000000' // 10,000 рублей
    };
    
    console.log(`Большая сумма: ${largeAmountReceipt.sum} рублей`);
    
    try {
      const token = this.generateTestToken(1);
      
      const response = await axios.post(this.verifyEndpoint, largeAmountReceipt, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000,
      });

      console.log(`📊 Статус ответа: ${response.status}`);
      console.log(`📋 Тело ответа:`, JSON.stringify(response.data, null, 2));

      console.log('✅ УСПЕХ: Большая сумма обработана');
      
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      if (error.response) {
        console.log(`❌ HTTP Error ${error.response.status}: ${error.response.data?.message || error.response.statusText}`);
        
        // Это может быть ожидаемой ошибкой из-за лимитов
        if (error.response.status === 400) {
          console.log('ℹ️ Ошибка 400 может быть ожидаемой для большой суммы');
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

  async testVerifyReceiptReturnOperation() {
    console.log('\n🔄 === Тест операции возврата ===');
    
    const returnReceipt = {
      ...this.validReceiptData,
      typeOperation: '2', // возврат
      fd: '77136', // другой номер документа
      fp: '1482926130'
    };
    
    console.log(`Данные возврата: ${JSON.stringify(returnReceipt)}`);
    
    try {
      const token = this.generateTestToken(1);
      
      const response = await axios.post(this.verifyEndpoint, returnReceipt, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000,
      });

      console.log(`📊 Статус ответа: ${response.status}`);
      console.log(`📋 Тело ответа:`, JSON.stringify(response.data, null, 2));

      console.log('✅ УСПЕХ: Операция возврата обработана');
      
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      if (error.response) {
        console.log(`❌ HTTP Error ${error.response.status}: ${error.response.data?.message || error.response.statusText}`);
        
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
    console.log('🚀 === Запуск всех тестов для FNS Verify (Legacy) ===\n');
    
    const results = {
      verifySuccess: await this.testVerifyReceiptSuccess(),
      invalidData: await this.testVerifyReceiptInvalidData(),
      noAuth: await this.testVerifyReceiptNoAuth(),
      invalidToken: await this.testVerifyReceiptInvalidToken(),
      edgeCases: await this.testVerifyReceiptEdgeCases(),
      largeAmount: await this.testVerifyReceiptLargeAmount(),
      returnOperation: await this.testVerifyReceiptReturnOperation()
    };

    console.log('\n📊 === Сводка результатов FNS Verify тестов ===');
    
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

module.exports = FnsVerifyTest;

// Запуск тестов если файл вызван напрямую
if (require.main === module) {
  const test = new FnsVerifyTest();
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