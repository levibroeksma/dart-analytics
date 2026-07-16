import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@auth': path.resolve(__dirname, './src/lib/auth'),
      '@client': path.resolve(__dirname, './src/lib/client'),
      '@components': path.resolve(__dirname, './src/components'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@forms': path.resolve(__dirname, './src/forms'),
      '@types': path.resolve(__dirname, './src/types'),
      '@modules': path.resolve(__dirname, './src/modules'),
      '@utils': path.resolve(__dirname, './src/lib/utils'),
      '@pages': path.resolve(__dirname, './src/pages'),
    },
  },
});
