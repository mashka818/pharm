const axios = require('axios');

// Конфигурация теста
const config = {
  baseURL: 'http://localhost:4000',
  headers: {
    'Content-Type': 'application/json',
  },
};

// Тестовые данные
const testData = {
  // QR-код в формате ФНС
  qrCode: 't=20231201T1430&s=1234.56&fn=9287440300090728&i=12345&fp=1234567890&n=1',
  
  // Тестовый JWT токен (замените на реальный)
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJ0ZXN0dXNlciIsInJvbGUiOiJDVVNUT01FUiIsIm5ldHdvcmtJZCI6MSwiaWF0IjoxNzM1NzI4MDAwLCJleHAiOjE3MzU4MTQ0MDB9.test_signature',
  
  // Поддомены для тестирования
  subdomains: [
    'р-фарм.чекпоинт.рф',
    'apteka-36-6.чекпоинт.рф',
    'invalid-subdomain.чекпоинт.рф',
  ],
};

// Функция для тестирования QR-сканирования
async function testQrScanning() {
  console.log('🧪 Начинаем тестирование QR-сканирования...\n');

  for (const subdomain of testData.subdomains) {
    console.log(`📡 Тестируем поддомен: ${subdomain}`);
    
    try {
      const response = await axios.post('/fns/qr/scan', {
        qrCode: testData.qrCode,
        token: testData.token,
        additionalData: {
          test: true,
          timestamp: new Date().toISOString(),
        },
      }, {
        ...config,
        headers: {
          ...config.headers,
          'Host': subdomain,
        },
      });

      console.log('✅ Успешный ответ:');
      console.log(JSON.stringify(response.data, null, 2));
      
    } catch (error) {
      console.log('❌ Ошибка:');
      if (error.response) {
        console.log(`Статус: ${error.response.status}`);
        console.log(`Данные: ${JSON.stringify(error.response.data, null, 2)}`);
      } else {
        console.log(`Ошибка: ${error.message}`);
      }
    }
    
    console.log('---\n');
  }
}

// Функция для тестирования парсинга QR-кода
function testQrParsing() {
  console.log('🔍 Тестируем парсинг QR-кода...\n');

  const qrParser = {
    parseQrCode: (qrCode) => {
      const params = new URLSearchParams(qrCode);
      
      const fn = params.get('fn');
      const i = params.get('i');
      const fp = params.get('fp');
      const s = params.get('s');
      const t = params.get('t');
      const n = params.get('n');

      if (!fn || !i || !fp || !s || !t) {
        throw new Error('Неверный формат QR-кода. Отсутствуют обязательные параметры.');
      }

      const parseFnsDate = (dateStr) => {
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        const hour = dateStr.substring(9, 11);
        const minute = dateStr.substring(11, 13);
        
        return `${year}-${month}-${day}T${hour}:${minute}:00`;
      };

      return {
        fn,
        fd: i,
        fp,
        sum: s,
        date: parseFnsDate(t),
        typeOperation: n || '1',
      };
    },

    validateQrCode: (qrCode) => {
      try {
        const params = new URLSearchParams(qrCode);
        const requiredParams = ['fn', 'i', 'fp', 's', 't'];
        
        return requiredParams.every(param => params.has(param));
      } catch {
        return false;
      }
    },
  };

  // Тестовые QR-коды
  const testQrCodes = [
    't=20231201T1430&s=1234.56&fn=9287440300090728&i=12345&fp=1234567890&n=1',
    't=20231201T1430&s=1234.56&fn=9287440300090728&i=12345&fp=1234567890',
    'invalid-qr-code',
    't=20231201T1430&s=1234.56&fn=9287440300090728&i=12345',
  ];

  for (const qrCode of testQrCodes) {
    console.log(`📋 Тестируем QR-код: ${qrCode}`);
    
    try {
      const isValid = qrParser.validateQrCode(qrCode);
      console.log(`Валидность: ${isValid ? '✅' : '❌'}`);
      
      if (isValid) {
        const parsed = qrParser.parseQrCode(qrCode);
        console.log('Парсинг:');
        console.log(JSON.stringify(parsed, null, 2));
      }
      
    } catch (error) {
      console.log(`❌ Ошибка парсинга: ${error.message}`);
    }
    
    console.log('---\n');
  }
}

// Функция для тестирования извлечения поддомена
function testSubdomainExtraction() {
  console.log('🌐 Тестируем извлечение поддоменов...\n');

  const extractSubdomain = (host) => {
    if (!host) return null;

    const hostWithoutPort = host.split(':')[0];
    const parts = hostWithoutPort.split('.');
    
    if (parts.length >= 3) {
      return parts[0];
    }
    
    return null;
  };

  const testHosts = [
    'р-фарм.чекпоинт.рф',
    'apteka-36-6.чекпоинт.рф',
    'test.localhost:4000',
    'localhost:4000',
    'invalid-host',
    null,
  ];

  for (const host of testHosts) {
    const subdomain = extractSubdomain(host);
    console.log(`Хост: ${host || 'null'}`);
    console.log(`Поддомен: ${subdomain || 'null'}`);
    console.log('---\n');
  }
}

// Главная функция
async function runTests() {
  console.log('🚀 Запуск тестов интеграции QR-кодов ФНС\n');
  
  // Тест парсинга QR-кода
  testQrParsing();
  
  // Тест извлечения поддомена
  testSubdomainExtraction();
  
  // Тест API (только если сервер запущен)
  console.log('⚠️  Для тестирования API убедитесь, что сервер запущен на localhost:4000');
  console.log('Команда для запуска: npm run start:dev\n');
  
  // Раскомментируйте следующую строку для тестирования API
  // await testQrScanning();
}

// Запуск тестов
runTests().catch(console.error);