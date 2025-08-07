const axios = require('axios');
const FnsAuthTest = require('./fns-auth.test');
const FnsCheckTest = require('./fns-check.test');

class FnsIntegrationTest {
  constructor() {
    this.authTest = new FnsAuthTest();
    this.checkTest = new FnsCheckTest();
    this.baseUrl = process.env.FTX_API_URL || 'https://openapi.nalog.ru:8090';
    this.serviceUrl = `${this.baseUrl}/open-api/ais3/KktService/0.1`;
    this.cachedToken = null;
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

  async testGetMessagesMultiple() {
    console.log('📥 === Тест GetMessages с множественными сообщениями ===');
    
    try {
      const token = await this.getValidToken();
      
      const testReceipts = [
        {
          fn: '9287440300090728',
          fd: '77133',
          fp: '1482926127',
          sum: 240000,
          date: '2019-04-09T16:38:00',
          typeOperation: 1
        },
        {
          fn: '9287440300090728',
          fd: '77134',
          fp: '1482926128',
          sum: 150000,
          date: '2019-04-09T17:00:00',
          typeOperation: 1
        }
      ];
      
      const messageIds = [];
      
      for (let i = 0; i < testReceipts.length; i++) {
        console.log(`📤 Отправка сообщения ${i + 1}/${testReceipts.length}...`);
        const sendResult = await this.checkTest.testSendMessage(testReceipts[i]);
        
        if (sendResult.success) {
          messageIds.push(sendResult.messageId);
          console.log(`✅ MessageId ${i + 1}: ${sendResult.messageId}`);
        } else {
          console.log(`❌ Ошибка отправки сообщения ${i + 1}: ${sendResult.error}`);
        }
        
        await this.sleep(1000);
      }
      
      if (messageIds.length === 0) {
        return { success: false, error: 'No messages sent successfully' };
      }
      
      console.log(`\n📥 Получение ${messageIds.length} сообщений через GetMessages...`);
      
      const getMessagesResult = await this.makeGetMessagesRequest(messageIds, token);
      
      if (getMessagesResult.success) {
        console.log('✅ УСПЕХ: GetMessages выполнен успешно');
        console.log(`📊 Получено сообщений: ${getMessagesResult.messages.length}`);
        return { success: true, messageIds, messages: getMessagesResult.messages };
      } else {
        console.log(`❌ ОШИБКА GetMessages: ${getMessagesResult.error}`);
        return { success: false, error: getMessagesResult.error };
      }
      
    } catch (error) {
      console.log('❌ ОШИБКА интеграционного теста:', error.message);
      return { success: false, error: error.message };
    }
  }

  async makeGetMessagesRequest(messageIds, token) {
    const expressionsXml = messageIds.map(messageId => `
      <ns:Expressions>
        <ns:MessageId>${messageId}</ns:MessageId>
        <ns:UserToken>TestUserToken</ns:UserToken>
      </ns:Expressions>
    `).join('');
    
    const soapRequest = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageConsumerService/types/1.0">
        <soapenv:Header/>
        <soapenv:Body>
          <ns:GetMessagesRequest>
            ${expressionsXml}
          </ns:GetMessagesRequest>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    try {
      const response = await axios.post(this.serviceUrl, soapRequest, {
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'SOAPAction': 'urn:GetMessagesRequest',
          'FNS-OpenApi-Token': token,
        },
        timeout: 30000,
      });

      console.log(`✅ Статус ответа GetMessages: ${response.status}`);
      
      const messages = this.parseGetMessagesResponse(response.data);
      return { success: true, messages };
      
    } catch (error) {
      if (error.response) {
        console.log(`📊 HTTP статус: ${error.response.status}`);
        console.log(`📄 Тело ошибки:`, error.response.data);
        
        if (error.response.data && typeof error.response.data === 'string') {
          if (error.response.data.includes('В запросе было передано недопустимое количество messageId')) {
            return { success: false, error: 'Too many messageIds in request' };
          } else if (error.response.data.includes('В запросе переданы повторяющиеся значения messageId')) {
            return { success: false, error: 'Duplicate messageIds in request' };
          } else if (error.response.data.includes('Превышено количество запросов метода GetMessages')) {
            return { success: false, error: 'GetMessages rate limit exceeded' };
          }
        }
      }
      
      return { success: false, error: error.message };
    }
  }

  parseGetMessagesResponse(xmlResponse) {
    const messages = [];
    
    const messageBlocks = xmlResponse.match(/<Messages>.*?<\/Messages>/gs);
    
    if (messageBlocks) {
      messageBlocks.forEach(block => {
        const messageIdMatch = block.match(/<MessageId>([^<]+)<\/MessageId>/);
        const statusMatch = block.match(/<ProcessingStatus>([^<]+)<\/ProcessingStatus>/);
        const messageContentMatch = block.match(/<Message>(.*?)<\/Message>/s);
        const fileLinkMatches = block.match(/<FileLinks>([^<]+)<\/FileLinks>/g);
        
        const message = {
          messageId: messageIdMatch ? messageIdMatch[1] : null,
          processingStatus: statusMatch ? statusMatch[1] : 'UNKNOWN',
          message: messageContentMatch ? messageContentMatch[1] : null,
          fileLinks: fileLinkMatches ? fileLinkMatches.map(match => match.replace(/<\/?FileLinks>/g, '')) : []
        };
        
        messages.push(message);
      });
    }
    
    return messages;
  }

