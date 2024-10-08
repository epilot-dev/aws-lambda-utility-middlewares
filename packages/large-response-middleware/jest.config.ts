import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/?(*.)+(spec|test).ts?(x)'],
  testPathIgnorePatterns: ['node_modules'],
  coveragePathIgnorePatterns: ['__tests__', 'node_modules'],
  reporters: ['default', ['jest-junit', { outputName: 'test-report.xml' }]],
  setupFiles: ['./src/__tests__/test-setup.ts'],
  verbose: false,
  silent: true,
  forceExit: true,
  maxWorkers: 1, // run tests sequentially
  moduleDirectories: ['node_modules', 'src'],
  modulePaths: ['node_modules'],
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  transformIgnorePatterns: ['/node_modules/(?!(yn)/)'],
  extensionsToTreatAsEsm: ['.ts'],
};

export default config;
