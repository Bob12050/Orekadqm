/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { fileURLToPath, URL } from 'node:url'

// 縦式リール・プロトタイプ。データの単一ソースはリポジトリ直下の /data を参照する。
// SINGLEFILE=1 で全アセットを1つの index.html に inline（ファイルを直接開いて遊べる）。
const singlefile = !!process.env.SINGLEFILE

export default defineConfig({
  plugins: [react(), ...(singlefile ? [viteSingleFile()] : [])],
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
