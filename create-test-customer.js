const axios = require('axios');

const BASE_URL = 'http://localhost:4000/api';

// Данные тестового клиента
const TEST_CUSTOMER = {
  name: 'Тестовый',
  surname: 'Клиент',
  patronymic: 'Фармвижн',
  email: 'test.customer@pharm-vision.ru',
  password: 'testpassword123',
  address: 'Тестовый адрес, 123',
  promotionId: 'test-promotion-id' // Нужно будет создать или использовать существующую акцию
};

async function createTestCustomer() {
  console.log('👤 Создание тестового клиента...\n');

  try {
    // Сначала попробуем создать клиента
    console.log('📝 Регистрация клиента...');
    console.log(`   Email: ${TEST_CUSTOMER.email}`);
    console.log(`   Имя: ${TEST_CUSTOMER.name} ${TEST_CUSTOMER.surname}`);

    const response = await axios.post(`${BASE_URL}/customers`, TEST_CUSTOMER);
    
    console.log('✅ Клиент успешно создан!');
    console.log('📧 Проверьте email для подтверждения регистрации');
    console.log('\n💡 После подтверждения email, клиент сможет:');
    console.log('   • Сканировать QR-коды чеков');
    console.log('   • Получать кешбек за покупки');
    console.log('   • Просматривать историю операций');

    return response.data;

  } catch (error) {
    if (error.response?.status === 409) {
      console.log('ℹ️ Клиент с таким email уже существует');
      
      // Попробуем войти
      try {
        console.log('\n🔐 Попытка входа...');
        const loginResponse = await axios.post(`${BASE_URL}/auth/login/customer`, {
          email: TEST_CUSTOMER.email,
          password: TEST_CUSTOMER.password,
          promotionId: TEST_CUSTOMER.promotionId
        });
        
        console.log('✅ Успешный вход в систему!');
        console.log(`🎫 Токен получен: ${loginResponse.data.access.substring(0, 20)}...`);
        
        return { 
          customer: 'existing',
          token: loginResponse.data.access 
        };
        
      } catch (loginError) {
        console.log('❌ Ошибка входа:', loginError.response?.data?.message || loginError.message);
        console.log('💡 Возможно, нужно создать акцию или клиент не подтвержден');
      }
    } else {
      console.log('❌ Ошибка создания клиента:', error.response?.data?.message || error.message);
      
      if (error.response?.data?.message?.includes('promotionId')) {
        console.log('\n💡 Сначала нужно создать акцию (promotion). Пример:');
        console.log('   POST /api/promotions');
        console.log('   {');
        console.log('     "promotionId": "test-promotion-id",');
        console.log('     "name": "Тестовая акция",');
        console.log('     "description": "Акция для тестирования"');
        console.log('   }');
      }
    }
  }
}

// Запуск создания клиента
createTestCustomer().catch(error => {
  console.error('💥 Критическая ошибка:', error.message);
  
  if (error.code === 'ECONNREFUSED') {
    console.log('\n💡 Убедитесь, что сервер запущен на порту 4000:');
    console.log('   npm run start:dev');
  }
});