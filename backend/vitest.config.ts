import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // 테스트 파일이 describe/it/expect를 import 없이 쓰는 기존 형태를 유지한다.
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
