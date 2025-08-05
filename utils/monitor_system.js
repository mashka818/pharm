const fs = require('fs');
const path = require('path');

// Функция для проверки файлов системы
function checkSystemFiles() {
  console.log('📁 Проверка файлов системы...\n');

  const requiredFiles = [
    '.env',
    'src/fns/fns-qr.controller.ts',
    'src/fns/fns-qr-parser.service.ts',
    'src/fns/fns-network.service.ts',
    'src/fns/dto/scan-qr.dto.ts',
    'migration_add_network_subdomain.sql',
    'init_test_data.sql',
    'test_qr_simple.js',
    'utils/create_jwt_token.js'
  ];

  const missingFiles = [];
  const existingFiles = [];

  for (const file of requiredFiles) {
    if (fs.existsSync(file)) {
      existingFiles.push(file);
      console.log(`✅ ${file}`);
    } else {
      missingFiles.push(file);
      console.log(`❌ ${file} - ОТСУТСТВУЕТ`);
    }
  }

  console.log(`\n📊 Результат: ${existingFiles.length}/${requiredFiles.length} файлов найдено`);
  
  if (missingFiles.length > 0) {
    console.log('\n❌ Отсутствующие файлы:');
    missingFiles.forEach(file => console.log(`  - ${file}`));
  }

  return { existingFiles, missingFiles };
}

// Функция для проверки конфигурации
function checkConfiguration() {
  console.log('\n⚙️  Проверка конфигурации...\n');

  try {
    const envContent = fs.readFileSync('.env', 'utf8');
    const requiredEnvVars = [
      'DATABASE_URL',
      'FNS_APP_ID',
      'FNS_AUTH_SERVICE_URL',
      'FNS_ASYNC_SERVICE_URL',
      'JWT_SECRET'
    ];

    const missingVars = [];
    const existingVars = [];

    for (const varName of requiredEnvVars) {
      if (envContent.includes(varName)) {
        existingVars.push(varName);
        console.log(`✅ ${varName}`);
      } else {
        missingVars.push(varName);
        console.log(`❌ ${varName} - ОТСУТСТВУЕТ`);
      }
    }

    console.log(`\n📊 Результат: ${existingVars.length}/${requiredEnvVars.length} переменных найдено`);

    if (missingVars.length > 0) {
      console.log('\n❌ Отсутствующие переменные окружения:');
      missingVars.forEach(varName => console.log(`  - ${varName}`));
    }

    return { existingVars, missingVars };
  } catch (error) {
    console.log('❌ Ошибка чтения .env файла:', error.message);
    return { existingVars: [], missingVars: requiredEnvVars };
  }
}

// Функция для проверки структуры проекта
function checkProjectStructure() {
  console.log('\n🏗️  Проверка структуры проекта...\n');

  const requiredDirs = [
    'src/fns',
    'src/fns/dto',
    'utils',
    'prisma'
  ];

  const missingDirs = [];
  const existingDirs = [];

  for (const dir of requiredDirs) {
    if (fs.existsSync(dir)) {
      existingDirs.push(dir);
      console.log(`✅ ${dir}/`);
    } else {
      missingDirs.push(dir);
      console.log(`❌ ${dir}/ - ОТСУТСТВУЕТ`);
    }
  }

  console.log(`\n📊 Результат: ${existingDirs.length}/${requiredDirs.length} директорий найдено`);

  if (missingDirs.length > 0) {
    console.log('\n❌ Отсутствующие директории:');
    missingDirs.forEach(dir => console.log(`  - ${dir}/`));
  }

  return { existingDirs, missingDirs };
}

// Функция для генерации отчета
function generateReport() {
  console.log('📋 Генерация отчета о состоянии системы\n');

  const fileCheck = checkSystemFiles();
  const configCheck = checkConfiguration();
  const structureCheck = checkProjectStructure();

  console.log('\n📊 ОБЩИЙ ОТЧЕТ:');
  console.log('=' * 50);

  const totalFiles = fileCheck.existingFiles.length + fileCheck.missingFiles.length;
  const totalVars = configCheck.existingVars.length + configCheck.missingVars.length;
  const totalDirs = structureCheck.existingDirs.length + structureCheck.missingDirs.length;

  console.log(`📁 Файлы: ${fileCheck.existingFiles.length}/${totalFiles} (${Math.round(fileCheck.existingFiles.length/totalFiles*100)}%)`);
  console.log(`⚙️  Переменные окружения: ${configCheck.existingVars.length}/${totalVars} (${Math.round(configCheck.existingVars.length/totalVars*100)}%)`);
  console.log(`🏗️  Директории: ${structureCheck.existingDirs.length}/${totalDirs} (${Math.round(structureCheck.existingDirs.length/totalDirs*100)}%)`);

  const overallScore = (
    (fileCheck.existingFiles.length / totalFiles) * 0.4 +
    (configCheck.existingVars.length / totalVars) * 0.4 +
    (structureCheck.existingDirs.length / totalDirs) * 0.2
  ) * 100;

  console.log(`\n🎯 Общая готовность: ${Math.round(overallScore)}%`);

  if (overallScore >= 90) {
    console.log('✅ Система готова к запуску!');
  } else if (overallScore >= 70) {
    console.log('⚠️  Система почти готова, требуется доработка');
  } else {
    console.log('❌ Система требует значительной доработки');
  }

  return {
    fileCheck,
    configCheck,
    structureCheck,
    overallScore
  };
}

// Функция для рекомендаций
function provideRecommendations(report) {
  console.log('\n💡 РЕКОМЕНДАЦИИ:');
  console.log('=' * 50);

  if (report.fileCheck.missingFiles.length > 0) {
    console.log('\n📁 Создайте отсутствующие файлы:');
    report.fileCheck.missingFiles.forEach(file => {
      console.log(`  - ${file}`);
    });
  }

  if (report.configCheck.missingVars.length > 0) {
    console.log('\n⚙️  Добавьте в .env файл:');
    report.configCheck.missingVars.forEach(varName => {
      console.log(`  - ${varName}=значение`);
    });
  }

  if (report.structureCheck.missingDirs.length > 0) {
    console.log('\n🏗️  Создайте отсутствующие директории:');
    report.structureCheck.missingDirs.forEach(dir => {
      console.log(`  - mkdir -p ${dir}`);
    });
  }

  console.log('\n🚀 Следующие шаги:');
  console.log('1. Исправьте все ошибки выше');
  console.log('2. Запустите: npm run start:dev');
  console.log('3. Протестируйте API endpoints');
  console.log('4. Проверьте логи приложения');
}

// Главная функция
function runSystemCheck() {
  console.log('🔍 Проверка состояния системы интеграции QR-кодов ФНС\n');
  
  const report = generateReport();
  provideRecommendations(report);
  
  return report;
}

// Экспорт функций
module.exports = {
  checkSystemFiles,
  checkConfiguration,
  checkProjectStructure,
  generateReport,
  provideRecommendations,
  runSystemCheck
};

// Запуск проверки если файл выполняется напрямую
if (require.main === module) {
  runSystemCheck();
}