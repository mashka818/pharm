const axios = require('axios');
const FnsAuthTest = require('./fns-auth.test');

class FnsOperationsTest {
  constructor() {
    this.authTest = new FnsAuthTest();
    this.baseUrl = process.env.FTX_API_URL || 'https://openapi.nalog.ru:8090';
    this.serviceUrl = `${this.baseUrl}/open-api/ais3/KktService/0.1`;
    this.cachedToken = null;
    
    // Базовые данные для тестирования разных операций
    this.baseReceiptData = {
      fn: '9287440300090728',
      fd: '77140', 
      fp: '1482926140',
      sum: 120000, // 1200 рублей
      date: '2019-04-10T14:30:00'
    };
  }

  async getValidToken() {
    if (this.cachedToken) {
      return this.cachedToken;
    }
    
    console.log('🔑 Получение токена аутентификации...');
    const authResult = await this.authTest.testAuthentication();
    
    if (!authResult.success) {
      throw new Error(`Не удалось получить токен: ${authResult.error}`);
    }
    
    this.cachedToken = authResult.token;
    return this.cachedToken;
  }

  async testOperationType(operationType, operationName, receiptData = null) {
    console.log(`🔄 === Тест операции: ${operationName} (тип ${operationType}) ===`);
    
    const testData = receiptData || {
      ...this.baseReceiptData,
      typeOperation: operationType
    };
    
    console.log(`Данные операции:`, testData);
    
    try {
      const token = await this.getValidToken();
      
      const soapRequest = `
        <soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/">
          <soap-env:Body>
            <ns0:SendMessageRequest xmlns:ns0="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageConsumerService/types/1.0">
              <ns0:Message>
                <tns:GetTicketRequest xmlns:tns="urn://x-artefacts-gnivc-ru/ais3/kkt/KktTicketService/types/1.0">
                  <tns:GetTicketInfo>
                    <tns:Sum>${testData.sum}</tns:Sum>
                    <tns:Date>${testData.date}</tns:Date>
                    <tns:Fn>${testData.fn}</tns:Fn>
                    <tns:TypeOperation>${testData.typeOperation}</tns:TypeOperation>
                    <tns:FiscalDocumentId>${testData.fd}</tns:FiscalDocumentId>
                    <tns:FiscalSign>${testData.fp}</tns:FiscalSign>
                  </tns:GetTicketInfo>
                  <tns:AuthToken>${token}</tns:AuthToken>
                </tns:GetTicketRequest>
              </ns0:Message>
            </ns0:SendMessageRequest>
          </soap-env:Body>
        </soap-env:Envelope>
      `;

      console.log('📤 Отправка запроса операции...');
      
      const response = await axios.post(this.serviceUrl, soapRequest, {
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'SOAPAction': 'urn:SendMessageRequest',
        },
        timeout: 30000,
      });

      console.log(`✅ Статус ответа: ${response.status}`);
      
      // Парсим ответ
      const messageId = this.parseMessageId(response.data);
      const processingState = this.parseProcessingState(response.data);
      
      if (messageId) {
        console.log(`🎯 ID сообщения: ${messageId}`);
        console.log(`📊 Статус обработки: ${processingState}`);
        
        return {
          success: true,
          operationType,
          operationName,
          messageId,
          processingState,
          testData
        };
      } else {
        console.log('❌ Не удалось получить ID сообщения');
        return {
          success: false,
          operationType,
          operationName,
          error: 'Не удалось получить ID сообщения',
          testData
        };
      }
      
    } catch (error) {
      console.log(`❌ Ошибка операции: ${error.message}`);
      
      if (error.response) {
        console.log(`📊 Статус HTTP: ${error.response.status}`);
        console.log(`💬 Ответ сервера:`, error.response.data?.substring(0, 200) + '...');
      }
      
      return {
        success: false,
        operationType,
        operationName,
        error: error.message,
        testData
      };
    }
  }

  parseMessageId(xmlResponse) {
    const messageIdMatch = xmlResponse.match(/<.*?MessageId.*?>(.*?)<\/.*?MessageId.*?>/);
    return messageIdMatch ? messageIdMatch[1] : null;
  }

  parseProcessingState(xmlResponse) {
    const stateMatch = xmlResponse.match(/<.*?ProcessingStatus.*?>(.*?)<\/.*?ProcessingStatus.*?>/);
    return stateMatch ? stateMatch[1] : 'UNKNOWN';
  }

  async testSaleOperation() {
    console.log('💰 === Тест операции продажи ===');
    
    const saleData = {
      ...this.baseReceiptData,
      fd: '77141',
      fp: '1482926141',
      sum: 350000, // 3500 рублей
      typeOperation: 1
    };
    
    return await this.testOperationType(1, 'Продажа', saleData);
  }

  async testReturnOperation() {
    console.log('🔄 === Тест операции возврата ===');
    
    const returnData = {
      ...this.baseReceiptData,
      fd: '77142',
      fp: '1482926142',
      sum: 180000, // 1800 рублей
      typeOperation: 2
    };
    
    return await this.testOperationType(2, 'Возврат прихода', returnData);
  }

  async testExpenseOperation() {
    console.log('📤 === Тест операции расхода ===');
    
    const expenseData = {
      ...this.baseReceiptData,
      fd: '77143',
      fp: '1482926143',
      sum: 250000, // 2500 рублей
      typeOperation: 3
    };
    
    return await this.testOperationType(3, 'Расход', expenseData);
  }

  async testExpenseReturnOperation() {
    console.log('📥 === Тест операции возврата расхода ===');
    
    const expenseReturnData = {
      ...this.baseReceiptData,
      fd: '77144',
      fp: '1482926144',
      sum: 95000, // 950 рублей
      typeOperation: 4
    };
    
    return await this.testOperationType(4, 'Возврат расхода', expenseReturnData);
  }

  async testInvalidOperation() {
    console.log('❌ === Тест невалидной операции ===');
    
    const invalidData = {
      ...this.baseReceiptData,
      fd: '77145',
      fp: '1482926145',
      sum: 100000,
      typeOperation: 99 // Невалидный тип операции
    };
    
    return await this.testOperationType(99, 'Невалидная операция', invalidData);
  }

  async testSequentialOperations() {
    console.log('\n🔄 === Тест последовательности операций ===');
    console.log('Тестируем продажу, затем возврат той же суммы');
    
    // Сначала продажа
    const saleResult = await this.testOperationType(1, 'Продажа в последовательности', {
      ...this.baseReceiptData,
      fd: '77146',
      fp: '1482926146',
      sum: 200000,
      typeOperation: 1
    });
    
    // Пауза между операциями
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Затем возврат
    const returnResult = await this.testOperationType(2, 'Возврат в последовательности', {
      ...this.baseReceiptData,
      fd: '77147',
      fp: '1482926147',
      sum: 200000, // Та же сумма
      typeOperation: 2
    });
    
    console.log('📊 Результат последовательности:');
    console.log(`  Продажа: ${saleResult.success ? '✅' : '❌'}`);
    console.log(`  Возврат: ${returnResult.success ? '✅' : '❌'}`);
    
    return {
      sale: saleResult,
      return: returnResult,
      sequenceSuccess: saleResult.success && returnResult.success
    };
  }

  async testDifferentAmounts() {
    console.log('\n💸 === Тест различных сумм операций ===');
    
    const amounts = [
      { sum: 100, name: '1 рубль' },           // 100 копеек
      { sum: 150000, name: '1500 рублей' },   // Средняя сумма
      { sum: 1000000, name: '10000 рублей' }, // Большая сумма
      { sum: 999999999, name: 'Максимальная сумма' } // Очень большая
    ];
    
    const results = [];
    
    for (let i = 0; i < amounts.length; i++) {
      const amount = amounts[i];
      console.log(`💰 Тестирование суммы: ${amount.name}`);
      
      const result = await this.testOperationType(1, `Продажа на ${amount.name}`, {
        ...this.baseReceiptData,
        fd: `7714${i}`,
        fp: `148292614${i}`,
        sum: amount.sum,
        typeOperation: 1
      });
      
      results.push({
        ...result,
        amountName: amount.name,
        amount: amount.sum
      });
      
      // Пауза между запросами
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
  }

  async runAllTests() {
    console.log('🚀 === Запуск всех тестов операций FNS ===\n');
    
    try {
      const results = [];
      
      // Тест основных операций
      console.log('📋 === Основные типы операций ===');
      results.push(await this.testSaleOperation());
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      results.push(await this.testReturnOperation());
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      results.push(await this.testExpenseOperation());
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      results.push(await this.testExpenseReturnOperation());
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Тест невалидной операции
      console.log('\n❌ === Тест ошибок ===');
      results.push(await this.testInvalidOperation());
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Тест последовательности операций
      const sequenceResult = await this.testSequentialOperations();
      results.push(sequenceResult.sale);
      results.push(sequenceResult.return);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Тест различных сумм
      const amountResults = await this.testDifferentAmounts();
      results.push(...amountResults);
      
      // Сводка результатов
      console.log('\n📊 === Сводка результатов операций ===');
      
      let successCount = 0;
      let totalCount = results.length;
      
      const operationStats = {};
      
      results.forEach(result => {
        const status = result.success ? '✅' : '❌';
        const name = result.operationName || result.amountName || 'Операция';
        console.log(`${status} ${name}`);
        
        if (result.success) {
          successCount++;
        }
        
        // Собираем статистику по типам операций
        const opType = result.operationType;
        if (opType !== undefined) {
          if (!operationStats[opType]) {
            operationStats[opType] = { success: 0, total: 0 };
          }
          operationStats[opType].total++;
          if (result.success) {
            operationStats[opType].success++;
          }
        }
      });
      
      console.log(`\n📈 Общий результат: ${successCount}/${totalCount} операций прошли успешно`);
      
      // Статистика по типам операций
      console.log('\n📊 Статистика по типам операций:');
      Object.entries(operationStats).forEach(([type, stats]) => {
        const typeNames = {
          '1': 'Продажа',
          '2': 'Возврат прихода', 
          '3': 'Расход',
          '4': 'Возврат расхода',
          '99': 'Невалидная операция'
        };
        const typeName = typeNames[type] || `Тип ${type}`;
        console.log(`  ${typeName}: ${stats.success}/${stats.total}`);
      });
      
      return {
        success: successCount === totalCount,
        passed: successCount,
        total: totalCount,
        operationStats,
        results
      };
      
    } catch (error) {
      console.log(`💥 Критическая ошибка: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = FnsOperationsTest;

// Запуск тестов если файл вызван напрямую
if (require.main === module) {
  const test = new FnsOperationsTest();
  test.runAllTests()
    .then(summary => {
      console.log('\n🏁 Тестирование операций завершено');
      process.exit(summary.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Критическая ошибка:', error);
      process.exit(1);
    });
}