  async testDuplicateMessageIds() {
    console.log('\n🔄 === Тест дублированных MessageId ===');
    
    try {
      const token = await this.getValidToken();
      
      const duplicateMessageId = '12345678-1234-1234-1234-123456789012';
      const messageIds = [duplicateMessageId, duplicateMessageId];
      
      const result = await this.makeGetMessagesRequest(messageIds, token);
      
      if (!result.success && result.error.includes('Duplicate messageIds')) {
        console.log('✅ УСПЕХ: Дублированные MessageId корректно отклонены');
        return { success: true, errorType: 'DUPLICATE_HANDLED' };
      } else if (result.success) {
        console.log('⚠️ Дублированные MessageId приняты (возможно, система их обрабатывает)');
        return { success: true, errorType: 'DUPLICATE_ACCEPTED' };
      } else {
        console.log(`❌ ОШИБКА: Неожиданная ошибка: ${result.error}`);
        return { success: false, error: result.error };
      }
      
    } catch (error) {
      console.log('❌ ОШИБКА при тестировании дублированных MessageId:', error.message);
      return { success: false, error: error.message };
    }
  }

  async testExcessiveMessageIds() {
    console.log('\n📊 === Тест превышения лимита MessageId ===');
    
    try {
      const token = await this.getValidToken();
      
      const manyMessageIds = [];
      for (let i = 0; i < 50; i++) {
        manyMessageIds.push(`12345678-1234-1234-1234-12345678901${i.toString().padStart(1, '0')}`);
      }
      
      const result = await this.makeGetMessagesRequest(manyMessageIds, token);
      
      if (!result.success && result.error.includes('Too many messageIds')) {
        console.log('✅ УСПЕХ: Превышение лимита MessageId корректно обработано');
        return { success: true, errorType: 'LIMIT_ENFORCED' };
      } else if (result.success) {
        console.log('ℹ️ Все MessageId приняты (лимит не достигнут или больше ожидаемого)');
        return { success: true, errorType: 'WITHIN_LIMIT' };
      } else {
        console.log(`❌ ОШИБКА: Неожиданная ошибка: ${result.error}`);
        return { success: false, error: result.error };
      }
      
    } catch (error) {
      console.log('❌ ОШИБКА при тестировании лимита MessageId:', error.message);
      return { success: false, error: error.message };
    }
  }

