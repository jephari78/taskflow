import { Hono } from 'hono'
import type { Db } from './db/client'
import { authRoutes } from './routes/auth'

export type AppOptions = {
  /** JWT 서명 키. 생략하면 JWT_SECRET 환경 변수를 쓴다. */
  jwtSecret?: string
}

/**
 * DB를 주입받아 Hono 앱을 만든다. 서버를 띄우지 않으므로
 * 테스트에서 app.request()로 그대로 호출할 수 있다.
 */
export function createApp(db: Db, { jwtSecret = process.env.JWT_SECRET }: AppOptions = {}) {
  const app = new Hono()

  app.get('/health', (c) => c.json({ status: 'ok' }))
  app.route('/api/auth', authRoutes(db, { jwtSecret }))

  return app
}
