#!/usr/bin/env node

// Простой диагностический скрипт для проверки доступности API

const axios = require('axios');

class ConnectionTest {
  constructor() {
    this.baseUrl = process.env.BACKEND_URL || `http://${process.env.PROD_SERVER_IP || '91.236.198.205'}:${process.env.API_PORT || '4000'}`;
  }

  async checkBasicConnection() {
    console.log('🔍 === Диагностика подключения к API ===');
    console.log(`📍 Проверяем сервер: ${this.baseUrl}`);
    
    try {
      // Проверка базового подключения
      const response = await axios.get(this.baseUrl, { timeout: 5000 });
      console.log('✅ Базовое подключение работает');
      console.log(`📊 Статус: ${response.status}`);
      return true;
    } catch (error) {
      if (error.response) {
        console.log('✅ Сервер отвечает');
        console.log(`📊 Статус: ${error.response.status}`);
        console.log(`💬 Ответ: ${error.response.data?.message || 'No message'}`);
        return true;
      } else {
        console.log('❌ Сервер недоступен');
        console.log(`💬 Ошибка: ${error.message}`);
        return false;
      }
    }
  }

  async checkApiPrefix() {
    console.log('\n🔍 === Проверка API префикса ===');
    
    const testPaths = [
      '/api',
      '/api/',
      '/api/health',
      '/'
    ];

    for (const path of testPaths) {
      const url = `${this.baseUrl}${path}`;
      console.log(`📡 Тестируем: ${url}`);
      
      try {
        const response = await axios.get(url, { timeout: 3000 });
        console.log(`  ✅ ${response.status} - ${response.statusText}`);
        if (response.data) {
          console.log(`  📋 Данные: ${JSON.stringify(response.data).substring(0, 100)}...`);
        }
      } catch (error) {
        if (error.response) {
          console.log(`  📊 ${error.response.status} - ${error.response.statusText}`);
          if (error.response.data?.message) {
            console.log(`  💬 ${error.response.data.message.substring(0, 80)}...`);
          }
        } else {
          console.log(`  ❌ Ошибка: ${error.message}`);
        }
      }
    }
  }

  async checkFnsEndpoints() {
    console.log('\n🔍 === Проверка FNS эндпоинтов ===');
    
    const fnsEndpoints = [
      '/fns/queue/stats',
      '/fns/daily-count',
      '/api/fns/queue/stats',
      '/api/fns/daily-count'
    ];

    for (const endpoint of fnsEndpoints) {
      const url = `${this.baseUrl}${endpoint}`;
      console.log(`📡 Тестируем: ${url}`);
      
      try {
        const response = await axios.get(url, { 
          timeout: 3000,
          headers: {
            'Authorization': 'Bearer test-token'
          }
        });
        console.log(`  ✅ ${response.status} - FNS эндпоинт найден!`);
        console.log(`  📋 ${JSON.stringify(response.data).substring(0, 100)}...`);
      } catch (error) {
        if (error.response) {
          console.log(`  📊 ${error.response.status} - ${error.response.statusText}`);
          if (error.response.status === 401) {
            console.log(`  🔐 Требуется авторизация (эндпоинт существует)`);
          } else if (error.response.status === 400) {
            console.log(`  ⚠️ Неверные данные (эндпоинт существует)`);
          }
        } else {
          console.log(`  ❌ ${error.message}`);
        }
      }
    }
  }

  async checkPortRange() {
    console.log('\n🔍 === Сканирование портов ===');
    console.log('Проверяем порты 3000-5000...');
    
    const ip = process.env.PROD_SERVER_IP || '91.236.198.205';
    const ports = [3000, 4000, 4001, 4020, 5000];
    
    for (const port of ports) {
      const url = `http://${ip}:${port}/api/fns/queue/stats`;
      try {
        const response = await axios.get(url, { 
          timeout: 2000,
          headers: { 'Authorization': 'Bearer test' }
        });
        console.log(`  ✅ Порт ${port}: FNS API найден!`);
        break;
      } catch (error) {
        if (error.response) {
          if (error.response.status === 401 || error.response.status === 400) {
            console.log(`  🎯 Порт ${port}: FNS API найден! (требует авторизации)`);
            break;
          } else if (error.response.status === 404) {
            console.log(`  📊 Порт ${port}: сервер работает, но FNS API не найден`);
          }
        } else if (error.code === 'ECONNREFUSED') {
          console.log(`  ❌ Порт ${port}: не отвечает`);
        } else {
          console.log(`  ⚠️ Порт ${port}: ${error.message}`);
        }
      }
    }
  }

  async runDiagnostics() {
    console.log('🚀 === ДИАГНОСТИКА API СОЕДИНЕНИЯ ===\n');
    
    const connected = await this.checkBasicConnection();
    if (!connected) {
      console.log('\n❌ Базовое подключение не работает. Завершение диагностики.');
      return;
    }
    
    await this.checkApiPrefix();
    await this.checkFnsEndpoints();
    await this.checkPortRange();
    
    console.log('\n📋 === РЕКОМЕНДАЦИИ ===');
    console.log('1. Если FNS эндпоинты не найдены:');
    console.log('   - Проверьте, включен ли FNS модуль в app.module.ts');
    console.log('   - Убедитесь, что сервер запущен с правильной конфигурацией');
    console.log('   - Проверьте логи сервера на наличие ошибок');
    console.log('\n2. Если эндпоинты найдены на другом порту:');
    console.log('   - Обновите переменную API_PORT в .env файле');
    console.log('\n3. Если требуется авторизация:');
    console.log('   - Убедитесь, что JWT_SECRET правильный');
    console.log('   - Проверьте формат токенов в тестах');
  }
}

// Запуск диагностики
if (require.main === module) {
  const test = new ConnectionTest();
  test.runDiagnostics()
    .then(() => {
      console.log('\n✅ Диагностика завершена');
    })
    .catch(error => {
      console.error('\n💥 Ошибка диагностики:', error.message);
    });
}

module.exports = ConnectionTest;