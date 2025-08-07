const axios = require('axios');
const FnsAuthTest = require('./fns-auth.test');

class FnsCheckTest {
  constructor() {
    this.authTest = new FnsAuthTest();
    this.baseUrl = process.env.FTX_API_URL || 'https://openapi.nalog.ru:8090';
    this.serviceUrl = `${this.baseUrl}/open-api/ais3/KktService/0.1`;
    this.cachedToken = null;
    
    this.testReceiptData = {
      fn: '9287440300090728',
      fd: '77133', 
      fp: '1482926127',
      sum: 240000, 
      date: '2019-04-09T16:38:00',
      typeOperation: 1
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

  async testSendMessage(receiptData = this.testReceiptData) {
    console.log('📤 === Тест отправки сообщения (SendMessage) ===');
    console.log(`Данные чека: ${JSON.stringify(receiptData)}`);
    
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
                    <tns:TypeOperation>${receiptData.typeOperation || 1}</tns:TypeOperation>
                    <tns:FiscalDocumentId>${receiptData.fd}</tns:FiscalDocumentId>
                    <tns:FiscalSign>${receiptData.fp}</tns:FiscalSign>
                    <tns:RawData>true</tns:RawData>
                  </tns:GetTicketInfo>
                </tns:GetTicketRequest>
              </ns0:Message>
            </ns0:SendMessageRequest>
          </soap-env:Body>
        </soap-env:Envelope>
      `;

      console.log('📤 Отправка SOAP запроса SendMessage...');
      
      const response = await axios.post(this.serviceUrl, soapRequest, {
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'SOAPAction': 'urn:SendMessageRequest',
          'FNS-OpenApi-Token': token,
        },
        timeout: 30000,
      });

      console.log(`✅ Статус ответа: ${response.status}`);
      console.log(`📋 Заголовки ответа:`, response.headers);
      
      const messageId = this.parseSendMessageResponse(response.data);
      console.log(`🎯 Получен MessageId: ${messageId}`);
      
      if (messageId && messageId.length > 10) {
        console.log('✅ УСПЕХ: Сообщение отправлено успешно');
        return { success: true, messageId };
      } else {
        console.log('❌ ОШИБКА: Получен невалидный MessageId');
        return { success: false, error: 'Invalid MessageId format' };
      }
      
    } catch (error) {
      console.log('❌ ОШИБКА при отправке сообщения:');
      
      if (error.response) {
        console.log(`📊 HTTP статус: ${error.response.status}`);
        console.log(`📄 Тело ошибки:`, error.response.data);
        
        if (error.response.status === 429) {
          console.log('🚫 Превышен лимит запросов (Rate Limiting)');
        } else if (error.response.data && typeof error.response.data === 'string') {
          if (error.response.data.includes('Доступ к сервису для token запрещен')) {
            console.log('🔑 Невалидный или просроченный токен');
          } else if (error.response.data.includes('Превышен общий дневной лимит')) {
            console.log('📊 Превышен дневной лимит запросов');
          }
        }
      }
      
      return { success: false, error: error.message };
    }
  }

  async testGetMessage(messageId) {
    console.log('\n📥 === Тест получения сообщения (GetMessage) ===');
    console.log(`MessageId: ${messageId}`);
    
    try {
      const token = await this.getValidToken();
      
      const soapRequest = `
        <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageConsumerService/types/1.0">
          <soapenv:Header/>
          <soapenv:Body>
            <ns:GetMessageRequest>
              <ns:MessageId>${messageId}</ns:MessageId>
            </ns:GetMessageRequest>
          </soapenv:Body>
        </soapenv:Envelope>
      `;

      console.log('📥 Отправка SOAP запроса GetMessage...');
      
      const response = await axios.post(this.serviceUrl, soapRequest, {
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'SOAPAction': 'urn:GetMessageRequest',
          'FNS-OpenApi-Token': token,
        },
        timeout: 30000,
      });

      console.log(`✅ Статус ответа: ${response.status}`);
      
      const result = this.parseGetMessageResponse(response.data);
      console.log(`📊 Статус обработки: ${result.processingStatus}`);
      
      if (result.processingStatus === 'COMPLETED') {
        console.log('🎉 Обработка завершена');
        if (result.message) {
          console.log('📄 Получены данные чека');
          console.log(result.message);
        }
        console.log('✅ УСПЕХ: Результат получен');
        return { success: true, ...result };
      } else if (result.processingStatus === 'PROCESSING') {
        console.log('⏳ Обработка в процессе');
        console.log('ℹ️ Повторите запрос через несколько секунд');
        return { success: true, ...result, needRetry: true };
      } else {
        console.log('❌ ОШИБКА: Неизвестный статус обработки');
        return { success: false, error: 'Unknown processing status' };
      }
      
    } catch (error) {
      console.log('❌ ОШИБКА при получении сообщения:');
      
      if (error.response) {
        console.log(`📊 HTTP статус: ${error.response.status}`);
        console.log(`📄 Тело ошибки:`, error.response.data);
        
        if (error.response.data && typeof error.response.data === 'string') {
          if (error.response.data.includes('По переданному MessageId') && error.response.data.includes('сообщение не найдено')) {
            console.log('🔍 Сообщение не найдено по MessageId или время ожидания истекло');
          } else if (error.response.data.includes('Превышено количество запросов метода GetMessage')) {
            console.log('🚫 Превышен лимит запросов GetMessage для данного MessageId');
          }
        }
      }
      
      return { success: false, error: error.message };
    }
  }

  async testFullCycle(receiptData = this.testReceiptData) {
    console.log('\n🔄 === Тест полного цикла проверки чека ===');
    
    const sendResult = await this.testSendMessage(receiptData);
    if (!sendResult.success) {
      return { success: false, error: 'Failed to send message', details: sendResult };
    }
    
    const messageId = sendResult.messageId;
    const maxRetries = 5;
    let retryCount = 0;
    
    console.log('\n⏳ Ожидание обработки сообщения...');
    
    while (retryCount < maxRetries) {
      await this.sleep(2000); 
      
      const getResult = await this.testGetMessage(messageId);
      
      if (!getResult.success) {
        return { success: false, error: 'Failed to get message', details: getResult };
      }
      
      if (getResult.processingStatus === 'COMPLETED') {
        console.log('🎉 Полный цикл проверки завершен успешно');
        return { 
          success: true, 
          sendResult, 
          getResult,
          cycles: retryCount + 1
        };
      }
      
      retryCount++;
      console.log(`🔄 Попытка ${retryCount}/${maxRetries}: Статус - ${getResult.processingStatus}`);
    }
    
    console.log('⏰ Превышено максимальное время ожидания');
    return { 
      success: false, 
      error: 'Processing timeout', 
      details: { sendResult, retries: maxRetries }
    };
  }

  async testInvalidMessageId() {
    console.log('\n🧪 === Тест с невалидным MessageId ===');
    
    const invalidMessageId = '00000000-0000-0000-0000-000000000000';
    const result = await this.testGetMessage(invalidMessageId);
    
    if (!result.success && result.error.includes('сообщение не найдено')) {
      console.log('✅ УСПЕХ: Невалидный MessageId корректно отклонен');
      return { success: true };
    } else {
      console.log('❌ ОШИБКА: Неожиданная реакция на невалидный MessageId');
      return { success: false, error: 'Unexpected response for invalid MessageId' };
    }
  }

  parseSendMessageResponse(xmlResponse) {
    const messageIdPatterns = [
      /<MessageId>([^<]+)<\/MessageId>/,
      /<ns:MessageId>([^<]+)<\/ns:MessageId>/,
      /<tns:MessageId>([^<]+)<\/tns:MessageId>/
    ];
    
    for (const pattern of messageIdPatterns) {
      const match = xmlResponse.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    throw new Error('Не удалось извлечь MessageId из ответа');
  }

  parseGetMessageResponse(xmlResponse) {
    const statusPatterns = [
      /<ProcessingStatus>([^<]+)<\/ProcessingStatus>/,
      /<ns:ProcessingStatus>([^<]+)<\/ns:ProcessingStatus>/
    ];
    
    let processingStatus = 'UNKNOWN';
    for (const pattern of statusPatterns) {
      const match = xmlResponse.match(pattern);
      if (match) {
        processingStatus = match[1];
        break;
      }
    }
    
    let message = null;
    if (processingStatus === 'COMPLETED') {
      const messageMatch = xmlResponse.match(/<Message>(.*?)<\/Message>/s);
      if (messageMatch) {
        message = messageMatch[1];
      }
    }
    
    return { processingStatus, message };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async runAllTests() {
    console.log('🚀 === ЗАПУСК ТЕСТОВ ПРОВЕРКИ ЧЕКОВ ФНС ===\n');
    
    const results = {
      sendTest: await this.testSendMessage(),
      invalidMessageTest: await this.testInvalidMessageId(),
      fullCycleTest: await this.testFullCycle()
    };
    
    console.log('\n📊 === РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ ===');
    console.log(`✅ Отправка сообщения: ${results.sendTest.success ? 'ПРОЙДЕН' : 'ПРОВАЛЕН'}`);
    console.log(`✅ Невалидный MessageId: ${results.invalidMessageTest.success ? 'ПРОЙДЕН' : 'ПРОВАЛЕН'}`);
    console.log(`✅ Полный цикл: ${results.fullCycleTest.success ? 'ПРОЙДЕН' : 'ПРОВАЛЕН'}`);
    
    const allPassed = Object.values(results).every(result => result.success);
    console.log(`\n🎯 Общий результат: ${allPassed ? '✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ' : '❌ ЕСТЬ ПРОВАЛЕННЫЕ ТЕСТЫ'}`);
    
    return results;
  }
}

if (require.main === module) {
  const test = new FnsCheckTest();
  test.runAllTests()
    .then(results => {
      const allPassed = Object.values(results).every(result => result.success);
      process.exit(allPassed ? 0 : 1);
    })
    .catch(error => {
      console.error('Критическая ошибка при запуске тестов:', error);
      process.exit(1);
    });
}

module.exports = FnsCheckTest;