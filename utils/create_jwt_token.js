const crypto = require('crypto');

// Функция для создания JWT токена
function createJWTToken(payload, secret = 'gpW7DtMraBcCf4rXXyMmLZ25cMsrjv6z') {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const exp = now + (24 * 60 * 60); // 24 часа

  const finalPayload = {
    ...payload,
    iat: now,
    exp: exp
  };

  // Кодируем header и payload в base64
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(finalPayload)).toString('base64url');

  // Создаем подпись
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64url');

  return `${data}.${signature}`;
}

// Примеры создания токенов
function generateTestTokens() {
  console.log('🔐 Генерация тестовых JWT токенов\n');

  // Токен для пользователя с networkId
  const userWithNetworkToken = createJWTToken({
    id: 1,
    username: 'testuser',
    role: 'CUSTOMER',
    networkId: 1
  });

  console.log('Токен пользователя с networkId:');
  console.log(userWithNetworkToken);
  console.log('\n');

  // Токен для пользователя без networkId
  const userWithoutNetworkToken = createJWTToken({
    id: 2,
    username: 'testuser2',
    role: 'CUSTOMER'
  });

  console.log('Токен пользователя без networkId:');
  console.log(userWithoutNetworkToken);
  console.log('\n');

  // Токен для админа
  const adminToken = createJWTToken({
    id: 1,
    username: 'admin',
    role: 'ADMIN'
  });

  console.log('Токен админа:');
  console.log(adminToken);
  console.log('\n');

  // Токен для компании
  const companyToken = createJWTToken({
    id: 1,
    username: 'r-pharm',
    role: 'COMPANY',
    networkId: 1
  });

  console.log('Токен компании:');
  console.log(companyToken);
  console.log('\n');

  return {
    userWithNetwork: userWithNetworkToken,
    userWithoutNetwork: userWithoutNetworkToken,
    admin: adminToken,
    company: companyToken
  };
}

// Функция для валидации токена
function validateToken(token, secret = 'gpW7DtMraBcCf4rXXyMmLZ25cMsrjv6z') {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Неверный формат токена' };
    }

    const [encodedHeader, encodedPayload, signature] = parts;

    // Проверяем подпись
    const data = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = crypto.createHmac('sha256', secret).update(data).digest('base64url');

    if (signature !== expectedSignature) {
      return { valid: false, error: 'Неверная подпись' };
    }

    // Декодируем payload
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString());
    
    // Проверяем срок действия
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { valid: false, error: 'Токен истек' };
    }

    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// Тестирование токенов
function testTokens() {
  console.log('🧪 Тестирование JWT токенов\n');

  const tokens = generateTestTokens();

  console.log('Проверка валидности токенов:\n');

  for (const [name, token] of Object.entries(tokens)) {
    const result = validateToken(token);
    console.log(`${name}:`);
    console.log(`  Валидность: ${result.valid ? '✅' : '❌'}`);
    if (result.valid) {
      console.log(`  Payload: ${JSON.stringify(result.payload, null, 2)}`);
    } else {
      console.log(`  Ошибка: ${result.error}`);
    }
    console.log('');
  }
}

// Экспорт функций
module.exports = {
  createJWTToken,
  validateToken,
  generateTestTokens,
  testTokens
};

// Запуск тестов если файл выполняется напрямую
if (require.main === module) {
  testTokens();
}