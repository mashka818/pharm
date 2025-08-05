const axios = require('axios');

const BASE_URL = 'http://localhost:4000/api';

// Учетные данные админа из .env
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'admin'
};

// Тестовые данные QR-кода (пример из документации ФНС)
const testQrData = {
  qrData: 't=20190409T1638&s=2400.00&fn=9287440300090728&i=77133&fp=1482926127&n=1'
};

const testReceiptData = {
  fn: '9287440300090728',
  fd: '77133',
  fp: '1482926127',
  sum: '2400',
  date: '2019-04-09T16:38:00',
  typeOperation: '1'
};

async function testFnsIntegration() {
  console.log('🚀 Тестирование интеграции ФНС...\n');

  let adminToken = null;

  try {
    // 0. Аутентификация админа для доступа к защищенным endpoints
    console.log('0️⃣ Аутентификация админа...');
    try {
      const authResponse = await axios.post(`${BASE_URL}/auth/login/admin`, ADMIN_CREDENTIALS);
      adminToken = authResponse.data.access;
      console.log('✅ Админ успешно аутентифицирован');
    } catch (error) {
      console.log('⚠️ Ошибка аутентификации админа:', error.response?.data?.message || error.message);
      console.log('   Продолжаем тестирование без защищенных endpoints...');
    }
    // 1. Тест парсинга QR-кода
    console.log('1️⃣ Тестирование парсинга QR-кода...');
    const parseResponse = await axios.post(`${BASE_URL}/receipt/parse-qr`, testQrData);
    console.log('✅ QR код успешно распарсен:', JSON.stringify(parseResponse.data, null, 2));

    // 2. Тест верификации чека (без аутентификации)
    console.log('\n2️⃣ Тестирование верификации чека...');
    const verifyResponse = await axios.post(`${BASE_URL}/receipt/verify/test`, testReceiptData);
    console.log('✅ Верификация запущена:', JSON.stringify(verifyResponse.data, null, 2));

    const requestId = verifyResponse.data.requestId;

    // 3. Проверка статуса запроса
    if (requestId) {
      console.log('\n3️⃣ Проверка статуса запроса...');
      
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          const statusResponse = await axios.get(`${BASE_URL}/receipt/status/${requestId}`);
          const status = statusResponse.data.status;
          
          console.log(`📊 Статус запроса (попытка ${attempts + 1}):`, JSON.stringify(statusResponse.data, null, 2));
          
          if (status === 'success' || status === 'rejected' || status === 'failed') {
            console.log('✅ Запрос завершен со статусом:', status);
            break;
          }
          
          if (status === 'processing' || status === 'pending') {
            if (attempts < maxAttempts - 1) {
              console.log('⏳ Ожидание результата...');
              await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
              console.log('⏰ Максимальное количество попыток достигнуто. Запрос все еще обрабатывается.');
            }
            attempts++;
            continue;
          }
          
        } catch (error) {
          console.log('❌ Ошибка при проверке статуса:', error.response?.data || error.message);
          break;
        }
      }
    }

    // 4. Проверка статистики очереди
    console.log('\n4️⃣ Проверка статистики очереди...');
    if (adminToken) {
      try {
        const statsResponse = await axios.get(`${BASE_URL}/receipt/stats/queue`, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log('📈 Статистика очереди:', JSON.stringify(statsResponse.data, null, 2));
      } catch (error) {
        console.log('❌ Ошибка получения статистики очереди:', error.response?.data?.message || error.message);
      }
    } else {
      console.log('⚠️ Статистика очереди недоступна (нет токена аутентификации)');
    }

    // 5. Проверка дневного лимита
    console.log('\n5️⃣ Проверка дневного лимита...');
    if (adminToken) {
      try {
        const limitResponse = await axios.get(`${BASE_URL}/receipt/stats/daily-count`, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log('📊 Дневной лимит:', JSON.stringify(limitResponse.data, null, 2));
      } catch (error) {
        console.log('❌ Ошибка получения информации о лимите:', error.response?.data?.message || error.message);
      }
    } else {
      console.log('⚠️ Информация о дневном лимите недоступна (нет токена аутентификации)');
    }

    // 6. Тест истории кешбека (требует клиентского токена)
    console.log('\n6️⃣ Проверка истории кешбека клиента...');
    console.log('ℹ️ Для тестирования истории кешбека нужен реальный клиент в системе');
    console.log('   Этот тест можно расширить при наличии тестового клиента');

    console.log('\n🎉 Тестирование завершено!');
    console.log('\n📝 Примечания:');
    console.log('• Статус "failed" или "pending" для тестовых данных - это нормально');
    console.log('• Тестовые данные из документации ФНС могут не существовать в реальной системе');
    console.log('• Для реальных чеков статус будет "success" или "rejected"');

  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error.response?.data || error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Убедитесь, что сервер запущен на порту 4000:');
      console.log('   npm run start:dev');
    }
  }
}

// Запуск тестов
testFnsIntegration();