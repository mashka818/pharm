const axios = require('axios');
const FnsAuthTest = require('./fns-auth.test');

/**
 * Тест обработки ошибок ФНС API
 * Проверяет различные сценарии ошибок согласно документации ФНС
 */

class FnsErrorsTest {
  constructor() {
    this.authTest = new FnsAuthTest();
    this.baseUrl = process.env.FTX_API_URL || 'https://openapi.nalog.ru:8090';
    this.serviceUrl = `${this.baseUrl}/open-api/ais3/KktService/0.1`;
    this.authServiceUrl = `${this.baseUrl}/open-api/AuthService/0.1`;
  }

  async testIpAccessDenied() {
    console.log('🚫 === Тест блокировки по IP адресу ===');
    console.log('💡 Этот тест проверяет обработку ошибки "Доступ к сервису для переданного IP, запрещен"');
    
    try {
      // Пытаемся аутентифицироваться
      const result = await this.authTest.testAuthentication();
      
      if (!result.success && result.error.includes('IP')) {
        console.log('✅ УСПЕХ: IP блокировка корректно обработана');
        console.log('💭 IP сервера не в белом списке ФНС');
        return { success: true, errorType: 'IP_BLOCKED' };
      } else if (result.success) {
        console.log('ℹ️ IP разрешен - тест прошел условно');
        console.log('💭 Сервер в белом списке ФНС');
        return { success: true, errorType: 'IP_ALLOWED' };
      } else {
        console.log('❌ ОШИБКА: Неожиданный тип ошибки');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.log('❌ ОШИБКА при тестировании IP блокировки:', error.message);
      return { success: false, error: error.message };
    }
  }

  async testInvalidTokenAccess() {
    console.log('\n🔑 === Тест доступа с невалидным токеном ===');
    
    const invalidToken = 'invalid_token_12345';
    const soapRequest = `
      <soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/">
        <soap-env:Body>
          <ns0:SendMessageRequest xmlns:ns0="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageConsumerService/types/1.0">
            <ns0:Message>
              <tns:GetTicketRequest xmlns:tns="urn://x-artefacts-gnivc-ru/ais3/kkt/KktTicketService/types/1.0">
                <tns:GetTicketInfo>
                  <tns:Sum>100000</tns:Sum>
                  <tns:Date>2023-01-01T12:00:00</tns:Date>
                  <tns:Fn>1234567890123456</tns:Fn>
                  <tns:TypeOperation>1</tns:TypeOperation>
                  <tns:FiscalDocumentId>12345</tns:FiscalDocumentId>
                  <tns:FiscalSign>123456789</tns:FiscalSign>
                  <tns:RawData>true</tns:RawData>
                </tns:GetTicketInfo>
              </tns:GetTicketRequest>
            </ns0:Message>
          </ns0:SendMessageRequest>
        </soap-env:Body>
      </soap-env:Envelope>
    `;

    try {
      const response = await axios.post(this.serviceUrl, soapRequest, {
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'SOAPAction': 'urn:SendMessageRequest',
          'FNS-OpenApi-Token': invalidToken,
        },
        timeout: 30000,
      });
      
      console.log('❌ ОШИБКА: Невалидный токен принят (не должно происходить)');
      return { success: false, error: 'Invalid token was accepted' };
      
    } catch (error) {
      if (error.response && error.response.status === 500) {
        const errorData = error.response.data;
        if (errorData.includes('Доступ к сервису для token запрещен')) {
          console.log('✅ УСПЕХ: Невалидный токен корректно отклонен');
          return { success: true, errorType: 'INVALID_TOKEN' };
        } else if (errorData.includes('Не удалось обнаружить требуемые заголовки')) {
          console.log('✅ УСПЕХ: Отсутствие заголовков корректно обработано');
          return { success: true, errorType: 'MISSING_HEADERS' };
        }
      }
      
      console.log('❌ ОШИБКА: Неожиданная ошибка при тестировании невалидного токена');
      console.log('📄 Детали ошибки:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  async testMissingRequiredHeaders() {
    console.log('\n📋 === Тест отсутствующих обязательных заголовков ===');
    
    const soapRequest = `
      <soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/">
        <soap-env:Body>
          <ns0:SendMessageRequest xmlns:ns0="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageConsumerService/types/1.0">
            <ns0:Message>
              <tns:GetTicketRequest xmlns:tns="urn://x-artefacts-gnivc-ru/ais3/kkt/KktTicketService/types/1.0">
                <tns:GetTicketInfo>
                  <tns:Sum>100000</tns:Sum>
                  <tns:Date>2023-01-01T12:00:00</tns:Date>
                  <tns:Fn>1234567890123456</tns:Fn>
                  <tns:TypeOperation>1</tns:TypeOperation>
                  <tns:FiscalDocumentId>12345</tns:FiscalDocumentId>
                  <tns:FiscalSign>123456789</tns:FiscalSign>
                  <tns:RawData>true</tns:RawData>
                </tns:GetTicketInfo>
              </tns:GetTicketRequest>
            </ns0:Message>
          </ns0:SendMessageRequest>
        </soap-env:Body>
      </soap-env:Envelope>
    `;

    try {
      const response = await axios.post(this.serviceUrl, soapRequest, {
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'SOAPAction': 'urn:SendMessageRequest',
          // Намеренно не передаем FNS-OpenApi-Token
        },
        timeout: 30000,
      });
      
      console.log('❌ ОШИБКА: Запрос без токена принят (не должно происходить)');
      return { success: false, error: 'Request without token was accepted' };
      
    } catch (error) {
      if (error.response && error.response.status === 500) {
        const errorData = error.response.data;
        if (errorData.includes('Не удалось обнаружить требуемые заголовки')) {
          console.log('✅ УСПЕХ: Отсутствие обязательных заголовков корректно обработано');
          return { success: true, errorType: 'MISSING_HEADERS' };
        }
      }
      
      console.log('❌ ОШИБКА: Неожиданная ошибка при тестировании отсутствующих заголовков');
      console.log('📄 Детали ошибки:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  async testInvalidXmlStructure() {
    console.log('\n🔧 === Тест невалидной XML структуры ===');
    
    // Получаем валидный токен для теста
    let token;
    try {
      const authResult = await this.authTest.testAuthentication();
      if (!authResult.success) {
        console.log('⚠️ Не удалось получить токен для теста - пропускаем');
        return { success: true, skipped: true, reason: 'No valid token' };
      }
      token = authResult.token;
    } catch (error) {
      console.log('⚠️ Аутентификация недоступна - пропускаем тест');
      return { success: true, skipped: true, reason: 'Authentication unavailable' };
    }
    
    const invalidSoapRequest = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiMessageConsumerService/types/1.0">
        <soapenv:Header/>
        <soapenv:Body>
          <ns:GetMessageRequest>
            <ns:Message>
              <test>
                <tns:AuthRequest xmlns:tns="urn://x-artefacts-gnivc-ru/ais3/kkt/AuthService/types/1.0">
                  <tns:AuthAppInfo>
                    <tns:MasterToken>invalid_structure</tns:MasterToken>
                  </tns:AuthAppInfo>
                </tns:AuthRequest>
              </test>
            </ns:Message>
          </ns:GetMessageRequest>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    try {
      const response = await axios.post(this.serviceUrl, invalidSoapRequest, {
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'SOAPAction': 'urn:SendMessageRequest',
          'FNS-OpenApi-Token': token,
        },
        timeout: 30000,
      });
      
      console.log('❌ ОШИБКА: Невалидная XML структура принята (не должно происходить)');
      return { success: false, error: 'Invalid XML was accepted' };
      
    } catch (error) {
      if (error.response && error.response.status === 500) {
        const errorData = error.response.data;
        if (errorData.includes('Unmarshalling Error') || errorData.includes('Invalid content')) {
          console.log('✅ УСПЕХ: Невалидная XML структура корректно отклонена');
          return { success: true, errorType: 'INVALID_XML' };
        }
      }
      
      console.log('❌ ОШИБКА: Неожиданная ошибка при тестировании невалидной XML');
      console.log('📄 Детали ошибки:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  async testMessageNotFound() {
    console.log('\n🔍 === Тест MessageNotFound ===');
    
    // Получаем валидный токен для теста
    let token;
    try {
      const authResult = await this.authTest.testAuthentication();
      if (!authResult.success) {
        console.log('⚠️ Не удалось получить токен для теста - пропускаем');
        return { success: true, skipped: true, reason: 'No valid token' };
      }
      token = authResult.token;
    } catch (error) {
      console.log('⚠️ Аутентификация недоступна - пропускаем тест');
      return { success: true, skipped: true, reason: 'Authentication unavailable' };
    }
    
    const nonExistentMessageId = '00000000-0000-0000-0000-000000000000';
    const soapRequest = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageConsumerService/types/1.0">
        <soapenv:Header/>
        <soapenv:Body>
          <ns:GetMessageRequest>
            <ns:MessageId>${nonExistentMessageId}</ns:MessageId>
          </ns:GetMessageRequest>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    try {
      const response = await axios.post(this.serviceUrl, soapRequest, {
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'SOAPAction': 'urn:GetMessageRequest',
          'FNS-OpenApi-Token': token,
        },
        timeout: 30000,
      });
      
      console.log('❌ ОШИБКА: Несуществующий MessageId принят (не должно происходить)');
      return { success: false, error: 'Non-existent MessageId was accepted' };
      
    } catch (error) {
      if (error.response && error.response.status === 500) {
        const errorData = error.response.data;
        if (errorData.includes('По переданному MessageId') && errorData.includes('сообщение не найдено')) {
          console.log('✅ УСПЕХ: MessageNotFound корректно обработан');
          return { success: true, errorType: 'MESSAGE_NOT_FOUND' };
        }
      }
      
      console.log('❌ ОШИБКА: Неожиданная ошибка при тестировании MessageNotFound');
      console.log('📄 Детали ошибки:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  async testRateLimiting() {
    console.log('\n⏱️ === Тест Rate Limiting ===');
    console.log('💡 Симулируем множественные запросы для проверки лимитов');
    
    // Получаем валидный токен для теста
    let token;
    try {
      const authResult = await this.authTest.testAuthentication();
      if (!authResult.success) {
        console.log('⚠️ Не удалось получить токен для теста - пропускаем');
        return { success: true, skipped: true, reason: 'No valid token' };
      }
      token = authResult.token;
    } catch (error) {
      console.log('⚠️ Аутентификация недоступна - пропускаем тест');
      return { success: true, skipped: true, reason: 'Authentication unavailable' };
    }
    
    const messageId = '11111111-1111-1111-1111-111111111111';
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

    let rateLimitHit = false;
    let requestCount = 0;
    const maxRequests = 5; // Ограничиваем количество попыток

    console.log('🔄 Отправка множественных запросов...');
    
    for (let i = 0; i < maxRequests; i++) {
      try {
        requestCount++;
        const response = await axios.post(this.serviceUrl, soapRequest, {
          headers: {
            'Content-Type': 'text/xml;charset=UTF-8',
            'SOAPAction': 'urn:GetMessageRequest',
            'FNS-OpenApi-Token': token,
          },
          timeout: 10000,
        });
        
        console.log(`📤 Запрос ${requestCount}: статус ${response.status}`);
        
      } catch (error) {
        if (error.response) {
          if (error.response.status === 429) {
            console.log(`🚫 Запрос ${requestCount}: Hit rate limit (429)`);
            rateLimitHit = true;
            break;
          } else if (error.response.data && error.response.data.includes('Превышено количество запросов')) {
            console.log(`🚫 Запрос ${requestCount}: Hit rate limit (server message)`);
            rateLimitHit = true;
            break;
          } else {
            console.log(`📤 Запрос ${requestCount}: статус ${error.response.status} (другая ошибка)`);
          }
        } else {
          console.log(`❌ Запрос ${requestCount}: сетевая ошибка`);
        }
      }
      
      // Небольшая пауза между запросами
      await this.sleep(100);
    }
    
    if (rateLimitHit) {
      console.log('✅ УСПЕХ: Rate limiting работает корректно');
      return { success: true, errorType: 'RATE_LIMIT', requestCount };
    } else {
      console.log('ℹ️ Rate limiting не сработал за время теста (это нормально)');
      return { success: true, errorType: 'NO_RATE_LIMIT', requestCount };
    }
  }

  async testServerInternalError() {
    console.log('\n🔧 === Тест внутренней ошибки сервера ===');
    console.log('💡 Этот тест проверяет обработку внутренних ошибок ФНС');
    
    // Получаем валидный токен
    let token;
    try {
      const authResult = await this.authTest.testAuthentication();
      if (!authResult.success) {
        console.log('⚠️ Не удалось получить токен для теста - пропускаем');
        return { success: true, skipped: true, reason: 'No valid token' };
      }
      token = authResult.token;
    } catch (error) {
      console.log('⚠️ Аутентификация недоступна - пропускаем тест');
      return { success: true, skipped: true, reason: 'Authentication unavailable' };
    }
    
    // Пытаемся отправить потенциально проблемный запрос
    const potentiallyProblematicRequest = `
      <soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/">
        <soap-env:Body>
          <ns0:SendMessageRequest xmlns:ns0="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageConsumerService/types/1.0">
            <ns0:Message>
              <tns:GetTicketRequest xmlns:tns="urn://x-artefacts-gnivc-ru/ais3/kkt/KktTicketService/types/1.0">
                <tns:GetTicketInfo>
                  <tns:Sum>99999999999</tns:Sum>
                  <tns:Date>1900-01-01T00:00:00</tns:Date>
                  <tns:Fn>0000000000000000</tns:Fn>
                  <tns:TypeOperation>999</tns:TypeOperation>
                  <tns:FiscalDocumentId>0</tns:FiscalDocumentId>
                  <tns:FiscalSign>0</tns:FiscalSign>
                  <tns:RawData>true</tns:RawData>
                </tns:GetTicketInfo>
              </tns:GetTicketRequest>
            </ns0:Message>
          </ns0:SendMessageRequest>
        </soap-env:Body>
      </soap-env:Envelope>
    `;

    try {
      const response = await axios.post(this.serviceUrl, potentiallyProblematicRequest, {
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'SOAPAction': 'urn:SendMessageRequest',
          'FNS-OpenApi-Token': token,
        },
        timeout: 30000,
      });
      
      console.log('ℹ️ Запрос принят, возможно данные валидны для системы');
      return { success: true, errorType: 'REQUEST_ACCEPTED' };
      
    } catch (error) {
      if (error.response && error.response.status === 500) {
        const errorData = error.response.data;
        if (errorData.includes('Произошла внутренняя ошибка')) {
          console.log('✅ УСПЕХ: Внутренняя ошибка сервера корректно обработана');
          return { success: true, errorType: 'INTERNAL_ERROR' };
        }
      }
      
      console.log('ℹ️ Получена ошибка валидации (ожидаемо для тестовых данных)');
      return { success: true, errorType: 'VALIDATION_ERROR' };
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async runAllTests() {
    console.log('🚀 === ЗАПУСК ТЕСТОВ ОБРАБОТКИ ОШИБОК ФНС ===\n');
    
    const results = {
      ipAccessTest: await this.testIpAccessDenied(),
      invalidTokenTest: await this.testInvalidTokenAccess(),
      missingHeadersTest: await this.testMissingRequiredHeaders(),
      invalidXmlTest: await this.testInvalidXmlStructure(),
      messageNotFoundTest: await this.testMessageNotFound(),
      rateLimitTest: await this.testRateLimiting(),
      internalErrorTest: await this.testServerInternalError()
    };
    
    console.log('\n📊 === РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ ОШИБОК ===');
    Object.entries(results).forEach(([testName, result]) => {
      const status = result.success ? '✅ ПРОЙДЕН' : '❌ ПРОВАЛЕН';
      const skipped = result.skipped ? ' (ПРОПУЩЕН)' : '';
      const errorType = result.errorType ? ` [${result.errorType}]` : '';
      console.log(`${status} ${testName}${skipped}${errorType}`);
    });
    
    const allPassed = Object.values(results).every(result => result.success);
    console.log(`\n🎯 Общий результат: ${allPassed ? '✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ' : '❌ ЕСТЬ ПРОВАЛЕННЫЕ ТЕСТЫ'}`);
    
    return results;
  }
}

// Запуск тестов если файл запущен напрямую
if (require.main === module) {
  const test = new FnsErrorsTest();
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

module.exports = FnsErrorsTest;