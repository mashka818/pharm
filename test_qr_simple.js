// Упрощенный тест интеграции QR-кодов ФНС без внешних зависимостей

// Тестовые данные
const testData = {
  // QR-код в формате ФНС
  qrCode: 't=20231201T1430&s=1234.56&fn=9287440300090728&i=12345&fp=1234567890&n=1',
  
  // Поддомены для тестирования
  subdomains: [
    'р-фарм.чекпоинт.рф',
    'apteka-36-6.чекпоинт.рф',
    'invalid-subdomain.чекпоинт.рф',
  ],
};

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

// Функция для тестирования расчета кешбека
function testCashbackCalculation() {
  console.log('💰 Тестируем расчет кешбека...\n');

  const mockReceiptData = {
    items: [
      {
        name: 'Парацетамол 500мг',
        sku: 'PAR-500-001',
        price: 150,
        quantity: 2,
        total: 300,
      },
      {
        name: 'Аспирин 100мг',
        sku: 'ASP-100-001',
        price: 200,
        quantity: 1,
        total: 200,
      },
    ],
  };

  const mockOffers = [
    {
      id: 1,
      profit: 10,
      profitType: 'PERCENT',
      products: [
        { product: { name: 'Парацетамол', sku: 'PAR-500-001' } }
      ],
    },
    {
      id: 2,
      profit: 50,
      profitType: 'AMOUNT',
      products: [
        { product: { name: 'Аспирин', sku: 'ASP-100-001' } }
      ],
    },
  ];

  const calculateCashback = (receiptItems, offers) => {
    let totalCashback = 0;

    for (const item of receiptItems) {
      const matchingOffer = offers.find(offer => 
        offer.products.some(productOffer => 
          productOffer.product.sku === item.sku ||
          item.name.toLowerCase().includes(productOffer.product.name.toLowerCase())
        )
      );

      if (matchingOffer) {
        if (matchingOffer.profitType === 'PERCENT') {
          totalCashback += Math.round(item.total * (matchingOffer.profit / 100));
        } else {
          totalCashback += matchingOffer.profit;
        }
      }
    }

    return totalCashback;
  };

  const cashback = calculateCashback(mockReceiptData.items, mockOffers);
  console.log('Данные чека:');
  console.log(JSON.stringify(mockReceiptData, null, 2));
  console.log('\nПредложения:');
  console.log(JSON.stringify(mockOffers, null, 2));
  console.log(`\n💰 Рассчитанный кешбек: ${cashback} рублей`);
  console.log('---\n');
}

// Главная функция
function runTests() {
  console.log('🚀 Запуск тестов интеграции QR-кодов ФНС\n');
  
  // Тест парсинга QR-кода
  testQrParsing();
  
  // Тест извлечения поддомена
  testSubdomainExtraction();
  
  // Тест расчета кешбека
  testCashbackCalculation();
  
  console.log('✅ Все тесты завершены!');
  console.log('\n📋 Следующие шаги:');
  console.log('1. Настройте базу данных с помощью SQL-скриптов');
  console.log('2. Запустите приложение: npm run start:dev');
  console.log('3. Протестируйте API с реальными данными');
  console.log('4. Проверьте логи для отладки');
}

// Запуск тестов
runTests();