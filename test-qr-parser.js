const axios = require('axios');

const BASE_URL = 'http://localhost:4000/api';

// Различные форматы QR-кодов для тестирования
const testCases = [
  {
    name: 'Стандартный QR из документации ФНС',
    qrData: 't=20190409T1638&s=2400.00&fn=9287440300090728&i=77133&fp=1482926127&n=1'
  },
  {
    name: 'QR с URL префиксом',
    qrData: 'https://check.ofd.ru/rec/8710000100186648/77133/1482926127?t=20190409T1638&s=2400.00&fn=9287440300090728&i=77133&fp=1482926127&n=1'
  },
  {
    name: 'QR с другим форматом даты',
    qrData: 't=20240101T1200&s=1500.50&fn=1234567890123456&i=12345&fp=9876543210&n=1'
  },
  {
    name: 'Минимальный QR',
    qrData: 't=20240101T1200&s=100&fn=1111111111111111&i=1&fp=1&n=1'
  }
];

async function testQrParser() {
  console.log('🔍 Тестирование парсера QR-кодов...\n');

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`${i + 1}️⃣ ${testCase.name}`);
    console.log(`📱 QR данные: ${testCase.qrData}`);

    try {
      const response = await axios.post(`${BASE_URL}/receipt/parse-qr`, {
        qrData: testCase.qrData
      });

      if (response.data.success) {
        console.log('✅ Успешно распарсен:');
        console.log(`   📋 ФН: ${response.data.data.fn}`);
        console.log(`   📄 ФД: ${response.data.data.fd}`);
        console.log(`   🔐 ФП: ${response.data.data.fp}`);
        console.log(`   💰 Сумма: ${response.data.data.sum} копеек`);
        console.log(`   📅 Дата: ${response.data.data.date}`);
        console.log(`   🔢 Тип операции: ${response.data.data.typeOperation}`);
      } else {
        console.log('❌ Ошибка парсинга:', response.data.error);
      }
    } catch (error) {
      console.log('❌ Ошибка запроса:', error.response?.data || error.message);
    }

    console.log(''); // Пустая строка для разделения
  }

  console.log('🎉 Тестирование парсера завершено!');
}

// Запуск тестов
testQrParser().catch(error => {
  console.error('💥 Критическая ошибка:', error.message);
  
  if (error.code === 'ECONNREFUSED') {
    console.log('\n💡 Убедитесь, что сервер запущен на порту 4000:');
    console.log('   npm run start:dev');
  }
});