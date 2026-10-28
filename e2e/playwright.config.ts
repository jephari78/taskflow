import { defineConfig, devices } from '@playwright/test'

// 개발 서버(3000/5173)와 겹치지 않는 포트에 e2e 전용 서버를 띄운다.
const API_PORT = 3100
const WEB_PORT = 5180

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // 메모리 DB라 실행할 때마다 빈 상태에서 시작하고, 로컬 taskflow.db를 건드리지 않는다.
      command: 'npm run start --workspace @taskflow/backend',
      cwd: '..',
      url: `http://localhost:${API_PORT}/health`,
      env: { PORT: String(API_PORT), DATABASE_URL: ':memory:', JWT_SECRET: 'e2e-secret' },
      reuseExistingServer: false,
    },
    {
      command: `npm run dev --workspace @taskflow/frontend -- --port ${WEB_PORT} --strictPort`,
      cwd: '..',
      url: `http://localhost:${WEB_PORT}`,
      env: { API_URL: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
    },
  ],
})
