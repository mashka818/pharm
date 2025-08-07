const axios = require('axios');

class FnsAuthTest {
  constructor() {
    this.masterToken = process.env.FTX_TOKEN || 'LFgDIA4yBZjW6h174iwVDcRoDHhjmpuFLtAX3kHPT9ctgggajk36aLJIzIcs2kZyKvTqLy4rSEHi7KOgY0fuNHKPbGCekDg9qjpin04K4ZyfolqtwDBZ6f6Isja3MMWe';
    this.authServiceUrl = process.env.FTX_API_URL || 'https://openapi.nalog.ru:8090';
    this.authEndpoint = `${this.authServiceUrl}/open-api/AuthService/0.1`;
  }

  async testAuthentication() {
    console.log('🔐 === Тест аутентификации ФНС ===');
    console.log(`Endpoint: ${this.authEndpoint}`);
    console.log(`Master Token: ${this.masterToken.substring(0, 20)}...`);
    
    const soapRequest = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiMessageConsumerService/types/1.0">
        <soapenv:Header/>
        <soapenv:Body>
          <ns:GetMessageRequest>
            <ns:Message>
              <tns:AuthRequest xmlns:tns="urn://x-artefacts-gnivc-ru/ais3/kkt/AuthService/types/1.0">
                <tns:AuthAppInfo>
                  <tns:MasterToken>${this.masterToken}</tns:MasterToken>
                </tns:AuthAppInfo>
              </tns:AuthRequest>
            </ns:Message>
          </ns:GetMessageRequest>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    try {
      console.log('📤 Отправка SOAP запроса аутентификации...');
      
      const response = await axios.post(this.authEndpoint, soapRequest, {
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'SOAPAction': 'urn:GetMessageRequest',
        },
        timeout: 30000,
      });

      console.log(`✅ Статус ответа: ${response.status}`);
      console.log(`📋 Заголовки ответа:`, response.headers);
      
      const token = this.parseAuthResponse(response.data);
      const expiryInfo = this.parseExpiryTime(response.data);
      
      console.log(`🎯 Получен токен: ${token}`);
      console.log(`⏰ Время истечения: ${expiryInfo}`);
      
      if (token && token.length > 10) {
        console.log('✅ УСПЕХ: Токен получен успешно');
        return { success: true, token, expiryInfo };
      } else {
        console.log('❌ ОШИБКА: Получен невалидный токен');
        return { success: false, error: 'Invalid token format' };
      }
      
    } catch (error) {
      console.log('❌ ОШИБКА аутентификации:');
      
      if (error.response) {
        console.log(`📊 HTTP статус: ${error.response.status}`);
        console.log(`📋 Заголовки ошибки:`, error.response.headers);
        console.log(`📄 Тело ошибки:`, error.response.data);
        
        if (error.response.data && typeof error.response.data === 'string') {
          if (error.response.data.includes('Доступ к сервису для переданного IP, запрещен')) {
            console.log('🚫 IP адрес сервера не добавлен в белый список ФНС');
            console.log('💡 Рекомендация: Обратитесь в службу поддержки ФНС для добавления IP в белый список');
          } else if (error.response.data.includes('Произошел timeout ожидания ответа')) {
            console.log('⏱️ Таймаут ожидания ответа от сервиса');
          } else if (error.response.data.includes('Произошла внутренняя ошибка')) {
            console.log('🔧 Внутренняя ошибка сервиса ФНС');
          }
        }
      } else if (error.request) {
        console.log('🌐 Сетевая ошибка - нет ответа от сервера');
        console.log('🔍 Проверьте доступность сервера ФНС');
      } else {
        console.log('⚙️ Ошибка настройки запроса:', error.message);
      }
      
      return { success: false, error: error.message };
    }
  }

  parseAuthResponse(xmlResponse) {
    const tokenPatterns = [
      /<ns2:Token>([^<]+)<\/ns2:Token>/,
      /<Token>([^<]+)<\/Token>/,
      /<tns:Token>([^<]+)<\/tns:Token>/
    ];
    
    for (const pattern of tokenPatterns) {
      const match = xmlResponse.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    throw new Error('Не удалось извлечь токен из ответа ФНС');
  }

  parseExpiryTime(xmlResponse) {
    const expiryPatterns = [
      /<ns2:ExpireTime>([^<]+)<\/ns2:ExpireTime>/,
      /<ExpireTime>([^<]+)<\/ExpireTime>/,
      /<tns:ExpireTime>([^<]+)<\/tns:ExpireTime>/
    ];
    
    for (const pattern of expiryPatterns) {
      const match = xmlResponse.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return 'Время истечения не найдено';
  }

  async testInvalidMasterToken() {
    console.log('\n🔐 === Тест с невалидным мастер-токеном ===');
    
    const invalidToken = 'invalid_token_123';
    const soapRequest = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiMessageConsumerService/types/1.0">
        <soapenv:Header/>
        <soapenv:Body>
          <ns:GetMessageRequest>
            <ns:Message>
              <tns:AuthRequest xmlns:tns="urn://x-artefacts-gnivc-ru/ais3/kkt/AuthService/types/1.0">
                <tns:AuthAppInfo>
                  <tns:MasterToken>${invalidToken}</tns:MasterToken>
                </tns:AuthAppInfo>
              </tns:AuthRequest>
            </ns:Message>
          </ns:GetMessageRequest>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    try {
      const response = await axios.post(this.authEndpoint, soapRequest, {
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'SOAPAction': 'urn:GetMessageRequest',
        },
        timeout: 30000,
      });
      
      console.log('❌ ОШИБКА: Невалидный токен принят (не должно происходить)');
      return { success: false, error: 'Invalid token was accepted' };
      
    } catch (error) {
      if (error.response && error.response.status === 500) {
        console.log('✅ УСПЕХ: Невалидный токен отклонен как ожидалось');
        return { success: true };
      } else {
        console.log('❌ ОШИБКА: Неожиданная ошибка при тестировании невалидного токена');
        return { success: false, error: error.message };
      }
    }
  }

  async runAllTests() {
    console.log('🚀 === ЗАПУСК ТЕСТОВ АУТЕНТИФИКАЦИИ ФНС ===\n');
    
    const results = {
      authTest: await this.testAuthentication(),
      invalidTokenTest: await this.testInvalidMasterToken()
    };
    
    console.log('\n📊 === РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ ===');
    console.log(`✅ Аутентификация: ${results.authTest.success ? 'ПРОЙДЕН' : 'ПРОВАЛЕН'}`);
    console.log(`✅ Невалидный токен: ${results.invalidTokenTest.success ? 'ПРОЙДЕН' : 'ПРОВАЛЕН'}`);
    
    const allPassed = Object.values(results).every(result => result.success);
    console.log(`\n🎯 Общий результат: ${allPassed ? '✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ' : '❌ ЕСТЬ ПРОВАЛЕННЫЕ ТЕСТЫ'}`);
    
    return results;
  }
}

if (require.main === module) {
  const test = new FnsAuthTest();
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

module.exports = FnsAuthTest;