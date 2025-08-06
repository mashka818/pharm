import { Logger } from '@nestjs/common';

// Глобальные настройки для всех тестов

// Подавляем логи в тестах по умолчанию
beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation();
  jest.spyOn(Logger.prototype, 'error').mockImplementation();
  jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  jest.spyOn(Logger.prototype, 'verbose').mockImplementation();
});

// Настройки для FNS тестов
beforeEach(() => {
  // Устанавливаем переменные окружения для тестов
  process.env.NODE_ENV = 'test';
  process.env.FNS_DEV_MODE = 'true';
  
  // Очищаем таймауты Jest если используются
  jest.clearAllTimers();
});

// Восстанавливаем состояние после тестов
afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  
  // Если используются fake timers
  if (jest.isMockFunction(setTimeout)) {
    jest.useRealTimers();
  }
});

// Глобальные утилиты для тестов
global.createMockQrData = (overrides = {}) => ({
  fn: '9287440300090728',
  fd: '77133',
  fp: '1482926127',
  sum: 240000,
  date: '2019-04-09T16:38:00',
  typeOperation: 1,
  ...overrides
});

global.createMockToken = () => `test-token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

global.createMockPromotion = (overrides = {}) => ({
  promotionId: 'test-promo-id',
  name: 'Test Pharmacy Network',
  domain: 'test-pharmacy.ru',
  active: true,
  ...overrides
});

// Расширяем типы для TypeScript
declare global {
  function createMockQrData(overrides?: Record<string, any>): any;
  function createMockToken(): string;
  function createMockPromotion(overrides?: Record<string, any>): any;
}