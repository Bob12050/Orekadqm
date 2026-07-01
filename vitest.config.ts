import { defineConfig } from 'vitest/config'

// 純ロジックのヘッドレステスト。Phaser/DOM 非依存のコードだけを対象にする。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
})
