/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// 縦式リール・プロトタイプ。データの単一ソースはリポジトリ直下の /data を参照する。
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@data': fileURLToPath(new URL('../data', import.meta.url)),
    },
  },
  server: {
    host: true,
    fs: {
      // src の外（リポジトリ直下の /data）を import 可能にする
      allow: ['..'],
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
