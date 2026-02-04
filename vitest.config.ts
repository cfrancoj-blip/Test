import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Simula um navegador para que 'window', 'document' e 'localStorage' existam
    environment: 'happy-dom',
    // Permite usar describe, it, expect sem importar em cada arquivo
    globals: true,
    // Padrão de busca de arquivos de teste
    include: ['**/*.test.ts'],
    // Limpa mocks automaticamente entre testes para evitar vazamento de estado
    mockReset: true,
    // Aumenta timeout para super-testes que fazem operações pesadas
    testTimeout: 30000,
    // Performance budgets
    slowTestThreshold: 1000,
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'services/**/*.ts',
        'render/**/*.ts',
        'listeners/**/*.ts',
        'habitActions.ts',
        'state.ts',
        'utils.ts'
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.config.ts',
        '**/build.js',
        'api/**',
        'scripts/**'
      ],
      all: true,
      lines: 80,
      functions: 70,
      branches: 70,
      statements: 80
    }
  },
});