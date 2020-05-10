/** @type {import('jest')} */
module.exports = {
  preset: 'ts-jest',
  testMatch: ['**/*.test.ts'],
  globals: {
    'ts-jest': {
      packageJson: 'package.json',
    },
  },
  moduleNameMapper: {
    '@/(.+)$': '<rootDir>/src/$1',
  },
};
