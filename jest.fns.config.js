module.exports = {
  displayName: 'FNS Module Tests',
  rootDir: './',
  testMatch: [
    '<rootDir>/test/fns/**/*.spec.ts',
    '<rootDir>/test/fns/**/*.test.ts'
  ],
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/fns/**/*.(t|j)s',
    '!src/fns/**/*.spec.ts',
    '!src/fns/**/*.test.ts',
    '!src/fns/**/*.interface.ts',
    '!src/fns/**/types/**'
  ],
  coverageDirectory: './coverage/fns',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  verbose: true,
  // Timeouts увеличены для тестов с внешними API
  testTimeout: 30000,
  // Глобальные моки для тестирования
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};