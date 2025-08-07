const axios = require('axios');
const FnsAuthTest = require('./fns-auth.test');

class FnsReceiptValidationTest {
  constructor() {
    this.authTest = new FnsAuthTest();
    this.baseUrl = process.env.FTX_API_URL || 'https://openapi.nalog.ru:8090';
    this.serviceUrl = `${this.baseUrl}/open-api/ais3/KktService/0.1`;
    this.cachedToken = null;
    
    // Тестовые данные чеков для валидации
    this.testReceipts = [
      {
        name: 'Обычный чек аптеки',
        data: {
          fn: '9287440300090728',
          fd: '77133', 
          fp: '1482926127',
          sum: 240000, // 2400 рублей
          date: '2019-04-09T16:38:00',
          typeOperation: 1
        }
      },
      {
        name: 'Чек с малой суммой',
        data: {
          fn: '9287440300090729',
          fd: '77134', 
          fp: '1482926128',
          sum: 5000, // 50 рублей
          date: '2019-04-09T17:00:00',
          typeOperation: 1
        }
      },
      {
        name: 'Чек возврата',
        data: {
          fn: '9287440300090730',
          fd: '77135', 
          fp: '1482926129',
          sum: 150000, // 1500 рублей
          date: '2019-04-09T18:30:00',
          typeOperation: 2 // возврат
        }
      },
      {
        name: 'Крупный чек',
        data: {
          fn: '9287440300090731',
          fd: '77136', 
          fp: '1482926130',
          sum: 5000000, // 50000 рублей
          date: '2019-04-10T10:15:00',
          typeOperation: 1
        }
      }
    ];
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

  async validateSingleReceipt(receiptData, receiptName = 'Тестовый чек') {
    console.log(`📝 === Валидация: ${receiptName} ===`);
    console.log(`Данные чека:`, receiptData);
    
    try {
      const token = await this.getValidToken();
      
      const soapRequest = `
        <soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/">
          <soap-env:Body>
            <ns0:SendMessageRequest xmlns:ns0="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageConsumerService/types/1.0">
              <ns0:Message>
                <tns:GetTicketRequest xmlns:tns="urn://x-artefacts-gnivc-ru/ais3/kkt/KktTicketService/types/1.0">
                  <tns:GetTicketInfo>
                    <tns:Sum>${receiptData.sum}</tns:Sum>
                    <tns:Date>${receiptData.date}</tns:Date>
                    <tns:Fn>${receiptData.fn}</tns:Fn>
                    <tns:TypeOperation>${receiptData.typeOperation}</tns:TypeOperation>
                    <tns:FiscalDocumentId>${receiptData.fd}</tns:FiscalDocumentId>
                    <tns:FiscalSign>${receiptData.fp}</tns:FiscalSign>
                  </tns:GetTicketInfo>
                  <tns:AuthToken>${token}</tns:AuthToken>
                </tns:GetTicketRequest>
              </ns0:Message>
            </ns0:SendMessageRequest>
          </soap-env:Body>
        </soap-env:Envelope>
      `;

      console.log('📤 Отправка запроса валидации...');
      
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
          messageId,
          processingState,
          receiptData,
          receiptName
        };
      } else {
        console.log('❌ Не удалось получить ID сообщения');
        return {
          success: false,
          error: 'Не удалось получить ID сообщения',
          receiptData,
          receiptName
        };
      }
      
    } catch (error) {
      console.log(`❌ Ошибка валидации: ${error.message}`);
      
      if (error.response) {
        console.log(`📊 Статус HTTP: ${error.response.status}`);
        console.log(`💬 Ответ сервера:`, error.response.data?.substring(0, 200) + '...');
      }
      
      return {
        success: false,
        error: error.message,
        receiptData,
        receiptName
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

  async testReceiptValidation() {
    console.log('🧾 === Тест валидации различных типов чеков ===');
    
    const results = [];
    
    for (const receipt of this.testReceipts) {
      const result = await this.validateSingleReceipt(receipt.data, receipt.name);
      results.push(result);
      
      // Небольшая пауза между запросами
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
  }

  async testEdgeCases() {
    console.log('\n🔍 === Тест граничных случаев ===');
    
    const edgeCases = [
      {
        name: 'Чек с минимальной суммой',
        data: {
          fn: '9287440300090732',
          fd: '1', 
          fp: '1',
          sum: 1, // 1 копейка
          date: '2019-04-09T09:00:00',
          typeOperation: 1
        }
      },
      {
        name: 'Очень старый чек',
        data: {
          fn: '9287440300090733',
          fd: '99999', 
          fp: '999999999',
          sum: 100000,
          date: '2018-01-01T12:00:00', // Старая дата
          typeOperation: 1
        }
      },
      {
        name: 'Чек с максимальными значениями',
        data: {
          fn: '9999999999999999',
          fd: '999999', 
          fp: '4294967295',
          sum: 99999999, // Большая сумма
          date: '2019-12-31T23:59:59',
          typeOperation: 1
        }
      }
    ];
    
    const results = [];
    
    for (const testCase of edgeCases) {
      const result = await this.validateSingleReceipt(testCase.data, testCase.name);
      results.push(result);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
  }

  async testErrorHandling() {
    console.log('\n❌ === Тест обработки ошибок ===');
    
    const errorCases = [
      {
        name: 'Невалидный FN',
        data: {
          fn: 'invalid-fn',
          fd: '77133', 
          fp: '1482926127',
          sum: 240000,
          date: '2019-04-09T16:38:00',
          typeOperation: 1
        }
      },
      {
        name: 'Отрицательная сумма',
        data: {
          fn: '9287440300090728',
          fd: '77133', 
          fp: '1482926127',
          sum: -100,
          date: '2019-04-09T16:38:00',
          typeOperation: 1
        }
      },
      {
        name: 'Невалидная дата',
        data: {
          fn: '9287440300090728',
          fd: '77133', 
          fp: '1482926127',
          sum: 240000,
          date: 'invalid-date',
          typeOperation: 1
        }
      }
    ];
    
    const results = [];
    
    for (const errorCase of errorCases) {
      console.log(`🚫 Тестирование: ${errorCase.name}`);
      
      try {
        const result = await this.validateSingleReceipt(errorCase.data, errorCase.name);
        
        if (!result.success) {
          console.log('✅ Ошибка корректно обработана');
          results.push({ ...result, expectedError: true });
        } else {
          console.log('⚠️ Ожидалась ошибка, но запрос прошел успешно');
          results.push({ ...result, unexpected: true });
        }
        
      } catch (error) {
        console.log('✅ Исключение корректно выброшено');
        results.push({
          success: false,
          error: error.message,
          expectedError: true,
          receiptName: errorCase.name
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
  }

  async runAllTests() {
    console.log('🚀 === Запуск всех тестов валидации чеков FNS ===\n');
    
    try {
      // Тест валидации различных чеков
      const validationResults = await this.testReceiptValidation();
      
      // Тест граничных случаев
      const edgeResults = await this.testEdgeCases();
      
      // Тест обработки ошибок
      const errorResults = await this.testErrorHandling();
      
      // Сводка результатов
      console.log('\n📊 === Сводка результатов ===');
      
      const allResults = [...validationResults, ...edgeResults, ...errorResults];
      
      let successCount = 0;
      let totalCount = allResults.length;
      
      allResults.forEach(result => {
        const status = result.success ? '✅' : '❌';
        const indicator = result.expectedError ? '(ожидаемая ошибка)' : '';
        console.log(`${status} ${result.receiptName} ${indicator}`);
        
        if (result.success || result.expectedError) {
          successCount++;
        }
      });
      
      console.log(`\n📈 Общий результат: ${successCount}/${totalCount} тестов прошли успешно`);
      
      return {
        success: successCount === totalCount,
        passed: successCount,
        total: totalCount,
        results: allResults
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

module.exports = FnsReceiptValidationTest;

// Запуск тестов если файл вызван напрямую
if (require.main === module) {
  const test = new FnsReceiptValidationTest();
  test.runAllTests()
    .then(summary => {
      console.log('\n🏁 Тестирование завершено');
      process.exit(summary.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Критическая ошибка:', error);
      process.exit(1);
    });
}