import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // 개발 중 /api 요청은 backend(3000)로 넘긴다 — 같은 출처라 CORS 설정이 필요 없다.
    proxy: { '/api': 'http://localhost:3000' },
  },
  test: {
    // backend와 같이 describe/it/expect를 import 없이 쓴다.
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
    // 테스트마다 vi.stubGlobal('fetch', ...)과 mock 상태를 원래대로 되돌린다.
    unstubGlobals: true,
    restoreMocks: true,
  },
})
