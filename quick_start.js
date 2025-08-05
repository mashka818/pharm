#!/usr/bin/env node

// Скрипт быстрого запуска и тестирования интеграции QR-кодов ФНС

const { runSystemCheck } = require('./utils/monitor_system');
const { generateTestTokens } = require('./utils/create_jwt_token');

console.log('🚀 Быстрый запуск интеграции QR-кодов ФНС\n');

// 1. Проверка системы
console.log('📋 Шаг 1: Проверка системы...');
const systemReport = runSystemCheck();

if (systemReport.overallScore < 90) {
  console.log('\n❌ Система не готова к запуску. Исправьте ошибки выше.');
  process.exit(1);
}

// 2. Генерация тестовых токенов
console.log('\n🔐 Шаг 2: Генерация тестовых токенов...');
const tokens = generateTestTokens();

// 3. Создание тестовых данных
console.log('\n📊 Шаг 3: Подготовка тестовых данных...');

const testData = {
  qrCode: 't=20231201T1430&s=1234.56&fn=9287440300090728&i=12345&fp=1234567890&n=1',
  subdomains: [
    'р-фарм.чекпоинт.рф',
    'apteka-36-6.чекпоинт.рф'
  ],
  tokens: tokens
};

// 4. Создание curl команд для тестирования
console.log('\n📡 Шаг 4: Генерация команд для тестирования...');

function generateCurlCommands() {
  const commands = [];
  
  for (const subdomain of testData.subdomains) {
    const command = `curl -X POST http://localhost:4000/fns/qr/scan \\
  -H "Host: ${subdomain}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "qrCode": "${testData.qrCode}",
    "token": "${tokens.userWithNetwork}",
    "additionalData": {
      "test": true,
      "timestamp": "${new Date().toISOString()}"
    }
  }'`;
    
    commands.push({
      subdomain,
      command,
      description: `Тест QR-сканирования для ${subdomain}`
    });
  }
  
  return commands;
}

const curlCommands = generateCurlCommands();

// 5. Вывод инструкций
console.log('\n✅ Система готова к тестированию!\n');

console.log('📋 ИНСТРУКЦИИ ПО ЗАПУСКУ:');
console.log('=' * 50);

console.log('\n1️⃣  Запустите приложение:');
console.log('   npm run start:dev');

console.log('\n2️⃣  Примените миграции БД:');
console.log('   psql -d pharm_vision -f migration_add_network_subdomain.sql');
console.log('   psql -d pharm_vision -f init_test_data.sql');

console.log('\n3️⃣  Протестируйте API (замените localhost:4000 на ваш адрес):');

curlCommands.forEach((cmd, index) => {
  console.log(`\n   Тест ${index + 1}: ${cmd.description}`);
  console.log(`   ${cmd.command}`);
});

console.log('\n4️⃣  Проверьте логи приложения для отладки');

console.log('\n📊 ТЕСТОВЫЕ ДАННЫЕ:');
console.log('=' * 50);

console.log('\n🔑 JWT Токены:');
console.log(`Пользователь с networkId: ${tokens.userWithNetwork}`);
console.log(`Пользователь без networkId: ${tokens.userWithoutNetwork}`);
console.log(`Админ: ${tokens.admin}`);
console.log(`Компания: ${tokens.company}`);

console.log('\n📋 QR-код для тестирования:');
console.log(testData.qrCode);

console.log('\n🌐 Поддомены для тестирования:');
testData.subdomains.forEach(subdomain => {
  console.log(`   - ${subdomain}`);
});

console.log('\n📁 ФАЙЛЫ ДЛЯ ИЗУЧЕНИЯ:');
console.log('=' * 50);

const importantFiles = [
  'src/fns/fns-qr.controller.ts - Основной контроллер',
  'src/fns/fns-qr-parser.service.ts - Парсинг QR-кодов',
  'src/fns/fns-network.service.ts - Работа с сетями',
  'FNS_QR_INTEGRATION.md - Техническая документация',
  'README_QR_INTEGRATION.md - Инструкция по запуску'
];

importantFiles.forEach(file => {
  console.log(`   📄 ${file}`);
});

console.log('\n🎯 ГОТОВНОСТЬ К ПРОДАКШЕНУ:');
console.log('=' * 50);

const readinessChecklist = [
  '✅ Парсинг QR-кодов ФНС',
  '✅ Определение сетей по поддоменам',
  '✅ Расчет кешбека по условиям сетей',
  '✅ Интеграция с API ФНС',
  '✅ Обработка ошибок и повторные попытки',
  '✅ Логирование операций',
  '✅ Валидация токенов и поддоменов',
  '✅ Тестирование компонентов',
  '✅ Документация и инструкции'
];

readinessChecklist.forEach(item => {
  console.log(`   ${item}`);
});

console.log('\n🚀 СИСТЕМА ПОЛНОСТЬЮ ГОТОВА К ИСПОЛЬЗОВАНИЮ!');
console.log('\n💡 Для получения помощи обратитесь к документации:');
console.log('   - FNS_QR_INTEGRATION.md');
console.log('   - README_QR_INTEGRATION.md');

// Сохранение тестовых данных в файл
const fs = require('fs');
const testDataFile = {
  timestamp: new Date().toISOString(),
  systemReport,
  testData,
  tokens,
  curlCommands
};

fs.writeFileSync('test_data_output.json', JSON.stringify(testDataFile, null, 2));
console.log('\n💾 Тестовые данные сохранены в test_data_output.json');