  async testFileLinksProcessing() {
    console.log('\n📁 === Тест обработки FileLinks ===');
    console.log('💡 Этот тест симулирует отправку сообщения с файловыми ссылками');
    
    try {
      const token = await this.getValidToken();
      
      const soapRequestWithFiles = `
        <soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/">
          <soap-env:Body>
            <ns0:SendMessageRequest xmlns:ns0="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageConsumerService/types/1.0">
              <ns0:Message>
                <ns1:GetNewlyUnboundTaxpayersRequest xmlns:ns1="urn://x-artefacts-gnivc-ru/ais3/SMZ/SmzPartnersIntegrationService/types/1.0">
                  <ns1:From>2019-02-27T20:49:13</ns1:From>
                  <ns1:Limit>100</ns1:Limit>
                  <ns1:Offset>0</ns1:Offset>
                </ns1:GetNewlyUnboundTaxpayersRequest>
              </ns0:Message>
              <ns0:FileLinks>test/test1.txt</ns0:FileLinks>
              <ns0:FileLinks>test/test2.txt</ns0:FileLinks>
            </ns0:SendMessageRequest>
          </soap-env:Body>
        </soap-env:Envelope>
      `;

      const response = await axios.post(this.serviceUrl, soapRequestWithFiles, {
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'SOAPAction': 'urn:SendMessageRequest',
          'FNS-OpenApi-Token': token,
        },
        timeout: 30000,
      });

      console.log(`✅ Статус ответа: ${response.status}`);
      const messageId = this.parseSendMessageResponse(response.data);
      console.log(`🎯 MessageId с FileLinks: ${messageId}`);
      
      console.log('✅ УСПЕХ: Сообщение с FileLinks отправлено');
      return { success: true, messageId, hasFileLinks: true };
      
    } catch (error) {
      if (error.response && error.response.data) {
        const errorData = error.response.data;
        if (errorData.includes('По переданной ссылке файл не найден')) {
          console.log('✅ УСПЕХ: FileNotFound корректно обработан (ожидаемо для тестовых ссылок)');
          return { success: true, errorType: 'FILE_NOT_FOUND' };
        } else if (errorData.includes('Установлено недопустимое количество ссылок на файлы')) {
          console.log('✅ УСПЕХ: Лимит FileLinks корректно обработан');
          return { success: true, errorType: 'FILE_LINKS_LIMIT' };
        }
      }
      
      console.log('❌ ОШИБКА при тестировании FileLinks:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  async testInvalidFileLinks() {
    console.log('\n🚫 === Тест некорректных FileLinks ===');
    
    try {
      const token = await this.getValidToken();
      
      const soapRequestWithInvalidFiles = `
        <soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/">
          <soap-env:Body>
            <ns0:SendMessageRequest xmlns:ns0="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageConsumerService/types/1.0">
              <ns0:Message>
                <ns1:GetNewlyUnboundTaxpayersRequest xmlns:ns1="urn://x-artefacts-gnivc-ru/ais3/SMZ/SmzPartnersIntegrationService/types/1.0">
                  <ns1:From>2019-02-27T20:49:13</ns1:From>
                  <ns1:Limit>100</ns1:Limit>
                  <ns1:Offset>0</ns1:Offset>
                </ns1:GetNewlyUnboundTaxpayersRequest>
              </ns0:Message>
              <ns0:FileLinks>test/te?st2.txt</ns0:FileLinks>
            </ns0:SendMessageRequest>
          </soap-env:Body>
        </soap-env:Envelope>
      `;

      await axios.post(this.serviceUrl, soapRequestWithInvalidFiles, {
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'SOAPAction': 'urn:SendMessageRequest',
          'FNS-OpenApi-Token': token,
        },
        timeout: 30000,
      });
      
      console.log('❌ ОШИБКА: Невалидные FileLinks приняты');
      return { success: false, error: 'Invalid FileLinks accepted' };
      
    } catch (error) {
      if (error.response && error.response.data) {
        const errorData = error.response.data;
        if (errorData.includes('По переданной ссылке файл не найден')) {
          console.log('✅ УСПЕХ: Невалидные FileLinks корректно отклонены');
          return { success: true, errorType: 'INVALID_FILE_LINKS' };
        }
      }
      
      console.log('❌ ОШИБКА при тестировании невалидных FileLinks:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  parseSendMessageResponse(xmlResponse) {
    const messageIdMatch = xmlResponse.match(/<MessageId>([^<]+)<\/MessageId>/);
    if (messageIdMatch) {
      return messageIdMatch[1];
    }
    throw new Error('Не удалось извлечь MessageId из ответа');
  }

  async testCompleteCycle() {
    console.log('\n🔄 === Тест полного интеграционного цикла ===');
    
    const results = {
      auth: null,
      sendMessage: null,
      getMessage: null,
      getMessages: null
    };
    
    try {
      console.log('1️⃣ Аутентификация...');
      results.auth = await this.authTest.testAuthentication();
      if (!results.auth.success) {
        return { success: false, stage: 'auth', results };
      }
      
      console.log('2️⃣ Отправка сообщения...');
      results.sendMessage = await this.checkTest.testSendMessage();
      if (!results.sendMessage.success) {
        return { success: false, stage: 'sendMessage', results };
      }
      
      console.log('3️⃣ Получение сообщения...');
      await this.sleep(2000); 
      results.getMessage = await this.checkTest.testGetMessage(results.sendMessage.messageId);
      if (!results.getMessage.success) {
        return { success: false, stage: 'getMessage', results };
      }
      
      console.log('4️⃣ Тест GetMessages...');
      results.getMessages = await this.makeGetMessagesRequest(
        [results.sendMessage.messageId], 
        results.auth.token
      );
      if (!results.getMessages.success) {
        return { success: false, stage: 'getMessages', results };
      }
      
      console.log('🎉 Полный интеграционный цикл завершен успешно!');
      return { success: true, results };
      
    } catch (error) {
      console.log('❌ ОШИБКА в интеграционном цикле:', error.message);
      return { success: false, error: error.message, results };
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async runAllTests() {
    console.log('🚀 === ЗАПУСК ИНТЕГРАЦИОННЫХ ТЕСТОВ ФНС ===\n');
    
    const results = {
      completeCycle: await this.testCompleteCycle(),
      getMessagesMultiple: await this.testGetMessagesMultiple(),
      duplicateMessageIds: await this.testDuplicateMessageIds(),
      excessiveMessageIds: await this.testExcessiveMessageIds(),
      fileLinksProcessing: await this.testFileLinksProcessing(),
      invalidFileLinks: await this.testInvalidFileLinks()
    };
    
    console.log('\n📊 === РЕЗУЛЬТАТЫ ИНТЕГРАЦИОННОГО ТЕСТИРОВАНИЯ ===');
    Object.entries(results).forEach(([testName, result]) => {
      const status = result.success ? '✅ ПРОЙДЕН' : '❌ ПРОВАЛЕН';
      const errorType = result.errorType ? ` [${result.errorType}]` : '';
      const stage = result.stage ? ` (остановлен на: ${result.stage})` : '';
      console.log(`${status} ${testName}${errorType}${stage}`);
    });
    
    const allPassed = Object.values(results).every(result => result.success);
    console.log(`\n🎯 Общий результат: ${allPassed ? '✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ' : '❌ ЕСТЬ ПРОВАЛЕННЫЕ ТЕСТЫ'}`);
    
    return results;
  }
}

if (require.main === module) {
  const test = new FnsIntegrationTest();
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

module.exports = FnsIntegrationTest;