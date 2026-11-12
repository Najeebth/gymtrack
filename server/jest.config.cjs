/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  // Source files import siblings as './x.js' (ESM style) but the files on disk are .ts
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // Compile TS with SWC to CommonJS so jest.mock() hoisting works as usual
  // (the package itself is "type": "module", but Jest runs the code as CJS).
  transform: {
    '^.+\\.[tj]s$': [
      '@swc/jest',
      {
        jsc: { target: 'es2022', parser: { syntax: 'typescript' } },
        module: { type: 'commonjs' },
      },
    ],
  },
  // uuid ships ESM only, so it must be compiled too (everything else in node_modules is CJS)
  transformIgnorePatterns: ['/node_modules/(?!uuid/)'],
  setupFiles: ['<rootDir>/jest.setup.cjs'],
  clearMocks: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts', '!src/server.ts', '!src/types/**'],
};
