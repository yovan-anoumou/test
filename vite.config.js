import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: './',
  server: {
    host: true,
    port: 5173
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js']
  }
});
